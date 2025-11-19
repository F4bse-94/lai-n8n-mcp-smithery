import { z } from "zod";

const configSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
});

export default async function createServer(context: { config: z.infer<typeof configSchema> }) {
  return {
    tools: {
      hello_n8n: {
        description: "A simple test tool to verify the n8n MCP server is working",
        parameters: z.object({
          message: z.string().describe("A message to echo back"),
        }),
        execute: async ({ message }) => {
          return {
            content: [
              {
                type: "text",
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
