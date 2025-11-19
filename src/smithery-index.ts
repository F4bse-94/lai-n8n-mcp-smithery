import { z } from "zod";

const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
});

export default function createServer(context: { config: z.infer<typeof configSchema> }) {
  return {
    name: "n8n-mcp",
    version: "1.0.0",
    
    tools: {
      hello_n8n: {
        description: "A simple test tool to verify the n8n MCP server is working",
        parameters: z.object({
          message: z.string().describe("A message to echo back"),
        }),
        execute: async ({ message }: { message: string }) => {
          return {
            content: [
              {
                type: "text" as const,
                text: `Hello from n8n MCP! You said: ${message}`,
              },
            ],
          };
        },
      },
    },
  };
}

export { configSchema };
