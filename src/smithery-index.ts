import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";

export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional().describe("The URL of your n8n instance (e.g., https://your-n8n.com)"),
  n8nApiKey: z.string().optional().describe("Your n8n API key for authentication"),
}).describe("n8n API Configuration");

type Config = z.infer<typeof configSchema>;

export default function createServer({ config }: { config: Config }) {
  const server = new McpServer({
    name: "n8n-mcp",
    version: "1.0.0",
  });

  // Server capabilities
  server.setRequestHandler("resources/list", async () => ({
    resources: [
      {
        uri: "n8n://workflows",
        name: "n8n Workflows",
        description: "List of all workflows in your n8n instance",
        mimeType: "application/json",
      },
      {
        uri: "n8n://executions",
        name: "n8n Executions",
        description: "Recent workflow executions",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler("resources/read", async (request) => {
    const uri = request.params.uri as string;
    
    if (uri === "n8n://workflows") {
      const workflows = await n8nApi("/workflows?limit=100");
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(workflows, null, 2),
          },
        ],
      };
    }
    
    if (uri === "n8n://executions") {
      const executions = await n8nApi("/executions?limit=50");
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(executions, null, 2),
          },
        ],
      };
    }
    
    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler("prompts/list", async () => ({
    prompts: [
      {
        name: "create-workflow",
        description: "Interactive workflow creation assistant",
        arguments: [
          {
            name: "workflow_type",
            description: "Type of workflow (webhook-api, schedule-task, data-processing, notification)",
            required: true,
          },
        ],
      },
      {
        name: "debug-workflow",
        description: "Debug a workflow and find issues",
        arguments: [
          {
            name: "workflow_id",
            description: "The workflow ID to debug",
            required: true,
          },
        ],
      },
    ],
  }));

  server.setRequestHandler("prompts/get", async (request) => {
    const name = request.params.name as string;
    const args = request.params.arguments as Record<string, string> || {};
    
    if (name === "create-workflow") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I want to create a ${args.workflow_type} workflow. Please guide me through the process and use n8n_workflow_template to get started.`,
            },
          },
        ],
      };
    }
    
    if (name === "debug-workflow") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please debug workflow ${args.workflow_id}. Use n8n_get_workflow and n8n_validate_workflow to find issues.`,
            },
          },
        ],
      };
    }
    
    throw new Error(`Unknown prompt: ${name}`);
  });

  // Helper function to make n8n API calls
  const n8nApi = async (endpoint: string, method: string = "GET", data?: any) => {
    if (!config?.n8nApiUrl || !config?.n8nApiKey) {
      throw new Error("⚠️ n8n API credentials not configured. Please add n8nApiUrl and n8nApiKey to your MCP settings.");
    }

    const url = `${config.n8nApiUrl}/api/v1${endpoint}`;
    
    try {
      const response = await axios({
        method,
        url,
        headers: {
          "X-N8N-API-KEY": config.n8nApiKey,
          "Content-Type": "application/json",
        },
        data,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`n8n API error: ${error.response?.data?.message || error.message}`);
    }
  };

  // ============================================================================
  // SYSTEM TOOLS (No auth required)
  // ============================================================================

  server.tool(
    "n8n_health_check",
    "Check n8n API connectivity and configuration status",
    {},
    async () => {
      if (!config?.n8nApiUrl || !config?.n8nApiKey) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: false,
                message: "⚠️ n8n API credentials not configured",
                instructions: "Please add n8nApiUrl and n8nApiKey to your MCP settings",
                example: {
                  n8nApiUrl: "https://your-n8n-instance.com",
                  n8nApiKey: "your-api-key-here"
                }
              }, null, 2),
            },
          ],
        };
      }

      try {
        await n8nApi("/workflows?limit=1");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: true,
                status: "✅ Connected",
                apiUrl: config.n8nApiUrl,
                message: "n8n API is accessible and working"
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: true,
                status: "❌ Connection failed",
                apiUrl: config.n8nApiUrl,
                error: error.message,
                message: "Check your API URL and API key"
              }, null, 2),
            },
          ],
        };
      }
    }
  );

  // ============================================================================
  // WORKFLOW MANAGEMENT TOOLS
  // ============================================================================

  server.tool(
    "n8n_list_workflows",
    "List all workflows in your n8n instance with filtering options",
    {
      active: z.boolean().optional().describe("Filter by active/inactive workflows"),
      tags: z.array(z.string()).optional().describe("Filter by workflow tags"),
      limit: z.number().optional().describe("Maximum number of workflows to return (default: 100)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
    },
    async ({ active, tags, limit, cursor }) => {
      let endpoint = "/workflows";
      const params = new URLSearchParams();
      
      if (active !== undefined) params.append("active", active.toString());
      if (limit) params.append("limit", limit.toString());
      if (cursor) params.append("cursor", cursor);
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const workflows = await n8nApi(endpoint);
      let filtered = workflows.data || workflows;

      if (tags && tags.length > 0) {
        filtered = filtered.filter((w: any) => 
          w.tags?.some((t: any) => tags.includes(t.name))
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_get_workflow",
    "Get complete workflow details including nodes, connections, and settings",
    {
      id: z.string().describe("The workflow ID to retrieve"),
    },
    async ({ id }) => {
      const workflow = await n8nApi(`/workflows/${id}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(workflow, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_create_workflow",
    "Create a new workflow in n8n. Workflow is created inactive by default.",
    {
      annotations: {
        audience: ["developers", "automation-engineers"],
        required_permissions: ["workflow:create"],
        destructive: false,
      },
    },
    {
      name: z.string().describe("Name of the workflow"),
      nodes: z.array(z.any()).describe("Array of workflow nodes. Each node must have: id, name, type, typeVersion, position, parameters"),
      connections: z.record(z.any()).describe("Node connections object. Keys are source node IDs"),
      settings: z.record(z.any()).optional().describe("Workflow settings (execution order, timezone, error handling)"),
      active: z.boolean().optional().describe("Whether the workflow should be active (default: false)"),
    },
    async ({ name, nodes, connections, settings, active }) => {
      const workflowData = {
        name,
        nodes,
        connections,
        settings: settings || {},
        active: active || false,
      };

      const result = await n8nApi("/workflows", "POST", workflowData);

      return {
        content: [
          {
            type: "text",
            text: `✅ Workflow created successfully!\n\nID: ${result.id}\nName: ${result.name}\nActive: ${result.active}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_update_workflow",
    "Update an existing workflow (full update - requires complete nodes and connections)",
    {
      id: z.string().describe("The workflow ID to update"),
      name: z.string().optional().describe("New name for the workflow"),
      nodes: z.array(z.any()).optional().describe("Complete array of workflow nodes"),
      connections: z.record(z.any()).optional().describe("Complete node connections object"),
      settings: z.record(z.any()).optional().describe("Workflow settings"),
      active: z.boolean().optional().describe("Whether the workflow should be active"),
    },
    async ({ id, name, nodes, connections, settings, active }) => {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (nodes) updateData.nodes = nodes;
      if (connections) updateData.connections = connections;
      if (settings) updateData.settings = settings;
      if (active !== undefined) updateData.active = active;

      const result = await n8nApi(`/workflows/${id}`, "PATCH", updateData);

      return {
        content: [
          {
            type: "text",
            text: `✅ Workflow updated successfully!\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_delete_workflow",
    "Permanently delete a workflow from n8n. This action cannot be undone.",
    {
      annotations: {
        audience: ["developers", "administrators"],
        required_permissions: ["workflow:delete"],
        destructive: true,
      },
    },
    {
      id: z.string().describe("The workflow ID to delete"),
    },
    async ({ id }) => {
      await n8nApi(`/workflows/${id}`, "DELETE");

      return {
        content: [
          {
            type: "text",
            text: `✅ Workflow ${id} deleted successfully!`,
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_toggle_workflow",
    "Activate or deactivate a workflow",
    {
      id: z.string().describe("The workflow ID"),
      active: z.boolean().describe("Set to true to activate, false to deactivate"),
    },
    async ({ id, active }) => {
      const result = await n8nApi(`/workflows/${id}`, "PATCH", { active });

      return {
        content: [
          {
            type: "text",
            text: `✅ Workflow ${active ? 'activated' : 'deactivated'} successfully!\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // ============================================================================
  // EXECUTION MANAGEMENT TOOLS
  // ============================================================================

  server.tool(
    "n8n_execute_workflow",
    "Manually execute a workflow with optional input data",
    {
      annotations: {
        audience: ["developers", "testers"],
        required_permissions: ["workflow:execute"],
        destructive: false,
      },
    },
    {
      id: z.string().describe("The workflow ID to execute"),
      data: z.record(z.any()).optional().describe("Input data for the workflow execution"),
    },
    async ({ id, data }) => {
      const result = await n8nApi(`/workflows/${id}/execute`, "POST", data || {});

      return {
        content: [
          {
            type: "text",
            text: `✅ Workflow executed!\n\nExecution ID: ${result.executionId || result.id}\nStatus: ${result.finished ? '✅ Finished' : '⏳ Running'}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_list_executions",
    "List workflow executions with filtering options",
    {
      workflowId: z.string().optional().describe("Filter by workflow ID"),
      status: z.enum(["success", "error", "waiting", "running"]).optional().describe("Filter by execution status"),
      limit: z.number().optional().describe("Maximum number of executions to return (default: 20)"),
    },
    async ({ workflowId, status, limit }) => {
      let endpoint = "/executions";
      const params = new URLSearchParams();
      
      if (workflowId) params.append("workflowId", workflowId);
      if (status) params.append("status", status);
      if (limit) params.append("limit", limit.toString());

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const executions = await n8nApi(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(executions, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_get_execution",
    "Get detailed information about a specific execution including all node outputs",
    {
      id: z.string().describe("The execution ID to retrieve"),
    },
    async ({ id }) => {
      const execution = await n8nApi(`/executions/${id}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(execution, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_delete_execution",
    "Delete an execution from n8n",
    {
      id: z.string().describe("The execution ID to delete"),
    },
    async ({ id }) => {
      await n8nApi(`/executions/${id}`, "DELETE");

      return {
        content: [
          {
            type: "text",
            text: `✅ Execution ${id} deleted successfully!`,
          },
        ],
      };
    }
  );

  // ============================================================================
  // CREDENTIALS & TAGS
  // ============================================================================

  server.tool(
    "n8n_list_credentials",
    "List all credentials in your n8n instance",
    {
      type: z.string().optional().describe("Filter by credential type (e.g., 'slackApi', 'googleSheetsOAuth2Api')"),
    },
    async ({ type }) => {
      let credentials = await n8nApi("/credentials");
      credentials = credentials.data || credentials;

      if (type) {
        credentials = credentials.filter((c: any) => c.type === type);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(credentials, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_list_tags",
    "List all tags used in workflows",
    {},
    async () => {
      const tags = await n8nApi("/tags");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }
  );

  // ============================================================================
  // VALIDATION & DOCUMENTATION TOOLS (Simplified - no database needed)
  // ============================================================================

  server.tool(
    "n8n_validate_workflow",
    "Validate a workflow structure for common issues (connections, node types, required fields)",
    {
      annotations: {
        audience: ["developers", "testers", "automation-engineers"],
        required_permissions: ["workflow:read"],
        destructive: false,
      },
    },
    {
      id: z.string().describe("The workflow ID to validate"),
    },
    async ({ id }) => {
      const workflow = await n8nApi(`/workflows/${id}`);
      
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Basic validation checks
      if (!workflow.nodes || workflow.nodes.length === 0) {
        errors.push("Workflow has no nodes");
      }

      // Check for trigger nodes
      const triggerNodes = workflow.nodes?.filter((n: any) => 
        n.type.includes('Trigger') || n.type.includes('trigger')
      ) || [];
      
      if (triggerNodes.length === 0) {
        warnings.push("Workflow has no trigger nodes - it can only be executed manually");
      }

      // Check for disconnected nodes
      const connectedNodeIds = new Set();
      Object.values(workflow.connections || {}).forEach((conn: any) => {
        Object.values(conn).forEach((outputs: any) => {
          outputs.forEach((output: any) => {
            output.forEach((connection: any) => {
              connectedNodeIds.add(connection.node);
            });
          });
        });
      });

      const disconnectedNodes = workflow.nodes?.filter((n: any) => 
        !connectedNodeIds.has(n.name) && !n.type.includes('Trigger')
      ) || [];

      if (disconnectedNodes.length > 0) {
        warnings.push(`Found ${disconnectedNodes.length} disconnected nodes: ${disconnectedNodes.map((n: any) => n.name).join(', ')}`);
      }

      // Check for disabled nodes
      const disabledNodes = workflow.nodes?.filter((n: any) => n.disabled) || [];
      if (disabledNodes.length > 0) {
        suggestions.push(`${disabledNodes.length} nodes are disabled: ${disabledNodes.map((n: any) => n.name).join(', ')}`);
      }

      const result = {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        summary: {
          totalNodes: workflow.nodes?.length || 0,
          triggerNodes: triggerNodes.length,
          disabledNodes: disabledNodes.length,
          disconnectedNodes: disconnectedNodes.length,
        }
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_get_node_types",
    "Get information about available node types in n8n (common nodes)",
    {},
    async () => {
      // Return a curated list of common n8n nodes
      const commonNodes = [
        { type: "n8n-nodes-base.webhook", name: "Webhook", category: "trigger", description: "Receive HTTP requests" },
        { type: "n8n-nodes-base.httpRequest", name: "HTTP Request", category: "action", description: "Make HTTP requests" },
        { type: "n8n-nodes-base.code", name: "Code", category: "transform", description: "Execute JavaScript code" },
        { type: "n8n-nodes-base.set", name: "Set", category: "transform", description: "Set node data" },
        { type: "n8n-nodes-base.if", name: "IF", category: "transform", description: "Conditional routing" },
        { type: "n8n-nodes-base.switch", name: "Switch", category: "transform", description: "Multi-way routing" },
        { type: "n8n-nodes-base.merge", name: "Merge", category: "transform", description: "Merge data from multiple nodes" },
        { type: "n8n-nodes-base.slack", name: "Slack", category: "communication", description: "Slack integration" },
        { type: "n8n-nodes-base.gmail", name: "Gmail", category: "communication", description: "Gmail integration" },
        { type: "n8n-nodes-base.googleSheets", name: "Google Sheets", category: "productivity", description: "Google Sheets integration" },
        { type: "n8n-nodes-base.postgres", name: "Postgres", category: "database", description: "PostgreSQL database" },
        { type: "n8n-nodes-base.mysql", name: "MySQL", category: "database", description: "MySQL database" },
        { type: "n8n-nodes-base.schedule", name: "Schedule Trigger", category: "trigger", description: "Trigger on a schedule" },
        { type: "n8n-nodes-base.cron", name: "Cron", category: "trigger", description: "Trigger with cron expression" },
      ];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(commonNodes, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "n8n_workflow_template",
    "Get a basic workflow template for common use cases",
    {
      type: z.enum(["webhook-api", "schedule-task", "data-processing", "notification"]).describe("Type of workflow template"),
    },
    async ({ type }) => {
      const templates: Record<string, any> = {
        "webhook-api": {
          name: "Webhook API Template",
          nodes: [
            {
              id: "webhook",
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              typeVersion: 1,
              position: [250, 300],
              parameters: {
                path: "my-webhook",
                httpMethod: "POST",
                responseMode: "responseNode",
              },
            },
            {
              id: "respond",
              name: "Respond to Webhook",
              type: "n8n-nodes-base.respondToWebhook",
              typeVersion: 1,
              position: [450, 300],
              parameters: {
                respondWith: "json",
                responseBody: '{"success": true}',
              },
            },
          ],
          connections: {
            Webhook: {
              main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]],
            },
          },
        },
        "schedule-task": {
          name: "Scheduled Task Template",
          nodes: [
            {
              id: "schedule",
              name: "Schedule Trigger",
              type: "n8n-nodes-base.scheduleTrigger",
              typeVersion: 1,
              position: [250, 300],
              parameters: {
                rule: {
                  interval: [{ field: "hours", hoursInterval: 1 }],
                },
              },
            },
            {
              id: "code",
              name: "Process Data",
              type: "n8n-nodes-base.code",
              typeVersion: 2,
              position: [450, 300],
              parameters: {
                jsCode: "// Your code here\nreturn items;",
              },
            },
          ],
          connections: {
            "Schedule Trigger": {
              main: [[{ node: "Process Data", type: "main", index: 0 }]],
            },
          },
        },
        "data-processing": {
          name: "Data Processing Template",
          nodes: [
            {
              id: "webhook",
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              typeVersion: 1,
              position: [250, 300],
              parameters: { path: "process-data" },
            },
            {
              id: "code",
              name: "Transform Data",
              type: "n8n-nodes-base.code",
              typeVersion: 2,
              position: [450, 300],
              parameters: {
                jsCode: "// Transform your data\nreturn items.map(item => ({ ...item.json, processed: true }));",
              },
            },
            {
              id: "respond",
              name: "Respond",
              type: "n8n-nodes-base.respondToWebhook",
              typeVersion: 1,
              position: [650, 300],
              parameters: {},
            },
          ],
          connections: {
            Webhook: {
              main: [[{ node: "Transform Data", type: "main", index: 0 }]],
            },
            "Transform Data": {
              main: [[{ node: "Respond", type: "main", index: 0 }]],
            },
          },
        },
        "notification": {
          name: "Notification Template",
          nodes: [
            {
              id: "webhook",
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              typeVersion: 1,
              position: [250, 300],
              parameters: { path: "notify" },
            },
            {
              id: "slack",
              name: "Send Slack Message",
              type: "n8n-nodes-base.slack",
              typeVersion: 2,
              position: [450, 300],
              parameters: {
                resource: "message",
                operation: "post",
                channel: "#general",
                text: "New notification received!",
              },
            },
          ],
          connections: {
            Webhook: {
              main: [[{ node: "Send Slack Message", type: "main", index: 0 }]],
            },
          },
        },
      };

      const template = templates[type];

      return {
        content: [
          {
            type: "text",
            text: `# ${template.name}\n\nUse this template with n8n_create_workflow:\n\n${JSON.stringify(template, null, 2)}`,
          },
        ],
      };
    }
  );

  return server.server;
}
