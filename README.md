# Caddy MCP Server

A Model Context Protocol (MCP) server for Caddy web server management and plugin development.

## Getting Started

### Quick Start with Claude Code

1. **Clone and setup the server:**
   ```bash
   git clone https://github.com/Cabooman/caddy-mcp.git
   cd caddy-mcp
   npm install
   npm run build
   ```

2. **Install xcaddy (required for plugin building):**
   ```bash
   go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
   ```

3. **Add to your Claude Code MCP configuration:**
   ```json
   {
     "mcpServers": {
       "caddy": {
         "command": "node",
         "args": ["/path/to/caddy-mcp/dist/index.js"]
       }
     }
   }
   ```

4. **Try it out in Claude Code:**
   - Ask Claude to "create a simple hello world Caddy plugin"
   - Watch as it uses the MCP tools to generate, build, and configure your plugin
   - Test the example visitor-counter plugin in `examples/`

### First Plugin in 30 Seconds

Once connected to Claude Code, try this:
> "Create a Caddy plugin called 'hello' that adds a custom header to all requests"

Claude will:
1. Generate the complete plugin structure
2. Show you how to build it with xcaddy
3. Provide a working Caddyfile configuration
4. Explain how to test it locally

## Features

### Plugin Development Tools
- **caddy_create_plugin**: Create new Caddy plugins with proper Go module structure
- **caddy_build_plugin**: Build Caddy with custom plugins using xcaddy
- **caddy_dev_server**: Start development server with plugin for testing

### Production Deployment Tools
- **caddy_deploy_plugin**: Safely deploy plugins to production with automatic backup
- **caddy_backup_list**: Manage Caddy binary backups (backup, restore, list)
- **caddy_validate_config**: Validate Caddy configuration files

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Install xcaddy (required for plugin building):
```bash
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
```

## Usage

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "caddy": {
      "command": "node",
      "args": ["/path/to/caddy-mcp-server/dist/index.js"]
    }
  }
}
```

### Plugin Development Workflow

1. **Create a new plugin**:
   ```
   caddy_create_plugin:
   - name: "myplugin"
   - directory: "./plugins"
   - module_path: "github.com/user/myplugin"
   - description: "My custom Caddy plugin"
   ```

2. **Build Caddy with your plugin**:
   ```
   caddy_build_plugin:
   - plugin_path: "./plugins/myplugin"
   - output_path: "./caddy-custom"
   ```

3. **Start development server**:
   ```
   caddy_dev_server:
   - caddy_binary: "./caddy-custom"
   - config_file: "./Caddyfile"
   - port: 8080
   ```

## Tool Reference

### caddy_create_plugin

Creates a new Caddy plugin with proper Go module structure.

**Parameters:**
- `name` (required): Plugin name
- `directory` (required): Directory where plugin should be created
- `module_path` (required): Go module path (e.g., github.com/user/plugin)
- `description`: Plugin description
- `author`: Plugin author (default: "Claude Code")

**Generated files:**
- `main.go`: Main entry point
- `plugin.go`: Plugin implementation with middleware handler
- `go.mod`: Go module file
- `README.md`: Documentation
- `Caddyfile.example`: Example configuration

### caddy_build_plugin

Builds Caddy with a custom plugin using xcaddy.

**Parameters:**
- `plugin_path` (required): Path to the plugin directory
- `output_path`: Output path for the built Caddy binary (default: "./caddy")
- `caddy_version`: Caddy version to build with (default: "latest")

**Requirements:**
- xcaddy must be installed
- Plugin directory must contain valid go.mod file

### caddy_dev_server

Starts a Caddy development server with the custom plugin.

**Parameters:**
- `caddy_binary`: Path to the Caddy binary with plugin (default: "./caddy")
- `config_file`: Path to Caddyfile or JSON config
- `port`: Port to run the server on (default: 8080)
- `admin_port`: Admin API port (default: 2019)

### caddy_deploy_plugin

Safely deploy a plugin to production by building and replacing the Caddy binary with automatic backup.

**Parameters:**
- `plugin_path` (required): Path to the plugin directory to deploy
- `caddy_binary`: Path to current Caddy binary to replace (default: "/usr/bin/caddy")
- `backup_dir`: Directory to store backup of current binary (default: "/opt/caddy/backups")
- `validate_config`: Path to Caddyfile to validate with new binary

**Safety features:**
- Automatically backs up current binary with timestamp
- Validates configuration before deployment (if config provided)
- Builds new binary with plugin using xcaddy
- Provides clear restart instructions

### caddy_backup_list

Manage Caddy binary backups for safe rollbacks.

**Parameters:**
- `action` (required): "backup", "restore", or "list"
- `caddy_binary`: Path to Caddy binary (default: "/usr/bin/caddy")
- `backup_dir`: Directory containing backups (default: "/opt/caddy/backups")
- `restore_name`: Name of backup to restore (required for restore action)

**Actions:**
- **backup**: Create timestamped backup of current binary
- **list**: Show all available backups with dates and sizes
- **restore**: Restore from specific backup

### caddy_validate_config

Validate Caddy configuration file syntax.

**Parameters:**
- `config_file` (required): Path to Caddyfile or JSON config to validate
- `caddy_binary`: Path to Caddy binary to use for validation (default: "caddy")

**Features:**
- Tests configuration syntax without starting server
- Works with custom Caddy binaries (with plugins)
- Shows detailed error messages for invalid configs

## Production Deployment Workflow

### Deploying a Plugin to Homelab

1. **Develop and test your plugin:**
   ```
   caddy_create_plugin: Create plugin structure
   caddy_build_plugin: Build and test locally
   caddy_dev_server: Test with development server
   ```

2. **Validate before deployment:**
   ```
   caddy_validate_config:
   - config_file: "/etc/caddy/Caddyfile"
   - caddy_binary: "./caddy-with-plugin"
   ```

3. **Deploy safely:**
   ```
   caddy_deploy_plugin:
   - plugin_path: "./my-plugin" 
   - caddy_binary: "/usr/bin/caddy"
   - backup_dir: "/opt/caddy/backups"
   - validate_config: "/etc/caddy/Caddyfile"
   ```

4. **Restart Caddy service:**
   ```bash
   sudo systemctl restart caddy
   # OR
   docker-compose restart caddy
   ```

5. **If something goes wrong:**
   ```
   caddy_backup_list:
   - action: "list"  # Find the backup to restore
   
   caddy_backup_list:
   - action: "restore"
   - restore_name: "caddy-backup-2024-08-22T10-30-00-000Z"
   ```

## Plugin Template

The generated plugin template includes:

- **HTTP middleware handler**: Processes HTTP requests
- **Caddyfile directive**: Configurable via Caddyfile
- **JSON configuration**: Supports JSON config format
- **Proper interfaces**: Implements Caddy's provisioner, validator, and unmarshaler interfaces

Example usage in Caddyfile:
```
example.com {
    myplugin {
        message "Hello from my plugin!"
    }
    respond "Server is running"
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with watch
npm run dev

# Start server
npm start

# Run tests
npm test
```

## Examples

See the `examples/` directory for sample Caddy plugins:
- **visitor-counter**: A plugin that counts and displays website visitors

## Requirements

- Node.js 18+
- Go 1.21+
- xcaddy (for building plugins)

## License

MIT