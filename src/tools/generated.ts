import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodTypeAny } from 'zod';
import { getConfig } from '../config/index.js';
import { CallError, callOperation } from '../core/client.js';
import { getSpecIndex, type OperationDef, type OperationParam } from '../core/spec.js';
import { readToolName, writeToolName } from '../utils/toolNames.js';
import { toolError, toolJson } from '../utils/toolResponses.js';

function paramToZod(param: OperationParam): ZodTypeAny {
  const schema = (param.schema ?? {}) as { type?: string; pattern?: string };
  let zodType: ZodTypeAny;
  if (schema.type === 'integer' || schema.type === 'number') {
    zodType = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);
  } else if (schema.type === 'boolean') {
    zodType = z.boolean();
  } else {
    zodType = z.string();
  }
  if (param.description) zodType = zodType.describe(param.description);
  return param.required ? zodType : zodType.optional();
}

function buildInputSchema(op: OperationDef): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const p of op.parameters) {
    shape[p.name] = paramToZod(p);
  }
  if (op.hasRequestBody) {
    let bodySchema: ZodTypeAny = z.record(z.string(), z.unknown());
    if (!op.requestBodyRequired) bodySchema = bodySchema.optional();
    shape.body = bodySchema.describe('JSON body for the request');
  }
  return shape;
}

function shortDescription(op: OperationDef): string {
  const base = op.description?.split('\n')[0]?.trim() ?? `${op.method} ${op.path}`;
  const tag = op.tags[0] ? `[${op.tags[0]}] ` : '';
  return `${tag}${base}`;
}

export function registerGeneratedTools(server: McpServer): { read: number; write: number } {
  const config = getConfig();
  const index = getSpecIndex();
  let readCount = 0;
  let writeCount = 0;

  for (const op of index.operations.values()) {
    const isRead = op.method === 'GET';
    if (isRead && !config.generatedTools.read) continue;
    if (!isRead && !config.generatedTools.write) continue;

    const name = isRead ? readToolName(op.operationId) : writeToolName(op.operationId);
    const description = shortDescription(op);
    const shape = buildInputSchema(op);

    server.tool(name, description, shape, async (args: Record<string, unknown>) => {
      try {
        const { body, ...params } = args ?? {};
        const result = await callOperation({
          operationId: op.operationId,
          params: params as Record<string, unknown>,
          body,
          options: { rawResponse: true },
        });
        return toolJson(result);
      } catch (err) {
        if (err instanceof CallError) {
          return toolError(err.message, err.payload ?? { error: err.message });
        }
        return toolError((err as Error).message);
      }
    });

    if (isRead) readCount += 1;
    else writeCount += 1;
  }

  return { read: readCount, write: writeCount };
}
