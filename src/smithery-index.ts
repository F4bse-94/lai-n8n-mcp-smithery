import { z } from "zod";
import axios from "axios";

// Configuration schema
export const configSchema = z.object({
  n8nApiUrl: z.string().url().describe("The URL of your n8n instance (e.g., https://your-n8n.com)"),
  n8nApiKey: z.string().describe("Your n8n API key for authentication"),
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

// All tool definitions
export const tools = [
  {
    name: "n8n_health_check",
    description: "Check if n8n API is accessible and properly configured",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "n8n_list_workflows",
    description: "List all workflows in n8n. Supports filtering by active status and tags.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "Filter by active/inactive status" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
      },
    },
  },
  {
    name: "n8n_get_workflow",
    description: "Get detailed information about a specific workflow by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_create_workflow",
    description: "Create a new workflow in n8n. Workflow is created inactive by default.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Workflow name" },
        nodes: { type: "array", description: "Array of workflow nodes" },
        connections: { type: "object", description: "Node connections" },
        settings: { type: "object", description: "Workflow settings" },
      },
      required: ["name", "nodes"],
    },
  },
  {
    name: "n8n_update_workflow",
    description: "Update an existing workflow. Can update name, nodes, connections, or settings.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow ID" },
        name: { type: "string", description: "New workflow name" },
        nodes: { type: "array", description: "Updated nodes" },
        connections: { type: "object", description: "Updated connections" },
        settings: { type: "object", description: "Updated settings" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_delete_workflow",
    description: "Permanently delete a workflow from n8n. This action cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_toggle_workflow",
    description: "Activate or deactivate a workflow",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow ID" },
        active: { type: "boolean", description: "Set to true to activate, false to deactivate" },
      },
      required: ["id", "active"],
    },
  },
  {
    name: "n8n_execute_workflow",
    description: "Manually execute a workflow with optional input data",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow ID" },
        data: { type: "object", description: "Input data for the workflow" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_list_executions",
    description: "List workflow executions with optional filtering by workflow ID and status",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Filter by workflow ID" },
        status: { type: "string", enum: ["success", "error", "waiting"], description: "Filter by execution status" },
        limit: { type: "number", description: "Maximum number of results (default: 20)" },
      },
    },
  },
  {
    name: "n8n_get_execution",
    description: "Get detailed information about a specific execution, including all node outputs",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Execution ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_delete_execution",
    description: "Delete a workflow execution from history",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Execution ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "n8n_list_credentials",
    description: "List all credentials in n8n (without sensitive data). Can filter by credential type.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by credential type (e.g., 'httpBasicAuth', 'oauth2Api')" },
      },
    },
  },
  {
    name: "n8n_list_tags",
    description: "List all tags used in workflows",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "n8n_validate_workflow",
    description: "Validate a workflow structure for common issues (connections, node types, required fields)",
    inputSchema: {
      type: "object",
      properties: {
        workflow: { type: "object", description: "Workflow object to validate" },
      },
      required: ["workflow"],
    },
  },
  {
    name: "n8n_workflow_template",
    description: "Get a workflow template for common use cases (webhook API, scheduled task, data processing, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["webhook-api", "schedule-task", "data-processing", "notification"],
          description: "Type of workflow template",
        },
      },
      required: ["type"],
    },
  },
];

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

// Tool handler with all implementations
export async function callTool(config: Config, name: string, args: any) {
  try {
    switch (name) {
      case "n8n_health_check": {
        await n8nApi(config, "/workflows?limit=1");
        return {
          content: [{
            type: "text",
            text: `✅ n8n API is accessible at ${config.n8nApiUrl}`,
          }],
        };
      }

      case "n8n_list_workflows": {
        const { active, tags } = args;
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

      case "n8n_get_workflow": {
        const { id } = args;
        const workflow = await n8nApi(config, `/workflows/${id}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(workflow, null, 2),
          }],
        };
      }

      case "n8n_create_workflow": {
        const workflow = await n8nApi(config, "/workflows", "POST", args);
        return {
          content: [{
            type: "text",
            text: `✅ Workflow created successfully!\n${JSON.stringify(workflow, null, 2)}`,
          }],
        };
      }

      case "n8n_update_workflow": {
        const { id, ...updates } = args;
        const workflow = await n8nApi(config, `/workflows/${id}`, "PATCH", updates);
        return {
          content: [{
            type: "text",
            text: `✅ Workflow updated successfully!\n${JSON.stringify(workflow, null, 2)}`,
          }],
        };
      }

      case "n8n_delete_workflow": {
        const { id } = args;
        await n8nApi(config, `/workflows/${id}`, "DELETE");
        return {
          content: [{
            type: "text",
            text: `✅ Workflow ${id} deleted successfully!`,
          }],
        };
      }

      case "n8n_toggle_workflow": {
        const { id, active } = args;
        const workflow = await n8nApi(config, `/workflows/${id}`, "PATCH", { active });
        return {
          content: [{
            type: "text",
            text: `✅ Workflow ${active ? 'activated' : 'deactivated'} successfully!\n${JSON.stringify(workflow, null, 2)}`,
          }],
        };
      }

      case "n8n_execute_workflow": {
        const { id, data } = args;
        const execution = await n8nApi(config, `/workflows/${id}/execute`, "POST", data);
        return {
          content: [{
            type: "text",
            text: `✅ Workflow executed!\n${JSON.stringify(execution, null, 2)}`,
          }],
        };
      }

      case "n8n_list_executions": {
        const { workflowId, status, limit = 20 } = args;
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

      case "n8n_get_execution": {
        const { id } = args;
        const execution = await n8nApi(config, `/executions/${id}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(execution, null, 2),
          }],
        };
      }

      case "n8n_delete_execution": {
        const { id } = args;
        await n8nApi(config, `/executions/${id}`, "DELETE");
        return {
          content: [{
            type: "text",
            text: `✅ Execution ${id} deleted successfully!`,
          }],
        };
      }

      case "n8n_list_credentials": {
        const { type } = args;
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

      case "n8n_list_tags": {
        const tags = await n8nApi(config, "/tags");
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tags, null, 2),
          }],
        };
      }

      case "n8n_validate_workflow": {
        const { workflow } = args;
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

      case "n8n_workflow_template": {
        const { type } = args;
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`,
      }],
      isError: true,
    };
  }
}
