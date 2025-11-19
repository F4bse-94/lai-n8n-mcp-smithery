import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
});

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: "n8n-mcp",
    version: "1.0.0",
  });

  // Add a simple test tool
  server.tool(
    "hello_n8n",
    "A simple test tool to verify the n8n MCP server is working",
    {
      message: z.string().describe("A message to echo back"),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello from n8n MCP! You said: ${message}`,
          },
        ],
      };
    }
  );

  return server.server;
}
