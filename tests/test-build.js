#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test the caddy_build_plugin tool
const serverPath = path.join(__dirname, '../dist/index.js');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;

function sendMessage(method, params) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log('Sending:', JSON.stringify(message, null, 2));
  server.stdin.write(JSON.stringify(message) + '\n');
}

server.stdout.on('data', (data) => {
  const messages = data.toString().trim().split('\n');
  messages.forEach(msg => {
    if (msg) {
      try {
        const parsed = JSON.parse(msg);
        console.log('Received:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Raw output:', msg);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

// Initialize
sendMessage('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0.0' }
});

// Test building the plugin
setTimeout(() => {
  sendMessage('tools/call', {
    name: 'caddy_build_plugin',
    arguments: {
      plugin_path: './examples/caddy-plugins/visitor-counter',
      output_path: './caddy-with-visitor-counter'
    }
  });
}, 200);

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 3000);