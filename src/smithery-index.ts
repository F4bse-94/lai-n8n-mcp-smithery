import { z } from "zod";

// Importiere die n8n Node-Datenbank Services
import { SQLiteStorageService } from "./services/sqlite-storage-service.js";
import { NodeSearchService } from "./services/node-search-service.js";

const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
});

export default async function createServer(context: { config: z.infer<typeof configSchema> }) {
  const storage = new SQLiteStorageService();
  const searchService = new NodeSearchService(storage);

  return {
    tools: {
      search_nodes: {
        description: "Search for n8n nodes by name, category, or functionality",
        parameters: z.object({
          query: z.string().describe("Search query for n8n nodes"),
          limit: z.number().optional().default(10).describe("Maximum number of results"),
        }),
        execute: async ({ query, limit }) => {
          const results = await searchService.searchNodes(query, limit);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        },
      },
      get_node_details: {
        description: "Get detailed information about a specific n8n node",
        parameters: z.object({
          nodeName: z.string().describe("Name of the n8n node"),
        }),
        execute: async ({ nodeName }) => {
          const node = await storage.getNode(nodeName);
          return {
            content: [
              {
                type: "text",
                text: node ? JSON.stringify(node, null, 2) : "Node not found",
              },
            ],
          };
        },
      },
    },
  };
}

export { configSchema };
