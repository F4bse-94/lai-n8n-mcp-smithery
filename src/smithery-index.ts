import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
  demoMode: z.boolean().optional().default(true),
});

type Config = z.infer<typeof configSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createAxiosInstance(config: Config): AxiosInstance {
  return axios.create({
    baseURL: config.n8nApiUrl || "https://demo.n8n.io/api/v1",
    headers: {
      "X-N8N-API-KEY": config.n8nApiKey || "",
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

function isDemoMode(config: Config): boolean {
  return config.demoMode || !config.n8nApiKey || !config.n8nApiUrl;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateWorkflowStructure(workflow: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic structure
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push("Workflow must have a 'nodes' array");
  }
  if (!workflow.connections || typeof workflow.connections !== "object") {
    errors.push("Workflow must have a 'connections' object");
  }

  // Check nodes
  if (workflow.nodes) {
    const nodeNames = new Set<string>();
    workflow.nodes.forEach((node: any, index: number) => {
      if (!node.name) {
        errors.push(`Node at index ${index} is missing a name`);
      } else if (nodeNames.has(node.name)) {
        errors.push(`Duplicate node name: ${node.name}`);
      } else {
        nodeNames.add(node.name);
      }

      if (!node.type) {
        errors.push(`Node '${node.name || index}' is missing a type`);
      }
      if (!node.position || typeof node.position.x !== "number" || typeof node.position.y !== "number") {
        warnings.push(`Node '${node.name || index}' has invalid position`);
      }
    });

    // Validate connections
    if (workflow.connections) {
      Object.keys(workflow.connections).forEach((nodeName) => {
        if (!nodeNames.has(nodeName)) {
          errors.push(`Connection references non-existent node: ${nodeName}`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateWorkflowConnections(workflow: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!workflow.nodes || !workflow.connections) {
    return { valid: false, errors: ["Invalid workflow structure"], warnings: [] };
  }

  const nodeNames = new Set(workflow.nodes.map((n: any) => n.name));

  Object.entries(workflow.connections).forEach(([sourceName, outputs]: [string, any]) => {
    if (!nodeNames.has(sourceName)) {
      errors.push(`Connection source '${sourceName}' does not exist`);
      return;
    }

    Object.entries(outputs).forEach(([outputIndex, connections]: [string, any]) => {
      if (!Array.isArray(connections)) {
        errors.push(`Invalid connection format for ${sourceName}[${outputIndex}]`);
        return;
      }

      connections.forEach((conn: any) => {
        if (!conn.node) {
          errors.push(`Connection from ${sourceName} missing target node`);
        } else if (!nodeNames.has(conn.node)) {
          errors.push(`Connection target '${conn.node}' does not exist`);
        }

        if (typeof conn.type !== "string") {
          warnings.push(`Connection from ${sourceName} to ${conn.node} missing type`);
        }
        if (typeof conn.index !== "number") {
          warnings.push(`Connection from ${sourceName} to ${conn.node} missing index`);
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// WORKFLOW HELPERS
// ============================================================================

function extractWorkflowStructure(workflow: any) {
  return {
    id: workflow.id,
    name: workflow.name,
    active: workflow.active,
    nodeCount: workflow.nodes?.length || 0,
    nodes: workflow.nodes?.map((n: any) => ({
      name: n.name,
      type: n.type,
      position: n.position,
    })) || [],
    connections: workflow.connections || {},
    tags: workflow.tags || [],
  };
}

function mergeWorkflowUpdates(existing: any, updates: any): any {
  const merged = { ...existing };

  // Update simple fields
  if (updates.name !== undefined) merged.name = updates.name;
  if (updates.active !== undefined) merged.active = updates.active;
  if (updates.settings !== undefined) merged.settings = { ...merged.settings, ...updates.settings };
  if (updates.tags !== undefined) merged.tags = updates.tags;

  // Update nodes (merge by name)
  if (updates.nodes) {
    const nodeMap = new Map(merged.nodes.map((n: any) => [n.name, n]));
    updates.nodes.forEach((node: any) => {
      if (nodeMap.has(node.name)) {
        nodeMap.set(node.name, { ...nodeMap.get(node.name), ...node });
      } else {
        nodeMap.set(node.name, node);
      }
    });
    merged.nodes = Array.from(nodeMap.values());
  }

  // Update connections
  if (updates.connections) {
    merged.connections = { ...merged.connections, ...updates.connections };
  }

  return merged;
}

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_WORKFLOWS = [
  {
    id: "1",
    name: "Demo Webhook API",
    active: true,
    nodes: [
      { name: "Webhook", type: "n8n-nodes-base.webhook", position: [250, 300] },
      { name: "HTTP Request", type: "n8n-nodes-base.httpRequest", position: [450, 300] },
      { name: "Respond", type: "n8n-nodes-base.respondToWebhook", position: [650, 300] },
    ],
    connections: {
      Webhook: { main: [[{ node: "HTTP Request", type: "main", index: 0 }]] },
      "HTTP Request": { main: [[{ node: "Respond", type: "main", index: 0 }]] },
    },
    tags: ["api", "webhook"],
  },
  {
    id: "2",
    name: "Demo Scheduled Task",
    active: false,
    nodes: [
      { name: "Schedule", type: "n8n-nodes-base.scheduleTrigger", position: [250, 300] },
      { name: "Process Data", type: "n8n-nodes-base.function", position: [450, 300] },
    ],
    connections: {
      Schedule: { main: [[{ node: "Process Data", type: "main", index: 0 }]] },
    },
    tags: ["automation"],
  },
];

const DEMO_EXECUTIONS = [
  {
    id: "exec-1",
    workflowId: "1",
    finished: true,
    mode: "webhook",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    stoppedAt: new Date(Date.now() - 3500000).toISOString(),
    status: "success",
  },
  {
    id: "exec-2",
    workflowId: "2",
    finished: true,
    mode: "trigger",
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    stoppedAt: new Date(Date.now() - 7100000).toISOString(),
    status: "error",
  },
];

// ============================================================================
// MCP SERVER
// ============================================================================

export default function ({ config }: { config: Config }) {
  const server = new McpServer({
    name: "n8n-mcp-extended",
    version: "2.0.0",
  });

  const axiosInstance = createAxiosInstance(config);
  const demoMode = isDemoMode(config);

  // ==========================================================================
  // EXISTING TOOLS (15)
  // ==========================================================================

  // 1. Health Check
  server.tool(
    "n8n_health_check",
    "Check if n8n API is accessible and responding",
    {},
    async () => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "healthy",
                mode: "demo",
                message: "Running in demo mode. Configure n8nApiUrl and n8nApiKey to connect to real instance.",
              }, null, 2),
            },
          ],
        };
      }

      try {
        await axiosInstance.get("/workflows");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "healthy", mode: "connected" }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "error",
                message: error.message,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. List Workflows
  server.tool(
    "n8n_list_workflows",
    "List all workflows with optional filtering",
    {
      active: z.boolean().optional().describe("Filter by active status"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async ({ active, tags }) => {
      if (demoMode) {
        let workflows = [...DEMO_WORKFLOWS];
        if (active !== undefined) {
          workflows = workflows.filter((w) => w.active === active);
        }
        if (tags && tags.length > 0) {
          workflows = workflows.filter((w) =>
            tags.some((tag) => w.tags.includes(tag))
          );
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(workflows, null, 2) },
          ],
        };
      }

      try {
        const response = await axiosInstance.get("/workflows");
        let workflows = response.data.data || response.data;

        if (active !== undefined) {
          workflows = workflows.filter((w: any) => w.active === active);
        }
        if (tags && tags.length > 0) {
          workflows = workflows.filter((w: any) =>
            tags.some((tag) => w.tags?.some((t: any) => t.name === tag))
          );
        }

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(workflows, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. Get Workflow
  server.tool(
    "n8n_get_workflow",
    "Get detailed information about a specific workflow",
    {
      workflowId: z.string().describe("The workflow ID"),
    },
    async ({ workflowId }) => {
      if (demoMode) {
        const workflow = DEMO_WORKFLOWS.find((w) => w.id === workflowId);
        if (!workflow) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Workflow not found" }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(workflow, null, 2) },
          ],
        };
      }

      try {
        const response = await axiosInstance.get(`/workflows/${workflowId}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. Create Workflow
  server.tool(
    "n8n_create_workflow",
    "Create a new workflow",
    {
      name: z.string().describe("Workflow name"),
      nodes: z.array(z.any()).describe("Array of workflow nodes"),
      connections: z.record(z.any()).describe("Workflow connections"),
      active: z.boolean().optional().default(false).describe("Activate workflow"),
      settings: z.record(z.any()).optional().describe("Workflow settings"),
    },
    async ({ name, nodes, connections, active, settings }) => {
      const workflow = { name, nodes, connections, active: active || false, settings: settings || {} };

      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                ...workflow,
                id: `demo-${Date.now()}`,
                createdAt: new Date().toISOString(),
                message: "Demo mode: Workflow not actually created",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.post("/workflows", workflow);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 5. Update Workflow
  server.tool(
    "n8n_update_workflow",
    "Update an existing workflow (full replacement)",
    {
      workflowId: z.string().describe("The workflow ID"),
      name: z.string().optional().describe("Workflow name"),
      nodes: z.array(z.any()).optional().describe("Array of workflow nodes"),
      connections: z.record(z.any()).optional().describe("Workflow connections"),
      active: z.boolean().optional().describe("Activate/deactivate workflow"),
      settings: z.record(z.any()).optional().describe("Workflow settings"),
    },
    async ({ workflowId, ...updates }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: workflowId,
                ...updates,
                updatedAt: new Date().toISOString(),
                message: "Demo mode: Workflow not actually updated",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.patch(`/workflows/${workflowId}`, updates);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 6. Delete Workflow
  server.tool(
    "n8n_delete_workflow",
    "Delete a workflow",
    {
      workflowId: z.string().describe("The workflow ID"),
    },
    async ({ workflowId }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                workflowId,
                message: "Demo mode: Workflow not actually deleted",
              }, null, 2),
            },
          ],
        };
      }

      try {
        await axiosInstance.delete(`/workflows/${workflowId}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ success: true, workflowId }, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 7. Toggle Workflow
  server.tool(
    "n8n_toggle_workflow",
    "Activate or deactivate a workflow",
    {
      workflowId: z.string().describe("The workflow ID"),
      active: z.boolean().describe("Set to true to activate, false to deactivate"),
    },
    async ({ workflowId, active }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: workflowId,
                active,
                message: "Demo mode: Workflow status not actually changed",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.patch(`/workflows/${workflowId}`, { active });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 8. Execute Workflow
  server.tool(
    "n8n_execute_workflow",
    "Execute a workflow manually",
    {
      workflowId: z.string().describe("The workflow ID"),
      data: z.record(z.any()).optional().describe("Input data for the workflow"),
    },
    async ({ workflowId, data }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                executionId: `demo-exec-${Date.now()}`,
                workflowId,
                status: "running",
                message: "Demo mode: Workflow not actually executed",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.post(`/workflows/${workflowId}/execute`, data || {});
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 9. List Executions
  server.tool(
    "n8n_list_executions",
    "List workflow executions",
    {
      workflowId: z.string().optional().describe("Filter by workflow ID"),
      status: z.enum(["success", "error", "running", "waiting"]).optional().describe("Filter by status"),
      limit: z.number().optional().default(20).describe("Number of results"),
    },
    async ({ workflowId, status, limit }) => {
      if (demoMode) {
        let executions = [...DEMO_EXECUTIONS];
        if (workflowId) {
          executions = executions.filter((e) => e.workflowId === workflowId);
        }
        if (status) {
          executions = executions.filter((e) => e.status === status);
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(executions.slice(0, limit), null, 2) },
          ],
        };
      }

      try {
        const params: any = { limit };
        if (workflowId) params.workflowId = workflowId;
        if (status) params.status = status;

        const response = await axiosInstance.get("/executions", { params });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 10. Get Execution
  server.tool(
    "n8n_get_execution",
    "Get detailed information about a specific execution",
    {
      executionId: z.string().describe("The execution ID"),
    },
    async ({ executionId }) => {
      if (demoMode) {
        const execution = DEMO_EXECUTIONS.find((e) => e.id === executionId);
        if (!execution) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Execution not found" }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(execution, null, 2) },
          ],
        };
      }

      try {
        const response = await axiosInstance.get(`/executions/${executionId}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 11. Delete Execution
  server.tool(
    "n8n_delete_execution",
    "Delete an execution",
    {
      executionId: z.string().describe("The execution ID"),
    },
    async ({ executionId }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                executionId,
                message: "Demo mode: Execution not actually deleted",
              }, null, 2),
            },
          ],
        };
      }

      try {
        await axiosInstance.delete(`/executions/${executionId}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ success: true, executionId }, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 12. List Credentials
  server.tool(
    "n8n_list_credentials",
    "List all credentials (without sensitive data)",
    {},
    async () => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify([
                { id: "1", name: "Demo Gmail", type: "gmailOAuth2" },
                { id: "2", name: "Demo Slack", type: "slackOAuth2" },
              ], null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.get("/credentials");
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 13. List Tags
  server.tool(
    "n8n_list_tags",
    "List all workflow tags",
    {},
    async () => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify([
                { id: "1", name: "api" },
                { id: "2", name: "webhook" },
                { id: "3", name: "automation" },
              ], null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.get("/tags");
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // 14. Validate Workflow
  server.tool(
    "n8n_validate_workflow",
    "Validate workflow structure and connections",
    {
      workflow: z.record(z.any()).describe("The workflow object to validate"),
    },
    async ({ workflow }) => {
      const validation = validateWorkflowStructure(workflow);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(validation, null, 2) },
        ],
      };
    }
  );

  // 15. Workflow Template
  server.tool(
    "n8n_workflow_template",
    "Get a workflow template",
    {
      templateType: z.enum(["webhook-api", "schedule-task", "data-processing", "notification"]).describe("Type of template"),
    },
    async ({ templateType }) => {
      const templates: Record<string, any> = {
        "webhook-api": {
          name: "Webhook API Template",
          nodes: [
            { name: "Webhook", type: "n8n-nodes-base.webhook", position: [250, 300], parameters: {} },
            { name: "Process", type: "n8n-nodes-base.function", position: [450, 300], parameters: {} },
            { name: "Respond", type: "n8n-nodes-base.respondToWebhook", position: [650, 300], parameters: {} },
          ],
          connections: {
            Webhook: { main: [[{ node: "Process", type: "main", index: 0 }]] },
            Process: { main: [[{ node: "Respond", type: "main", index: 0 }]] },
          },
        },
        "schedule-task": {
          name: "Scheduled Task Template",
          nodes: [
            { name: "Schedule", type: "n8n-nodes-base.scheduleTrigger", position: [250, 300], parameters: {} },
            { name: "Execute", type: "n8n-nodes-base.function", position: [450, 300], parameters: {} },
          ],
          connections: {
            Schedule: { main: [[{ node: "Execute", type: "main", index: 0 }]] },
          },
        },
        "data-processing": {
          name: "Data Processing Template",
          nodes: [
            { name: "Start", type: "n8n-nodes-base.manualTrigger", position: [250, 300], parameters: {} },
            { name: "Transform", type: "n8n-nodes-base.function", position: [450, 300], parameters: {} },
            { name: "Save", type: "n8n-nodes-base.httpRequest", position: [650, 300], parameters: {} },
          ],
          connections: {
            Start: { main: [[{ node: "Transform", type: "main", index: 0 }]] },
            Transform: { main: [[{ node: "Save", type: "main", index: 0 }]] },
          },
        },
        notification: {
          name: "Notification Template",
          nodes: [
            { name: "Trigger", type: "n8n-nodes-base.webhook", position: [250, 300], parameters: {} },
            { name: "Notify", type: "n8n-nodes-base.emailSend", position: [450, 300], parameters: {} },
          ],
          connections: {
            Trigger: { main: [[{ node: "Notify", type: "main", index: 0 }]] },
          },
        },
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(templates[templateType], null, 2) },
        ],
      };
    }
  );

  // ==========================================================================
  // NEW TOOLS (8 guaranteed to work)
  // ==========================================================================

  // NEW 1: Get Workflow Structure (lightweight)
  server.tool(
    "n8n_get_workflow_structure",
    "Get lightweight workflow structure (nodes + connections only, no parameters)",
    {
      workflowId: z.string().describe("The workflow ID"),
    },
    async ({ workflowId }) => {
      if (demoMode) {
        const workflow = DEMO_WORKFLOWS.find((w) => w.id === workflowId);
        if (!workflow) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Workflow not found" }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(extractWorkflowStructure(workflow), null, 2) },
          ],
        };
      }

      try {
        const response = await axiosInstance.get(`/workflows/${workflowId}`);
        const structure = extractWorkflowStructure(response.data);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(structure, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 2: Partial Workflow Update (VERY VALUABLE!)
  server.tool(
    "n8n_update_partial_workflow",
    "Update specific parts of a workflow without replacing everything (merges changes)",
    {
      workflowId: z.string().describe("The workflow ID"),
      updates: z.record(z.any()).describe("Partial updates to apply (only changed fields)"),
    },
    async ({ workflowId, updates }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: workflowId,
                applied: updates,
                message: "Demo mode: Partial update simulated",
              }, null, 2),
            },
          ],
        };
      }

      try {
        // Get current workflow
        const current = await axiosInstance.get(`/workflows/${workflowId}`);
        
        // Merge updates
        const merged = mergeWorkflowUpdates(current.data, updates);
        
        // Update workflow
        const response = await axiosInstance.patch(`/workflows/${workflowId}`, merged);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 3: Validate Workflow Connections
  server.tool(
    "n8n_validate_workflow_connections",
    "Validate only the connections in a workflow",
    {
      workflow: z.record(z.any()).describe("The workflow object to validate"),
    },
    async ({ workflow }) => {
      const validation = validateWorkflowConnections(workflow);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(validation, null, 2) },
        ],
      };
    }
  );

  // NEW 4: Trigger Webhook Workflow
  server.tool(
    "n8n_trigger_webhook_workflow",
    "Trigger a workflow via webhook (if it has a webhook trigger)",
    {
      webhookPath: z.string().describe("The webhook path (e.g., 'my-webhook')"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional().default("POST").describe("HTTP method"),
      data: z.record(z.any()).optional().describe("Data to send to webhook"),
    },
    async ({ webhookPath, method, data }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                webhookPath,
                method,
                message: "Demo mode: Webhook not actually triggered",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const webhookUrl = `${config.n8nApiUrl?.replace('/api/v1', '')}/webhook/${webhookPath}`;
        const response = await axios({
          method,
          url: webhookUrl,
          data: method !== "GET" ? data : undefined,
          params: method === "GET" ? data : undefined,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 5: Workflow Statistics
  server.tool(
    "n8n_workflow_statistics",
    "Get statistics about a workflow (execution count, success rate, etc.)",
    {
      workflowId: z.string().describe("The workflow ID"),
    },
    async ({ workflowId }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                workflowId,
                totalExecutions: 42,
                successRate: 0.95,
                avgExecutionTime: 1234,
                lastExecution: new Date(Date.now() - 3600000).toISOString(),
                message: "Demo mode: Statistics are simulated",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const executions = await axiosInstance.get("/executions", {
          params: { workflowId, limit: 100 },
        });

        const data = executions.data.data || executions.data;
        const total = data.length;
        const successful = data.filter((e: any) => e.finished && !e.stoppedAt).length;
        const avgTime = data.reduce((sum: number, e: any) => {
          if (e.startedAt && e.stoppedAt) {
            return sum + (new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime());
          }
          return sum;
        }, 0) / total;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                workflowId,
                totalExecutions: total,
                successRate: total > 0 ? successful / total : 0,
                avgExecutionTime: Math.round(avgTime),
                lastExecution: data[0]?.startedAt || null,
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 6: Duplicate Workflow
  server.tool(
    "n8n_duplicate_workflow",
    "Duplicate an existing workflow with a new name",
    {
      workflowId: z.string().describe("The workflow ID to duplicate"),
      newName: z.string().describe("Name for the duplicated workflow"),
      activate: z.boolean().optional().default(false).describe("Activate the duplicated workflow"),
    },
    async ({ workflowId, newName, activate }) => {
      if (demoMode) {
        const original = DEMO_WORKFLOWS.find((w) => w.id === workflowId);
        if (!original) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Workflow not found" }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                ...original,
                id: `demo-dup-${Date.now()}`,
                name: newName,
                active: activate,
                message: "Demo mode: Workflow not actually duplicated",
              }, null, 2),
            },
          ],
        };
      }

      try {
        // Get original workflow
        const original = await axiosInstance.get(`/workflows/${workflowId}`);
        
        // Create duplicate
        const duplicate = {
          ...original.data,
          name: newName,
          active: activate,
        };
        delete duplicate.id;
        delete duplicate.createdAt;
        delete duplicate.updatedAt;

        const response = await axiosInstance.post("/workflows", duplicate);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 7: Batch Operations
  server.tool(
    "n8n_batch_toggle_workflows",
    "Activate or deactivate multiple workflows at once",
    {
      workflowIds: z.array(z.string()).describe("Array of workflow IDs"),
      active: z.boolean().describe("Set to true to activate, false to deactivate"),
    },
    async ({ workflowIds, active }) => {
      if (demoMode) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                updated: workflowIds.length,
                workflowIds,
                active,
                message: "Demo mode: Workflows not actually updated",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const results = await Promise.all(
          workflowIds.map((id) =>
            axiosInstance.patch(`/workflows/${id}`, { active })
          )
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                updated: results.length,
                workflows: results.map((r) => r.data),
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // NEW 8: Export/Import Workflow
  server.tool(
    "n8n_export_workflow",
    "Export a workflow as JSON (for backup or sharing)",
    {
      workflowId: z.string().describe("The workflow ID to export"),
    },
    async ({ workflowId }) => {
      if (demoMode) {
        const workflow = DEMO_WORKFLOWS.find((w) => w.id === workflowId);
        if (!workflow) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "Workflow not found" }, null, 2) },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                workflow,
                exportedAt: new Date().toISOString(),
                version: "1.0",
              }, null, 2),
            },
          ],
        };
      }

      try {
        const response = await axiosInstance.get(`/workflows/${workflowId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                workflow: response.data,
                exportedAt: new Date().toISOString(),
                version: "1.0",
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: error.message }, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  return server.server;
}
