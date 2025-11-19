import { z } from "zod";

export const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
});

export default function createServer() {
  return {
    tools: [
      {
        name: "hello_n8n",
        description: "A simple test tool to verify the n8n MCP server is working",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "A message to echo back",
            },
          },
          required: ["message"],
        },
        execute: async (args: { message: string }) => {
          return {
            content: [
              {
                type: "text",
                text: `Hello from n8n MCP! You said: ${args.message}`,
              },
            ],
          };
        },
      },
    ],
  };
}
