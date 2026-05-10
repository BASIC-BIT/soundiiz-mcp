import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pkg from '../package.json' with { type: 'json' };
import { authManager } from './auth/index.js';
import { getConfig } from './config/index.js';
import { logger } from './infra/logger.js';
import { registerAllTools } from './tools/registerAllTools.js';

const server = new McpServer({ name: 'soundiiz-mcp', version: pkg.version ?? '0.0.0' });

function validateConfig(): void {
  const config = getConfig();
  const ua = config.api.userAgent.trim();
  if (!ua || ua.startsWith('soundiiz-mcp/')) {
    logger.debug('Using default user-agent', { userAgent: ua });
  }
  if (!config.writes.allow) {
    logger.info('Writes disabled (writes.allow=false). All non-GET tools will refuse.');
  } else if (!config.writes.confirmDestructive) {
    logger.warn('Destructive confirmations disabled. DELETE and trigger run without a confirmId.');
  }
}

async function main(): Promise<void> {
  validateConfig();
  await authManager.init();
  registerAllTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('Fatal error starting server', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
