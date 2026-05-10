#!/usr/bin/env node
// Minimal local harness for poking the MCP server over stdio.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';

const COMMAND = process.env.SOUNDIIZ_MCP_SERVER_COMMAND?.trim() || 'npx';
const ARGS = (process.env.SOUNDIIZ_MCP_SERVER_ARGS ?? 'tsx src/index.ts')
  .split(/\s+/)
  .filter(Boolean);

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: COMMAND,
    args: ARGS.map((a) => (a.startsWith('src/') ? path.resolve(process.cwd(), a) : a)),
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client({ name: 'soundiiz-mcp-harness', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function status(): Promise<void> {
  await withClient(async (client) => {
    const result = await client.callTool({ name: 'soundiiz_auth_status', arguments: {} });
    console.log(JSON.stringify(result, null, 2));
  });
}

async function listTools(): Promise<void> {
  await withClient(async (client) => {
    const result = await client.listTools();
    console.log(JSON.stringify(result.tools.map((t) => t.name), null, 2));
  });
}

async function callTool(name: string, argsJson?: string): Promise<void> {
  await withClient(async (client) => {
    const args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    const result = await client.callTool({ name, arguments: args });
    console.log(JSON.stringify(result, null, 2));
  });
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'status':
      await status();
      return;
    case 'list-tools':
      await listTools();
      return;
    case 'call': {
      const [name, argsJson] = rest;
      if (!name) throw new Error('Usage: mcp-client call <toolName> [jsonArgs]');
      await callTool(name, argsJson);
      return;
    }
    default:
      console.error('Usage: mcp-client {status|list-tools|call <toolName> [jsonArgs]}');
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
