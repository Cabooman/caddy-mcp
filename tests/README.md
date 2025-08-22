# Integration Tests

This folder contains integration tests that demonstrate the Caddy MCP server functionality.

## Test Scripts

- **test-plugin-creation.js** - Tests the `caddy_create_plugin` tool
- **test-build.js** - Tests the `caddy_build_plugin` tool  
- **test-dev-server.js** - Tests the `caddy_dev_server` tool

## Running Tests

First, build the server:
```bash
npm run build
```

Then run individual tests:
```bash
node tests/test-plugin-creation.js
node tests/test-build.js
node tests/test-dev-server.js
```

## Requirements

- Node.js built server (run `npm run build`)
- Go 1.21+ and xcaddy (for build tests)

## Test Workflow

The tests demonstrate the complete plugin development workflow:

1. **Create Plugin** - Generates a complete Caddy plugin structure
2. **Build Plugin** - Uses xcaddy to build Caddy with the plugin
3. **Dev Server** - Shows how to start development server with plugin

These tests use the MCP protocol directly to communicate with the server and verify all tools work correctly.