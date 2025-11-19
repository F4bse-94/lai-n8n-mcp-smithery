import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Konfigurationsschema für n8n-Verbindung
export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional().describe("n8n API URL (optional)"),
  n8nApiKey: z.string().optional().describe("n8n API Key (optional)"),
});

export default function createServer({ config }) {
  const server = new McpServer({
    name: "n8n-mcp",
    version: "1.0.0",
  });

  // Beispiel-Tool (wird später durch echte Tools ersetzt)
  server.registerTool("hello", {
    title: "Hello Tool",
    description: "Test tool for Smithery",
    inputSchema: {
      name: z.string().describe("Name to greet"),
    },
  }, async ({ name }) => {
    return {
      content: [{ type: "text", text: `Hello from n8n-MCP, ${name}!` }],
    };
  });

  return server.server;
}
