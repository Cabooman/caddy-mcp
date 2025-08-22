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
  {
    name: 'caddy_deploy_plugin',
    description: 'Deploy plugin to production by safely replacing Caddy binary with backup',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_path: {
          type: 'string',
          description: 'Path to the plugin directory to deploy',
        },
        caddy_binary: {
          type: 'string',
          description: 'Path to current Caddy binary to replace',
          default: '/usr/bin/caddy',
        },
        backup_dir: {
          type: 'string',
          description: 'Directory to store backup of current binary',
          default: '/opt/caddy/backups',
        },
        validate_config: {
          type: 'string',
          description: 'Path to Caddyfile to validate with new binary',
        },
      },
      required: ['plugin_path'],
    },
  },
  {
    name: 'caddy_backup_list',
    description: 'Manage Caddy binary backups (backup, restore, list)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['backup', 'restore', 'list'],
          description: 'Action to perform: backup current binary, restore from backup, or list backups',
        },
        caddy_binary: {
          type: 'string',
          description: 'Path to Caddy binary to backup or restore to',
          default: '/usr/bin/caddy',
        },
        backup_dir: {
          type: 'string',
          description: 'Directory containing backups',
          default: '/opt/caddy/backups',
        },
        restore_name: {
          type: 'string',
          description: 'Name of backup to restore (required for restore action)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'caddy_validate_config',
    description: 'Validate Caddy configuration file with specified binary',
    inputSchema: {
      type: 'object',
      properties: {
        config_file: {
          type: 'string',
          description: 'Path to Caddyfile or JSON config to validate',
        },
        caddy_binary: {
          type: 'string',
          description: 'Path to Caddy binary to use for validation',
          default: 'caddy',
        },
      },
      required: ['config_file'],
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
      case 'caddy_deploy_plugin':
        return await deployPlugin(args);
      case 'caddy_backup_list':
        return await manageBackups(args);
      case 'caddy_validate_config':
        return await validateConfig(args);
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

async function deployPlugin(args: any) {
  const { plugin_path, caddy_binary = '/usr/bin/caddy', backup_dir = '/opt/caddy/backups', validate_config } = args;
  
  if (!await fs.pathExists(plugin_path)) {
    throw new Error(`Plugin path does not exist: ${plugin_path}`);
  }
  
  if (!await fs.pathExists(caddy_binary)) {
    throw new Error(`Caddy binary not found: ${caddy_binary}`);
  }
  
  const absolutePluginPath = path.resolve(plugin_path);
  const absoluteCaddyPath = path.resolve(caddy_binary);
  const absoluteBackupDir = path.resolve(backup_dir);
  
  // Ensure backup directory exists
  await fs.ensureDir(absoluteBackupDir);
  
  // Create timestamp for backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `caddy-backup-${timestamp}`;
  const backupPath = path.join(absoluteBackupDir, backupName);
  
  // Build new binary with plugin
  const tempBinaryPath = path.join(absoluteBackupDir, `caddy-new-${timestamp}`);
  
  try {
    // Check if xcaddy is available
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
  
  // Build new Caddy with plugin
  const buildCmd = `xcaddy build latest --output ${tempBinaryPath} --with ${modulePath}=${absolutePluginPath}`;
  
  try {
    execSync(buildCmd, { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Failed to build Caddy with plugin: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Validate configuration if provided
  if (validate_config) {
    if (!await fs.pathExists(validate_config)) {
      throw new Error(`Config file not found: ${validate_config}`);
    }
    
    try {
      execSync(`${tempBinaryPath} validate --config ${validate_config}`, { encoding: 'utf8' });
    } catch (error) {
      // Clean up temp binary
      await fs.remove(tempBinaryPath);
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Backup current binary
  await fs.copy(absoluteCaddyPath, backupPath);
  
  // Replace with new binary
  await fs.copy(tempBinaryPath, absoluteCaddyPath);
  
  // Clean up temp binary
  await fs.remove(tempBinaryPath);
  
  return {
    content: [
      {
        type: 'text',
        text: `Successfully deployed plugin to production!

Plugin: ${absolutePluginPath}
Original binary backed up to: ${backupPath}
New binary deployed to: ${absoluteCaddyPath}
${validate_config ? `Configuration validated: ${validate_config}` : ''}

⚠️  IMPORTANT: You need to restart Caddy for the changes to take effect:

  # For systemd:
  sudo systemctl restart caddy
  
  # For Docker:
  docker-compose restart caddy
  
  # Manual restart:
  sudo pkill caddy && sudo ${absoluteCaddyPath} run --config /path/to/Caddyfile

To rollback if needed:
  Use caddy_backup_list with action "restore" and restore_name "${backupName}"`,
      },
    ],
  };
}

async function manageBackups(args: any) {
  const { action, caddy_binary = '/usr/bin/caddy', backup_dir = '/opt/caddy/backups', restore_name } = args;
  
  const absoluteBackupDir = path.resolve(backup_dir);
  const absoluteCaddyPath = path.resolve(caddy_binary);
  
  await fs.ensureDir(absoluteBackupDir);
  
  switch (action) {
    case 'list':
      try {
        const backups = await fs.readdir(absoluteBackupDir);
        const caddyBackups = backups.filter(f => f.startsWith('caddy-backup-'));
        
        if (caddyBackups.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No Caddy backups found in ${absoluteBackupDir}`,
              },
            ],
          };
        }
        
        const backupDetails = await Promise.all(
          caddyBackups.map(async (backup) => {
            const backupPath = path.join(absoluteBackupDir, backup);
            const stats = await fs.stat(backupPath);
            return `${backup} (${stats.mtime.toISOString()}, ${Math.round(stats.size / 1024 / 1024)}MB)`;
          })
        );
        
        return {
          content: [
            {
              type: 'text',
              text: `Available Caddy backups in ${absoluteBackupDir}:

${backupDetails.map(detail => `  - ${detail}`).join('\n')}

To restore a backup, use:
  caddy_backup_list with action "restore" and restore_name "backup-name"`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    case 'backup':
      if (!await fs.pathExists(absoluteCaddyPath)) {
        throw new Error(`Caddy binary not found: ${absoluteCaddyPath}`);
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `caddy-backup-${timestamp}`;
      const backupPath = path.join(absoluteBackupDir, backupName);
      
      try {
        await fs.copy(absoluteCaddyPath, backupPath);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created backup!

Source: ${absoluteCaddyPath}
Backup: ${backupPath}

Backup name for restore: ${backupName}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    case 'restore':
      if (!restore_name) {
        throw new Error('restore_name is required for restore action');
      }
      
      const restorePath = path.join(absoluteBackupDir, restore_name);
      
      if (!await fs.pathExists(restorePath)) {
        throw new Error(`Backup not found: ${restorePath}`);
      }
      
      try {
        await fs.copy(restorePath, absoluteCaddyPath);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully restored Caddy binary!

Restored from: ${restorePath}
Restored to: ${absoluteCaddyPath}

⚠️  IMPORTANT: You need to restart Caddy for the changes to take effect:

  # For systemd:
  sudo systemctl restart caddy
  
  # For Docker:
  docker-compose restart caddy
  
  # Manual restart:
  sudo pkill caddy && sudo ${absoluteCaddyPath} run --config /path/to/Caddyfile`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    default:
      throw new Error(`Unknown action: ${action}. Use 'backup', 'restore', or 'list'`);
  }
}

async function validateConfig(args: any) {
  const { config_file, caddy_binary = 'caddy' } = args;
  
  if (!await fs.pathExists(config_file)) {
    throw new Error(`Config file not found: ${config_file}`);
  }
  
  const absoluteConfigPath = path.resolve(config_file);
  
  // Check if specified caddy binary exists (if it's a path)
  if (caddy_binary.includes('/') && !await fs.pathExists(caddy_binary)) {
    throw new Error(`Caddy binary not found: ${caddy_binary}`);
  }
  
  try {
    const validateCmd = `${caddy_binary} validate --config ${absoluteConfigPath}`;
    const output = execSync(validateCmd, { encoding: 'utf8' });
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Configuration is valid!

Config file: ${absoluteConfigPath}
Validated with: ${caddy_binary}

Validation output:
${output || 'Configuration syntax is valid.'}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);