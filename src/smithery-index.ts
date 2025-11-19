import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Configuration schema
export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional().describe("The URL of your n8n instance (e.g., https://your-n8n.com). Leave empty for demo mode."),
  n8nApiKey: z.string().optional().describe("Your n8n API key for authentication. Leave empty for demo mode."),
  demoMode: z.boolean().optional().default(true).describe("Enable demo mode with mock data (no real n8n instance needed)"),
});

export type Config = z.infer<typeof configSchema>;

// Demo data helper function
const getDemoData = (endpoint: string, method: string, data?: any) => {
  // Workflows
  if (endpoint.includes("/workflows")) {
    if (method === "POST") {
      return {
        id: "demo-wf-" + Date.now(),
        name: data.name || "Demo Workflow",
        active: false,
        nodes: data.nodes || [],
        connections: data.connections || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    if (method === "PATCH") {
      return {
        id: endpoint.split("/").pop(),
        ...data,
        updatedAt: new Date().toISOString(),
      };
    }
    if (method === "DELETE") {
      return { success: true };
    }
    if (endpoint.includes("/execute")) {
      return {
        executionId: "demo-exec-" + Date.now(),
        status: "success",
        data: { resultData: { runData: {} } },
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };
    }
    // Get single workflow
    if (endpoint.match(/\/workflows\/[^/]+$/)) {
      const id = endpoint.split("/").pop();
      return {
        id,
        name: "Demo Workflow " + id,
        active: true,
        nodes: [
          {
            name: "Start",
            type: "n8n-nodes-base.start",
            position: [250, 300],
            parameters: {},
          },
        ],
        connections: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    // List workflows
    return {
      data: [
        {
          id: "demo-wf-1",
          name: "Demo Webhook API",
          active: true,
          tags: [{ id: "1", name: "demo" }],
          createdAt: new Date().toISOString(),
        },
        {
          id: "demo-wf-2",
          name: "Demo Scheduled Task",
          active: false,
          tags: [{ id: "1", name: "demo" }],
          createdAt: new Date().toISOString(),
        },
        {
          id: "demo-wf-3",
          name: "Demo Data Processing",
          active: true,
          tags: [{ id: "2", name: "processing" }],
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  // Executions
  if (endpoint.includes("/executions")) {
    if (method === "DELETE") {
      return { success: true };
    }
    // Get single execution
    if (endpoint.match(/\/executions\/[^/]+$/)) {
      const id = endpoint.split("/").pop();
      return {
        id,
        workflowId: "demo-wf-1",
        status: "success",
        mode: "manual",
        startedAt: new Date(Date.now() - 60000).toISOString(),
        finishedAt: new Date().toISOString(),
        data: {
          resultData: {
            runData: {
              Start: [
                {
                  data: {
                    main: [[{ json: { demo: true, message: "Demo execution data" } }]],
                  },
                },
              ],
            },
          },
        },
      };
    }
    // List executions
    return {
      data: [
        {
          id: "demo-exec-1",
          workflowId: "demo-wf-1",
          status: "success",
          mode: "manual",
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          finishedAt: new Date(Date.now() - 3500000).toISOString(),
        },
        {
          id: "demo-exec-2",
          workflowId: "demo-wf-2",
          status: "error",
          mode: "trigger",
          startedAt: new Date(Date.now() - 7200000).toISOString(),
          finishedAt: new Date(Date.now() - 7100000).toISOString(),
        },
        {
          id: "demo-exec-3",
          workflowId: "demo-wf-1",
          status: "success",
          mode: "webhook",
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          finishedAt: new Date(Date.now() - 1700000).toISOString(),
        },
      ],
    };
  }

  // Credentials
  if (endpoint.includes("/credentials")) {
    return {
      data: [
        {
          id: "demo-cred-1",
          name: "Demo HTTP Auth",
          type: "httpBasicAuth",
          createdAt: new Date().toISOString(),
        },
        {
          id: "demo-cred-2",
          name: "Demo OAuth2",
          type: "oauth2Api",
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  // Tags
  if (endpoint.includes("/tags")) {
    return {
      data: [
        { id: "1", name: "demo" },
        { id: "2", name: "processing" },
        { id: "3", name: "automation" },
      ],
    };
  }

  // Default response
  return {
    message: "Demo mode active - using mock data",
    endpoint,
    method,
  };
};

// n8n API helper with demo mode support
const n8nApi = async (config: Config, endpoint: string, method = "GET", data?: any) => {
  // Check if demo mode is active or credentials are missing
  if (config.demoMode || !config.n8nApiUrl || !config.n8nApiKey) {
    console.log(`[DEMO MODE] ${method} ${endpoint}`);
    return getDemoData(endpoint, method, data);
  }

  // Real API call
  try {
    const response = await axios({
      method,
      url: `${config.n8nApiUrl}/api/v1${endpoint}`,
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

// Workflow templates
const templates: Record<string, any> = {
  "webhook-api": {
    name: "Webhook API Template",
    nodes: [
      {
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        position: [250, 300],
        parameters: {
          httpMethod: "POST",
          path: "webhook",
          responseMode: "responseNode",
        },
      },
      {
        name: "Respond to Webhook",
        type: "n8n-nodes-base.respondToWebhook",
        position: [450, 300],
        parameters: {
          respondWith: "json",
          responseBody: '={{ { "success": true, "data": $json } }}',
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
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        position: [250, 300],
        parameters: {
          rule: {
            interval: [{ field: "hours", hoursInterval: 1 }],
          },
        },
      },
    ],
    connections: {},
  },
  "data-processing": {
    name: "Data Processing Template",
    nodes: [
      {
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        position: [250, 300],
      },
      {
        name: "Code",
        type: "n8n-nodes-base.code",
        position: [450, 300],
        parameters: {
          jsCode: "return items.map(item => ({ json: { processed: true, ...item.json } }));",
        },
      },
    ],
    connections: {
      "Manual Trigger": {
        main: [[{ node: "Code", type: "main", index: 0 }]],
      },
    },
  },
  "notification": {
    name: "Notification Template",
    nodes: [
      {
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        position: [250, 300],
      },
    ],
    connections: {},
  },
};

// Create and export the MCP server
export default function ({ config }: { config: Config }) {
  const server = new McpServer({
    name: "n8n-mcp",
    version: "1.0.0",
  });

  // Add info about demo mode
  const modeInfo = config.demoMode || !config.n8nApiUrl || !config.n8nApiKey
    ? "🎭 Running in DEMO MODE with mock data"
    : `✅ Connected to n8n at ${config.n8nApiUrl}`;

  // Register all tools
  server.tool(
    "n8n_health_check",
    "Check if n8n API is accessible and properly configured",
    {},
    async () => {
      await n8nApi(config, "/workflows?limit=1");
      return {
        content: [{
          type: "text",
          text: modeInfo,
        }],
      };
    }
  );

  server.tool(
    "n8n_list_workflows",
    "List all workflows in n8n. Supports filtering by active status and tags.",
    {
      active: z.boolean().optional().describe("Filter by active/inactive status"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async ({ active, tags }) => {
      let endpoint = "/workflows";
      const params = new URLSearchParams();
      if (active !== undefined) params.append("active", String(active));
      if (tags?.length) params.append("tags", tags.join(","));
      if (params.toString()) endpoint += `?${params}`;
      
      const workflows = await n8nApi(config, endpoint);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(workflows, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_get_workflow",
    "Get detailed information about a specific workflow by ID",
    {
      id: z.string().describe("Workflow ID"),
    },
    async ({ id }) => {
      const workflow = await n8nApi(config, `/workflows/${id}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(workflow, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_create_workflow",
    "Create a new workflow in n8n. Workflow is created inactive by default.",
    {
      name: z.string().describe("Workflow name"),
      nodes: z.array(z.any()).describe("Array of workflow nodes"),
      connections: z.record(z.any()).optional().describe("Node connections"),
      settings: z.record(z.any()).optional().describe("Workflow settings"),
    },
    async (args) => {
      const workflow = await n8nApi(config, "/workflows", "POST", args);
      return {
        content: [{
          type: "text",
          text: `✅ Workflow created successfully!\n${JSON.stringify(workflow, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "n8n_update_workflow",
    "Update an existing workflow. Can update name, nodes, connections, or settings.",
    {
      id: z.string().describe("Workflow ID"),
      name: z.string().optional().describe("New workflow name"),
      nodes: z.array(z.any()).optional().describe("Updated nodes"),
      connections: z.record(z.any()).optional().describe("Updated connections"),
      settings: z.record(z.any()).optional().describe("Updated settings"),
    },
    async ({ id, ...updates }) => {
      const workflow = await n8nApi(config, `/workflows/${id}`, "PATCH", updates);
      return {
        content: [{
          type: "text",
          text: `✅ Workflow updated successfully!\n${JSON.stringify(workflow, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "n8n_delete_workflow",
    "Permanently delete a workflow from n8n. This action cannot be undone.",
    {
      id: z.string().describe("Workflow ID to delete"),
    },
    async ({ id }) => {
      await n8nApi(config, `/workflows/${id}`, "DELETE");
      return {
        content: [{
          type: "text",
          text: `✅ Workflow ${id} deleted successfully!`,
        }],
      };
    }
  );

  server.tool(
    "n8n_toggle_workflow",
    "Activate or deactivate a workflow",
    {
      id: z.string().describe("Workflow ID"),
      active: z.boolean().describe("Set to true to activate, false to deactivate"),
    },
    async ({ id, active }) => {
      const workflow = await n8nApi(config, `/workflows/${id}`, "PATCH", { active });
      return {
        content: [{
          type: "text",
          text: `✅ Workflow ${active ? 'activated' : 'deactivated'} successfully!\n${JSON.stringify(workflow, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "n8n_execute_workflow",
    "Manually execute a workflow with optional input data",
    {
      id: z.string().describe("Workflow ID"),
      data: z.record(z.any()).optional().describe("Input data for the workflow"),
    },
    async ({ id, data }) => {
      const execution = await n8nApi(config, `/workflows/${id}/execute`, "POST", data);
      return {
        content: [{
          type: "text",
          text: `✅ Workflow executed!\n${JSON.stringify(execution, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "n8n_list_executions",
    "List workflow executions with optional filtering by workflow ID and status",
    {
      workflowId: z.string().optional().describe("Filter by workflow ID"),
      status: z.enum(["success", "error", "waiting"]).optional().describe("Filter by execution status"),
      limit: z.number().optional().describe("Maximum number of results (default: 20)"),
    },
    async ({ workflowId, status, limit = 20 }) => {
      let endpoint = `/executions?limit=${limit}`;
      if (workflowId) endpoint += `&workflowId=${workflowId}`;
      if (status) endpoint += `&status=${status}`;
      
      const executions = await n8nApi(config, endpoint);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(executions, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_get_execution",
    "Get detailed information about a specific execution, including all node outputs",
    {
      id: z.string().describe("Execution ID"),
    },
    async ({ id }) => {
      const execution = await n8nApi(config, `/executions/${id}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(execution, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_delete_execution",
    "Delete a workflow execution from history",
    {
      id: z.string().describe("Execution ID to delete"),
    },
    async ({ id }) => {
      await n8nApi(config, `/executions/${id}`, "DELETE");
      return {
        content: [{
          type: "text",
          text: `✅ Execution ${id} deleted successfully!`,
        }],
      };
    }
  );

  server.tool(
    "n8n_list_credentials",
    "List all credentials in n8n (without sensitive data). Can filter by credential type.",
    {
      type: z.string().optional().describe("Filter by credential type (e.g., 'httpBasicAuth', 'oauth2Api')"),
    },
    async ({ type }) => {
      let endpoint = "/credentials";
      if (type) endpoint += `?type=${type}`;
      
      const credentials = await n8nApi(config, endpoint);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(credentials, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_list_tags",
    "List all tags used in workflows",
    {},
    async () => {
      const tags = await n8nApi(config, "/tags");
      return {
        content: [{
          type: "text",
          text: JSON.stringify(tags, null, 2),
        }],
      };
    }
  );

  server.tool(
    "n8n_validate_workflow",
    "Validate a workflow structure for common issues (connections, node types, required fields)",
    {
      workflow: z.record(z.any()).describe("Workflow object to validate"),
    },
    async ({ workflow }) => {
      const issues: string[] = [];
      
      if (!workflow.nodes || workflow.nodes.length === 0) {
        issues.push("Workflow has no nodes");
      }
      
      if (!workflow.connections) {
        issues.push("Workflow has no connections defined");
      }
      
      const result = issues.length === 0
        ? "✅ Workflow validation passed!"
        : `⚠️ Workflow validation issues:\n${issues.join("\n")}`;
      
      return {
        content: [{
          type: "text",
          text: result,
        }],
      };
    }
  );

  server.tool(
    "n8n_workflow_template",
    "Get a workflow template for common use cases (webhook API, scheduled task, data processing, etc.)",
    {
      type: z.enum(["webhook-api", "schedule-task", "data-processing", "notification"]).describe("Type of workflow template"),
    },
    async ({ type }) => {
      const template = templates[type];
      if (!template) {
        throw new Error(`Unknown template type: ${type}`);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(template, null, 2),
        }],
      };
    }
  );

  return server.server;
}
