import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallError, callOperation } from '../core/client.js';
import { getSpecIndex } from '../core/spec.js';
import { toolError, toolJson } from '../utils/toolResponses.js';

export function registerRawTools(server: McpServer): void {
  server.tool(
    'soundiiz_call',
    'Call any Soundiiz operation by operationId. Off by default; enable with rawTools.enabled=true.',
    {
      operationId: z.string(),
      params: z.record(z.string(), z.unknown()).optional(),
      body: z.unknown().optional(),
      dryRun: z.boolean().optional(),
    },
    async ({ operationId, params, body, dryRun }) => {
      try {
        if (!getSpecIndex().operations.has(operationId)) {
          return toolError(
            `Unknown operationId: ${operationId}. Use soundiiz_list_operations to discover.`
          );
        }
        const result = await callOperation({
          operationId,
          params,
          body,
          options: { dryRun, rawResponse: true },
        });
        return toolJson(result);
      } catch (err) {
        if (err instanceof CallError) {
          return toolError(err.message, err.payload ?? { error: err.message });
        }
        return toolError((err as Error).message);
      }
    }
  );

  server.tool(
    'soundiiz_list_operations',
    'List every operationId, method, and path in the vendored Soundiiz OpenAPI spec.',
    {},
    () => {
      const ops = Array.from(getSpecIndex().operations.values()).map((op) => ({
        operationId: op.operationId,
        method: op.method,
        path: op.path,
        tags: op.tags,
      }));
      return toolJson({ count: ops.length, operations: ops });
    }
  );
}
