import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";

export const configSchema = z.object({
  n8nApiUrl: z.string().url().describe("The URL of your n8n instance (e.g., https://your-n8n.com)"),
  n8nApiKey: z.string().describe("Your n8n API key for authentication"),
});

type Config = z.infer<typeof configSchema>;

export default function createServer({ config }: { config: Config }) {
  const server = new McpServer({
    name: "n8n-mcp",
    version: "1.0.0",
  });

  // Helper function to make n8n API calls
  const n8nApi = async (endpoint: string, method: string = "GET", data?: any) => {
    if (!config.n8nApiUrl || !config.n8nApiKey) {
      throw new Error("n8n API credentials not configured. Please provide n8nApiUrl and n8nApiKey.");
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

  // 1. List all workflows
  server.tool(
    "n8n_list_workflows",
    "List all workflows in your n8n instance",
    {
      active: z.boolean().optional().describe("Filter by active/inactive workflows"),
      tags: z.array(z.string()).optional().describe("Filter by workflow tags"),
    },
    async ({ active, tags }) => {
      const workflows = await n8nApi("/workflows");
      let filtered = workflows.data || workflows;

      if (active !== undefined) {
        filtered = filtered.filter((w: any) => w.active === active);
      }

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

  // 2. Get workflow details
  server.tool(
    "n8n_get_workflow",
    "Get detailed information about a specific workflow",
    {
      workflowId: z.string().describe("The ID of the workflow to retrieve"),
    },
    async ({ workflowId }) => {
      const workflow = await n8nApi(`/workflows/${workflowId}`);

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

  // 3. Create a new workflow
  server.tool(
    "n8n_create_workflow",
    "Create a new workflow in n8n",
    {
      name: z.string().describe("Name of the workflow"),
      nodes: z.array(z.any()).describe("Array of workflow nodes"),
      connections: z.record(z.any()).describe("Node connections object"),
      settings: z.record(z.any()).optional().describe("Workflow settings"),
      active: z.boolean().optional().describe("Whether the workflow should be active"),
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
            text: `Workflow created successfully! ID: ${result.id}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // 4. Update an existing workflow
  server.tool(
    "n8n_update_workflow",
    "Update an existing workflow",
    {
      workflowId: z.string().describe("The ID of the workflow to update"),
      name: z.string().optional().describe("New name for the workflow"),
      nodes: z.array(z.any()).optional().describe("Updated array of workflow nodes"),
      connections: z.record(z.any()).optional().describe("Updated node connections"),
      settings: z.record(z.any()).optional().describe("Updated workflow settings"),
      active: z.boolean().optional().describe("Whether the workflow should be active"),
    },
    async ({ workflowId, name, nodes, connections, settings, active }) => {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (nodes) updateData.nodes = nodes;
      if (connections) updateData.connections = connections;
      if (settings) updateData.settings = settings;
      if (active !== undefined) updateData.active = active;

      const result = await n8nApi(`/workflows/${workflowId}`, "PATCH", updateData);

      return {
        content: [
          {
            type: "text",
            text: `Workflow updated successfully!\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // 5. Delete a workflow
  server.tool(
    "n8n_delete_workflow",
    "Delete a workflow from n8n",
    {
      workflowId: z.string().describe("The ID of the workflow to delete"),
    },
    async ({ workflowId }) => {
      await n8nApi(`/workflows/${workflowId}`, "DELETE");

      return {
        content: [
          {
            type: "text",
            text: `Workflow ${workflowId} deleted successfully!`,
          },
        ],
      };
    }
  );

  // 6. Activate/Deactivate workflow
  server.tool(
    "n8n_toggle_workflow",
    "Activate or deactivate a workflow",
    {
      workflowId: z.string().describe("The ID of the workflow"),
      active: z.boolean().describe("Set to true to activate, false to deactivate"),
    },
    async ({ workflowId, active }) => {
      const result = await n8nApi(`/workflows/${workflowId}`, "PATCH", { active });

      return {
        content: [
          {
            type: "text",
            text: `Workflow ${active ? 'activated' : 'deactivated'} successfully!\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // 7. Execute a workflow
  server.tool(
    "n8n_execute_workflow",
    "Manually execute a workflow",
    {
      workflowId: z.string().describe("The ID of the workflow to execute"),
      data: z.record(z.any()).optional().describe("Input data for the workflow execution"),
    },
    async ({ workflowId, data }) => {
      const result = await n8nApi(`/workflows/${workflowId}/execute`, "POST", data || {});

      return {
        content: [
          {
            type: "text",
            text: `Workflow executed!\n\nExecution ID: ${result.executionId || result.id}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // 8. List executions
  server.tool(
    "n8n_list_executions",
    "List workflow executions",
    {
      workflowId: z.string().optional().describe("Filter by workflow ID"),
      status: z.enum(["success", "error", "waiting", "running"]).optional().describe("Filter by execution status"),
      limit: z.number().optional().describe("Maximum number of executions to return"),
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

  // 9. Get execution details
  server.tool(
    "n8n_get_execution",
    "Get detailed information about a specific execution",
    {
      executionId: z.string().describe("The ID of the execution to retrieve"),
    },
    async ({ executionId }) => {
      const execution = await n8nApi(`/executions/${executionId}`);

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

  // 10. Delete an execution
  server.tool(
    "n8n_delete_execution",
    "Delete an execution from n8n",
    {
      executionId: z.string().describe("The ID of the execution to delete"),
    },
    async ({ executionId }) => {
      await n8nApi(`/executions/${executionId}`, "DELETE");

      return {
        content: [
          {
            type: "text",
            text: `Execution ${executionId} deleted successfully!`,
          },
        ],
      };
    }
  );

  // 11. List credentials
  server.tool(
    "n8n_list_credentials",
    "List all credentials in your n8n instance",
    {
      type: z.string().optional().describe("Filter by credential type"),
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

  // 12. Get workflow tags
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

  return server.server;
}
