import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { authManager } from '../../auth/index.js';
import { CallError, callOperation } from '../../core/client.js';
import { getMe } from '../../services/users/index.js';
import { toolError, toolJson } from '../../utils/toolResponses.js';

export function registerCuratedUserTools(server: McpServer): void {
  server.tool(
    'soundiiz_me',
    'Get the current authenticated Soundiiz user (id, username, email).',
    {},
    async () => {
      try {
        const me = await getMe();
        return toolJson(me);
      } catch (err) {
        if (err instanceof CallError) {
          return toolError(err.message, err.payload ?? { error: err.message });
        }
        return toolError((err as Error).message);
      }
    }
  );

  server.tool(
    'soundiiz_auth_status',
    'Check whether a Soundiiz API key is loaded and authenticates against /v1/me. Local-only call.',
    { probe: z.boolean().optional().describe('Probe /v1/me to verify key (default true)') },
    async ({ probe }) => {
      const hasKey = authManager.hasKey();
      if (!hasKey) {
        return toolJson({
          ok: false,
          hasKey: false,
          reason:
            'No Soundiiz API key loaded. Set SOUNDIIZ_API_KEY in your environment, or use file/keychain key store.',
        });
      }
      if (probe === false) {
        return toolJson({ ok: true, hasKey: true, probed: false });
      }
      try {
        await callOperation({
          operationId: 'get_soundiiz_openapi_v1_merest_getme',
          options: { rawResponse: true },
        });
        return toolJson({ ok: true, hasKey: true, probed: true });
      } catch (err) {
        const message = err instanceof CallError ? err.message : (err as Error).message;
        const status = err instanceof CallError ? err.status : undefined;
        return toolJson({ ok: false, hasKey: true, probed: true, status, error: message });
      }
    }
  );
}
