# Test Plugin Development Workflow

This document demonstrates the core plugin development workflow using the Caddy MCP server.

## Test Scenario: Create a "hello" plugin

### Step 1: Create Plugin
Use the `caddy_create_plugin` tool:
- name: "hello"
- directory: "./test-plugins"
- module_path: "github.com/example/hello"
- description: "A simple hello world plugin"

### Step 2: Build Plugin
Use the `caddy_build_plugin` tool:
- plugin_path: "./test-plugins/hello"
- output_path: "./caddy-hello"

### Step 3: Start Dev Server
Use the `caddy_dev_server` tool:
- caddy_binary: "./caddy-hello"
- config_file: "./test-plugins/hello/Caddyfile.example"

## Expected Results

1. **Plugin Creation**: Should create a complete plugin structure with:
   - main.go (entry point)
   - plugin.go (middleware implementation)
   - go.mod (Go module)
   - README.md (documentation)
   - Caddyfile.example (test config)

2. **Plugin Building**: Should use xcaddy to build Caddy with the plugin

3. **Dev Server**: Should show how to start the development server

## Plugin Features

The generated plugin will:
- Add a custom HTTP header
- Support Caddyfile configuration
- Implement proper Caddy interfaces
- Include example usage

## Testing Without Caddy

Since we don't have a running Caddy instance, the tools will:
- Create all necessary files for plugin development
- Show the correct build commands
- Provide instructions for running the server
- Generate working Go code that compiles with Caddy

This allows developers to use the workflow in environments where they have Go and xcaddy installed.