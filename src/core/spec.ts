import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface OperationParam {
  name: string;
  in: ParameterLocation;
  required: boolean;
  description?: string;
  schema?: unknown;
}

export interface OperationDef {
  operationId: string;
  method: string;
  path: string;
  tags: string[];
  description?: string;
  parameters: OperationParam[];
  hasRequestBody: boolean;
  requestBodySchema?: unknown;
  requestBodyRequired?: boolean;
  responses?: Record<string, unknown>;
}

export interface SpecIndex {
  operations: Map<string, OperationDef>;
  raw: any;
}

let cachedIndex: SpecIndex | null = null;

function defaultSpecPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // From src/core or dist/src/core, the spec lives at <repo>/specs/soundiiz-openapi.json.
  // Walk up looking for it.
  const candidates = [
    path.resolve(here, '../../specs/soundiiz-openapi.json'),
    path.resolve(here, '../../../specs/soundiiz-openapi.json'),
    path.resolve(process.cwd(), 'specs/soundiiz-openapi.json'),
  ];
  for (const c of candidates) {
    try {
      readFileSync(c, 'utf8');
      return c;
    } catch {
      // try next
    }
  }
  return candidates[0]!;
}

function loadSpec(): any {
  const override = process.env.SOUNDIIZ_MCP_SPEC_FILE?.trim();
  const target = override
    ? path.isAbsolute(override)
      ? override
      : path.resolve(process.cwd(), override)
    : defaultSpecPath();
  const raw = readFileSync(target, 'utf8');
  return JSON.parse(raw);
}

function extractParamSchema(param: any): unknown {
  if (!param || typeof param !== 'object') return undefined;
  if (param.schema) return param.schema;
  return undefined;
}

function collectParameters(op: any, pathItem: any): OperationParam[] {
  const params: OperationParam[] = [];
  const seen = new Set<string>();
  const add = (list?: any[]) => {
    (list ?? []).forEach((p) => {
      if (!p?.name || !p.in) return;
      const key = `${p.in}:${p.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      const required = p.in === 'path' ? true : Boolean(p.required);
      params.push({
        name: p.name,
        in: p.in,
        required,
        description: typeof p.description === 'string' ? p.description : undefined,
        schema: extractParamSchema(p),
      });
    });
  };
  add(pathItem?.parameters);
  add(op?.parameters);
  return params;
}

function extractRequestBody(requestBody: any): {
  schema?: unknown;
  required: boolean;
} {
  if (typeof requestBody !== 'object' || requestBody === null) return { required: false };
  const required = Boolean(requestBody.required);
  const content = requestBody.content ?? {};
  const json = content['application/json'] ?? Object.values(content)[0];
  const schema = json && typeof json === 'object' && 'schema' in json ? json.schema : undefined;
  return { schema, required };
}

function buildIndex(spec: any): SpecIndex {
  const operations = new Map<string, OperationDef>();
  const paths = spec?.paths ?? {};
  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    for (const [method, op] of Object.entries<any>(pathItem)) {
      const m = method.toLowerCase();
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(m)) continue;
      const operationId = typeof op.operationId === 'string' ? op.operationId : undefined;
      if (!operationId) continue;
      const parameters = collectParameters(op, pathItem);
      const requestBody = extractRequestBody(op.requestBody);
      const hasRequestBody = Boolean(op.requestBody);
      const tags = Array.isArray(op.tags) ? op.tags.map(String) : [];
      operations.set(operationId, {
        operationId,
        method: m.toUpperCase(),
        path: pathKey,
        tags,
        description: typeof op.description === 'string' ? op.description : undefined,
        parameters,
        hasRequestBody,
        requestBodySchema: requestBody.schema,
        requestBodyRequired: requestBody.required,
        responses: op.responses,
      });
    }
  }
  return { operations, raw: spec };
}

export function getSpecIndex(): SpecIndex {
  if (cachedIndex) return cachedIndex;
  const spec = loadSpec();
  cachedIndex = buildIndex(spec);
  return cachedIndex;
}

export function clearSpecCache(): void {
  cachedIndex = null;
}
