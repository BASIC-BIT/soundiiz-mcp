import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { authManager } from '../auth/index.js';
import { getConfig } from '../config/index.js';
import { toolError, toolJson } from '../utils/toolResponses.js';

export function registerAuthTools(server: McpServer): void {
  server.tool(
    'soundiiz_auth_set',
    'Set a Soundiiz API key for the current session. With keyStore=file or keychain, also persists locally. With keyStore=env, in-memory only. Always local; never transmits the key anywhere except to the Soundiiz API.',
    { apiKey: z.string().min(1) },
    async ({ apiKey }) => {
      try {
        await authManager.setKey(apiKey);
        return toolJson({
          ok: true,
          keyStore: getConfig().auth.keyStore,
          length: apiKey.trim().length,
        });
      } catch (err) {
        return toolError((err as Error).message);
      }
    }
  );

  server.tool(
    'soundiiz_auth_clear',
    'Clear the in-memory Soundiiz API key. With keyStore=file or keychain, also removes the persisted copy.',
    {},
    async () => {
      try {
        await authManager.clear();
        return toolJson({ ok: true });
      } catch (err) {
        return toolError((err as Error).message);
      }
    }
  );
}
