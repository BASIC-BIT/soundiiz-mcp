import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { invalidate } from '../services/cache.js';
import { toolJson } from '../utils/toolResponses.js';

export function registerCacheTools(server: McpServer): void {
  server.tool(
    'soundiiz_cache_invalidate',
    'Invalidate MCP-local cached responses. Defaults to scope=all.',
    {
      scope: z
        .enum(['all', 'me', 'syncsList', 'syncDetail', 'smartlinksList', 'smartlinkDetail'])
        .optional(),
      id: z.union([z.number(), z.string()]).optional(),
    },
    ({ scope, id }) => {
      const cleared = invalidate(scope ?? 'all', id);
      return toolJson({ ok: true, scope: scope ?? 'all', cleared });
    }
  );
}
