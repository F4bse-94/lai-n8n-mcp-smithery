# n8n MCP Server 🚀

Model Context Protocol (MCP) server for n8n workflow automation. Manage workflows, executions, credentials, and more directly from your AI assistant.

## Features ✨

### 🔧 Workflow Management
- **List workflows** with filtering (active/inactive, tags)
- **Create workflows** from templates or custom configurations
- **Update workflows** (full or partial updates)
- **Delete workflows** safely
- **Toggle workflows** (activate/deactivate)

### ⚡ Execution Management
- **Execute workflows** manually with custom input data
- **List executions** with status filtering
- **Get execution details** including all node outputs
- **Delete executions** to clean up history

### 🔐 Credentials & Tags
- **List credentials** by type
- **List tags** used in workflows

### ✅ Validation & Templates
- **Validate workflows** for common issues
- **Get node types** and documentation
- **Workflow templates** for quick starts:
  - Webhook API
  - Scheduled Tasks
  - Data Processing
  - Notifications

### 🎯 Smart Features
- **Health check** to verify API connectivity
- **Resources** for quick access to workflows and executions
- **Prompts** for interactive workflow creation and debugging

## Installation 📦

### Prerequisites
- Node.js 18+
- n8n instance (self-hosted or cloud)
- n8n API key

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/n8n-mcp.git
cd n8n-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Configure your MCP client:**

Add to your MCP settings (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/path/to/n8n-mcp/dist/index.js"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Configuration ⚙️

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_API_URL` | Your n8n instance URL | `https://n8n.example.com` |
| `N8N_API_KEY` | Your n8n API key | `n8n_api_xxxxx` |

### Getting your n8n API Key

1. Open your n8n instance
2. Go to **Settings** → **API**
3. Click **Create API Key**
4. Copy the key and add it to your configuration

## Available Tools 🛠️

### System Tools
- `n8n_health_check` - Check API connectivity and configuration

### Workflow Management
- `n8n_list_workflows` - List all workflows
- `n8n_get_workflow` - Get workflow details
- `n8n_create_workflow` - Create new workflow
- `n8n_update_workflow` - Update existing workflow
- `n8n_delete_workflow` - Delete workflow
- `n8n_toggle_workflow` - Activate/deactivate workflow

### Execution Management
- `n8n_execute_workflow` - Execute workflow manually
- `n8n_list_executions` - List workflow executions
- `n8n_get_execution` - Get execution details
- `n8n_delete_execution` - Delete execution

### Credentials & Tags
- `n8n_list_credentials` - List credentials
- `n8n_list_tags` - List tags

### Validation & Documentation
- `n8n_validate_workflow` - Validate workflow structure
- `n8n_get_node_types` - Get available node types
- `n8n_workflow_template` - Get workflow templates

## Usage Examples 💡

### Create a Webhook Workflow

```typescript
// Ask your AI assistant:
"Create a webhook workflow that receives POST requests and responds with JSON"

// The assistant will use:
// 1. n8n_workflow_template with type="webhook-api"
// 2. n8n_create_workflow with the template
// 3. n8n_toggle_workflow to activate it
```

### Debug a Workflow

```typescript
// Ask your AI assistant:
"Debug workflow abc123 and tell me what's wrong"

// The assistant will use:
// 1. n8n_get_workflow to fetch the workflow
// 2. n8n_validate_workflow to check for issues
// 3. Provide suggestions for fixes
```

### Monitor Executions

```typescript
// Ask your AI assistant:
"Show me failed executions from the last hour"

// The assistant will use:
// 1. n8n_list_executions with status="error"
// 2. n8n_get_execution for detailed error info
```

## Resources 📚

The MCP server provides two resources:

- `n8n://workflows` - List of all workflows
- `n8n://executions` - Recent workflow executions

Access these directly in your MCP client for quick reference.

## Prompts 🎯

### create-workflow
Interactive workflow creation assistant. Guides you through creating workflows step-by-step.

**Arguments:**
- `workflow_type` - Type of workflow (webhook-api, schedule-task, data-processing, notification)

### debug-workflow
Debug a workflow and find issues automatically.

**Arguments:**
- `workflow_id` - The workflow ID to debug

## Development 🔨

### Project Structure

```
n8n-mcp/
├── src/
│   ├── smithery-index.ts    # Main MCP server implementation
│   └── index.ts              # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Troubleshooting 🔍

### "Authentication failed - configuration is invalid"

**Solution:** Make sure your `N8N_API_URL` and `N8N_API_KEY` are correctly set in your MCP configuration.

### "n8n API credentials not configured"

**Solution:** Run `n8n_health_check` to verify your configuration. Add the required environment variables.

### "Failed to fetch .well-known/mcp-config"

**Solution:** This is normal during Smithery scanning. The server will work once properly configured.

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

MIT License - see LICENSE file for details

## Support 💬

- **Issues:** [GitHub Issues](https://github.com/yourusername/n8n-mcp/issues)
- **n8n Documentation:** [n8n.io/docs](https://docs.n8n.io)
- **MCP Documentation:** [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Acknowledgments 🙏

- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [n8n](https://n8n.io)
- Inspired by the MCP community

---

Made with ❤️ for the n8n and MCP communities
