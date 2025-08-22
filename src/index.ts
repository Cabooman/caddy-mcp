#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

const server = new Server(
  {
    name: 'caddy-mcp-server',
    version: '1.0.0',
  }
);

// Tool definitions
const tools: Tool[] = [
  {
    name: 'caddy_create_plugin',
    description: 'Create a new Caddy plugin with Go module structure',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Plugin name (will be used as module name)',
        },
        directory: {
          type: 'string',
          description: 'Directory where plugin should be created',
        },
        description: {
          type: 'string',
          description: 'Plugin description',
        },
        author: {
          type: 'string',
          description: 'Plugin author',
          default: 'Claude Code',
        },
        module_path: {
          type: 'string',
          description: 'Go module path (e.g., github.com/user/plugin)',
        },
      },
      required: ['name', 'directory', 'module_path'],
    },
  },
  {
    name: 'caddy_build_plugin',
    description: 'Build Caddy with custom plugin using xcaddy',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_path: {
          type: 'string',
          description: 'Path to the plugin directory',
        },
        output_path: {
          type: 'string',
          description: 'Output path for the built Caddy binary',
          default: './caddy',
        },
        caddy_version: {
          type: 'string',
          description: 'Caddy version to build with',
          default: 'latest',
        },
      },
      required: ['plugin_path'],
    },
  },
  {
    name: 'caddy_dev_server',
    description: 'Start Caddy development server with plugin',
    inputSchema: {
      type: 'object',
      properties: {
        caddy_binary: {
          type: 'string',
          description: 'Path to the Caddy binary with plugin',
          default: './caddy',
        },
        config_file: {
          type: 'string',
          description: 'Path to Caddyfile or JSON config',
        },
        port: {
          type: 'number',
          description: 'Port to run the server on',
          default: 8080,
        },
        admin_port: {
          type: 'number',
          description: 'Admin API port',
          default: 2019,
        },
      },
      required: [],
    },
  },
];

