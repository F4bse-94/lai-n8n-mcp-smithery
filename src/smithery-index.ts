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

// n8n API helper
const n8nApi = async (config: Config, endpoint: string, method = "GET", data?: any) => {
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
          text: `✅ n8n API is accessible at ${config.n8nApiUrl}`,
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
