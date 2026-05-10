import { fetch, Headers, type RequestInit } from 'undici';
import { authManager } from '../auth/index.js';
import { getConfig } from '../config/index.js';
import { logger } from '../infra/logger.js';
import { awaitRateLimit } from '../services/rateLimit.js';
import { getSpecIndex, type OperationDef } from './spec.js';

export interface CallOptions {
  dryRun?: boolean;
  rawResponse?: boolean;
  /** Bypass write gating; only the curated tools that have already enforced their own gating should set this. */
  internalOverrideWriteGate?: boolean;
}

export interface CallResult {
  url: string;
  status?: number;
  headers?: Record<string, string>;
  data?: unknown;
  dryRun?: boolean;
}

export interface CallInput {
  operationId: string;
  params?: Record<string, unknown>;
  body?: unknown;
  options?: CallOptions;
}

export class CallError extends Error {
  status?: number;
  payload?: Record<string, unknown>;
  constructor(message: string, status?: number, payload?: Record<string, unknown>) {
    super(message);
    this.name = 'CallError';
    this.status = status;
    this.payload = payload;
  }
}

function stringifyParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  return JSON.stringify(value) ?? '';
}

function buildUrl(op: OperationDef, params: Record<string, unknown>): string {
  const config = getConfig();
  let pathSegment = op.path;
  for (const p of op.parameters.filter((x) => x.in === 'path')) {
    const val = params[p.name];
    if (val === undefined || val === null) {
      if (p.required) throw new CallError(`Missing required path param: ${p.name}`);
      continue;
    }
    pathSegment = pathSegment.replace(`{${p.name}}`, encodeURIComponent(stringifyParam(val)));
  }

  const base = new URL(config.api.baseUrl);
  const basePath = base.pathname.replace(/\/+$/, '');
  const opPath = pathSegment.replace(/^\/+/, '');
  base.pathname = `${basePath}/${opPath}`.replace(/\/{2,}/g, '/');

  for (const p of op.parameters.filter((x) => x.in === 'query')) {
    const val = params[p.name];
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      val.forEach((v) => base.searchParams.append(p.name, stringifyParam(v)));
    } else {
      base.searchParams.append(p.name, stringifyParam(val));
    }
  }
  return base.toString();
}

function buildHeaders(op: OperationDef, params: Record<string, unknown>): Headers {
  const config = getConfig();
  const headers = new Headers();
  headers.set('user-agent', config.api.userAgent);
  headers.set('accept', 'application/json');
  for (const p of op.parameters.filter((x) => x.in === 'header')) {
    const val = params[p.name];
    if (val === undefined || val === null) continue;
    headers.set(p.name, stringifyParam(val));
  }
  const key = authManager.getKey();
  if (key) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractErrorMessage(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  // Soundiiz wraps payloads as { data: { status, message } }.
  const inner = isRecord(data.data) ? data.data : data;
  const msg = (inner as Record<string, unknown>).message;
  if (typeof msg === 'string') return msg;
  return undefined;
}

function parseResponseText(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function getOperationOrThrow(operationId: string): OperationDef {
  const op = getSpecIndex().operations.get(operationId);
  if (!op) throw new CallError(`Unknown operationId: ${operationId}`);
  return op;
}

function validateParams(op: OperationDef, params: Record<string, unknown>): void {
  const allowed = new Set(op.parameters.map((p) => p.name));
  const unknown = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k]) => k)
    .filter((k) => !allowed.has(k));
  if (unknown.length === 0) return;
  throw new CallError(`Unknown parameter(s) for ${op.operationId}: ${unknown.join(', ')}`);
}

function enforcePolicy(op: OperationDef, options?: CallOptions): void {
  if (op.method === 'GET') return;
  if (options?.internalOverrideWriteGate) return;
  if (!getConfig().writes.allow) {
    throw new CallError(
      `Write operations are disabled (blocked ${op.method}). Set writes.allow=true (default) or unset SOUNDIIZ_MCP_ALLOW_WRITES=false to re-enable.`
    );
  }
}

export async function callOperation(input: CallInput): Promise<CallResult> {
  const { operationId, params = {}, body, options } = input;
  const op = getOperationOrThrow(operationId);
  validateParams(op, params);
  enforcePolicy(op, options);

  const url = buildUrl(op, params);
  if (options?.dryRun) return { url, dryRun: true };

  const headers = buildHeaders(op, params);
  const init: RequestInit = { method: op.method, headers };
  if (op.hasRequestBody || body !== undefined) {
    init.body = body !== undefined ? JSON.stringify(body) : undefined;
    headers.set('content-type', 'application/json');
  }
  const config = getConfig();
  init.signal = AbortSignal.timeout(config.api.timeoutMs);

  await awaitRateLimit();

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const data = parseResponseText(text);
    const headersRecord = headersToRecord(res.headers);

    if (options?.rawResponse) {
      return { url, status: res.status, headers: headersRecord, data };
    }

    if (!res.ok) {
      const isClientError = res.status >= 400 && res.status < 500;
      const errorMessage = isClientError ? extractErrorMessage(data) : undefined;
      const message = errorMessage
        ? `Soundiiz API returned ${res.status}: ${errorMessage}`
        : `Soundiiz API returned ${res.status}`;
      const payload: Record<string, unknown> = {
        status: res.status,
        url,
        error: data,
      };
      if (errorMessage) payload.message = errorMessage;
      throw new CallError(message, res.status, payload);
    }

    return { url, status: res.status, headers: headersRecord, data };
  } catch (err) {
    if (err instanceof CallError) throw err;
    logger.error('callOperation failed', {
      operationId,
      message: (err as Error).message,
    });
    throw new CallError(`Network or fetch error: ${(err as Error).message}`);
  }
}