// Plugin template files
const pluginTemplates = {
  'main.go': (name: string, modulePath: string, description: string) => `package main

import (
	caddycmd "github.com/caddyserver/caddy/v2/cmd"
	_ "${modulePath}"
)

func main() {
	caddycmd.Main()
}`,

  'plugin.go': (name: string, modulePath: string, description: string) => `package ${name}

import (
	"context"
	"fmt"
	"net/http"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

func init() {
	caddy.RegisterModule(${name.charAt(0).toUpperCase() + name.slice(1)}{})
	httpcaddyfile.RegisterHandlerDirective("${name}", parseCaddyfile)
}

// ${name.charAt(0).toUpperCase() + name.slice(1)} implements an HTTP handler that ${description || 'performs custom processing'}.
type ${name.charAt(0).toUpperCase() + name.slice(1)} struct {
	// Add configuration fields here
	Message string \`json:"message,omitempty"\`
}

// CaddyModule returns the Caddy module information.
func (${name.charAt(0).toUpperCase() + name.slice(1)}) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.${name}",
		New: func() caddy.Module { return new(${name.charAt(0).toUpperCase() + name.slice(1)}) },
	}
}

// Provision implements caddy.Provisioner.
func (m *${name.charAt(0).toUpperCase() + name.slice(1)}) Provision(ctx caddy.Context) error {
	if m.Message == "" {
		m.Message = "Hello from ${name} plugin!"
	}
	return nil
}

// Validate implements caddy.Validator.
func (m *${name.charAt(0).toUpperCase() + name.slice(1)}) Validate() error {
	return nil
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m ${name.charAt(0).toUpperCase() + name.slice(1)}) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	// Add your plugin logic here
	w.Header().Set("X-${name.charAt(0).toUpperCase() + name.slice(1)}", m.Message)
	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile implements caddyfile.Unmarshaler.
func (m *${name.charAt(0).toUpperCase() + name.slice(1)}) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	for d.Next() {
		for d.NextBlock(0) {
			switch d.Val() {
			case "message":
				if !d.NextArg() {
					return d.ArgErr()
				}
				m.Message = d.Val()
			default:
				return d.Errf("unknown subdirective: %s", d.Val())
			}
		}
	}
	return nil
}

// parseCaddyfile unmarshals tokens from h into a new Middleware.
func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var m ${name.charAt(0).toUpperCase() + name.slice(1)}
	err := m.UnmarshalCaddyfile(h.Dispenser)
	return m, err
}

// Interface guards
var (
	_ caddy.Provisioner           = (*${name.charAt(0).toUpperCase() + name.slice(1)})(nil)
	_ caddy.Validator             = (*${name.charAt(0).toUpperCase() + name.slice(1)})(nil)
	_ caddyhttp.MiddlewareHandler = (*${name.charAt(0).toUpperCase() + name.slice(1)})(nil)
	_ caddyfile.Unmarshaler       = (*${name.charAt(0).toUpperCase() + name.slice(1)})(nil)
)`,

  'go.mod': (name: string, modulePath: string) => `module ${modulePath}

go 1.21

require (
	github.com/caddyserver/caddy/v2 v2.7.6
)`,

  'README.md': (name: string, modulePath: string, description: string, author: string) => `# ${name.charAt(0).toUpperCase() + name.slice(1)} Caddy Plugin

${description || 'A custom Caddy plugin'}

## Installation

To build Caddy with this plugin, use [xcaddy](https://github.com/caddyserver/xcaddy):

\`\`\`bash
xcaddy build --with ${modulePath}
\`\`\`

## Configuration

Add the plugin to your Caddyfile:

\`\`\`
example.com {
    ${name} {
        message "Custom message"
    }
    respond "Hello World"
}
\`\`\`

## Development

1. Clone this repository
2. Run \`go mod tidy\` to fetch dependencies
3. Build with xcaddy: \`xcaddy build --with ${modulePath}=.\`
4. Test with your Caddyfile

## Author

${author}`,

  'Caddyfile.example': (name: string) => `# Example Caddyfile for ${name} plugin
:8080 {
    ${name} {
        message "Hello from ${name}!"
    }
    respond "Plugin is working!"
}`
};

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'caddy_create_plugin':
        return await createPlugin(args);
      case 'caddy_build_plugin':
        return await buildPlugin(args);
      case 'caddy_dev_server':
        return await startDevServer(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function createPlugin(args: any) {
  const { name, directory, description, author = 'Claude Code', module_path } = args;
  
  const pluginDir = path.join(directory, name);
  
  // Create plugin directory
  await fs.ensureDir(pluginDir);
  
  // Create plugin files
  const files = [
    { name: 'main.go', content: pluginTemplates['main.go'](name, module_path, description) },
    { name: 'plugin.go', content: pluginTemplates['plugin.go'](name, module_path, description) },
    { name: 'go.mod', content: pluginTemplates['go.mod'](name, module_path) },
    { name: 'README.md', content: pluginTemplates['README.md'](name, module_path, description, author) },
    { name: 'Caddyfile.example', content: pluginTemplates['Caddyfile.example'](name) },
  ];
  
  for (const file of files) {
    await fs.outputFile(path.join(pluginDir, file.name), file.content);
  }
  
  return {
    content: [
      {
        type: 'text',
        text: `Successfully created Caddy plugin "${name}" in ${pluginDir}

Files created:
- main.go (main entry point)
- plugin.go (plugin implementation)
- go.mod (Go module file)
- README.md (documentation)
- Caddyfile.example (example configuration)

Next steps:
1. cd ${pluginDir}
2. go mod tidy
3. xcaddy build --with ${module_path}=.`,
      },
    ],
  };
}

async function buildPlugin(args: any) {
  const { plugin_path, output_path = './caddy', caddy_version = 'latest' } = args;
  
  if (!await fs.pathExists(plugin_path)) {
    throw new Error(`Plugin path does not exist: ${plugin_path}`);
  }
  
  const absolutePluginPath = path.resolve(plugin_path);
  const absoluteOutputPath = path.resolve(output_path);
  
  // Check if xcaddy is available
  try {
    execSync('xcaddy version', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('xcaddy is not installed. Please install it from https://github.com/caddyserver/xcaddy');
  }
  
  // Read go.mod to get module path
  const goModPath = path.join(absolutePluginPath, 'go.mod');
  if (!await fs.pathExists(goModPath)) {
    throw new Error(`go.mod not found in ${absolutePluginPath}`);
  }
  
  const goModContent = await fs.readFile(goModPath, 'utf8');
  const moduleMatch = goModContent.match(/^module (.+)$/m);
  if (!moduleMatch) {
    throw new Error('Could not find module path in go.mod');
  }
  const modulePath = moduleMatch[1];
  
  // Build command
  const buildCmd = `xcaddy build ${caddy_version} --output ${absoluteOutputPath} --with ${modulePath}=${absolutePluginPath}`;
  
  try {
    const output = execSync(buildCmd, { cwd: path.dirname(absoluteOutputPath), encoding: 'utf8' });
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully built Caddy with plugin!

Command: ${buildCmd}
Output: ${absoluteOutputPath}

Build output:
${output}

You can now run: ${absoluteOutputPath} run --config your-caddyfile`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function startDevServer(args: any) {
  const { caddy_binary = './caddy', config_file, port = 8080, admin_port = 2019 } = args;
  
  if (!await fs.pathExists(caddy_binary)) {
    throw new Error(`Caddy binary not found: ${caddy_binary}. Run caddy_build_plugin first.`);
  }
  
  let runArgs = ['run'];
  
  if (config_file) {
    if (!await fs.pathExists(config_file)) {
      throw new Error(`Config file not found: ${config_file}`);
    }
    runArgs.push('--config', config_file);
  } else {
    // Create a simple default config
    const defaultConfig = `:{
        respond "Caddy development server is running with your plugin!"
    }`;
    runArgs.push('--config', '-');
  }
  
  const cmd = path.resolve(caddy_binary);
  
  return {
    content: [
      {
        type: 'text',
        text: `Starting Caddy development server...

Command: ${cmd} ${runArgs.join(' ')}
${config_file ? `Config: ${config_file}` : 'Using default config'}
Server will be available at: http://localhost:${port}
Admin API: http://localhost:${admin_port}

Note: This would normally start the server in the background.
In a real environment, you would run: ${cmd} ${runArgs.join(' ')}

To stop the server, use: ${cmd} stop`,
      },
    ],
  };
}

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);