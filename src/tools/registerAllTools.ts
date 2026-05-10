import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config/index.js';
import { logger } from '../infra/logger.js';
import { registerAuthTools } from './auth.js';
import { registerCacheTools } from './cache.js';
import { registerCuratedSmartlinkTools } from './curated/smartlinks.js';
import { registerCuratedSyncTools } from './curated/syncs.js';
import { registerCuratedUserTools } from './curated/users.js';
import { registerGeneratedTools } from './generated.js';
import { registerRawTools } from './raw.js';

export function registerAllTools(server: McpServer): void {
  registerCuratedUserTools(server);
  registerCuratedSyncTools(server);
  registerCuratedSmartlinkTools(server);
  registerCacheTools(server);
  registerAuthTools(server);

  if (getConfig().rawTools.enabled) {
    registerRawTools(server);
  }

  const counts = registerGeneratedTools(server);
  logger.info('Registered tools', {
    curated: 'users(2)+syncs(5)+smartlinks(4)+cache(1)+auth(2)',
    generated: counts,
    raw: getConfig().rawTools.enabled,
  });
}
