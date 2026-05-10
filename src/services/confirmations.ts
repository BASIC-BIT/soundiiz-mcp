import { randomBytes } from 'node:crypto';
import { getConfig } from '../config/index.js';
import { stableHash } from '../utils/stableStringify.js';

interface PendingConfirm {
  tool: string;
  argHash: string;
  expiresAt: number;
}

const pending = new Map<string, PendingConfirm>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(id);
  }
}

export interface IssueResult {
  confirmId: string;
  expiresInMs: number;
}

export function issueConfirmation(tool: string, args: Record<string, unknown>): IssueResult {
  purgeExpired();
  const ttl = getConfig().writes.confirmTtlMs;
  const id = `ct_${randomBytes(8).toString('hex')}`;
  const argHash = hashArgs(args);
  pending.set(id, { tool, argHash, expiresAt: Date.now() + ttl });
  return { confirmId: id, expiresInMs: ttl };
}

export interface ValidateResult {
  ok: boolean;
  reason?: string;
}

export function consumeConfirmation(
  tool: string,
  args: Record<string, unknown>,
  confirmId: string
): ValidateResult {
  purgeExpired();
  const entry = pending.get(confirmId);
  if (!entry) return { ok: false, reason: 'CONFIRM_TOKEN_INVALID_OR_EXPIRED' };
  if (entry.tool !== tool) return { ok: false, reason: 'CONFIRM_TOKEN_TOOL_MISMATCH' };
  const argHash = hashArgs(args);
  if (entry.argHash !== argHash) return { ok: false, reason: 'CONFIRM_TOKEN_ARGS_CHANGED' };
  pending.delete(confirmId);
  return { ok: true };
}

function hashArgs(args: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === 'confirmId') continue;
    filtered[k] = v;
  }
  return stableHash(filtered);
}

export function clearAllForTest(): void {
  pending.clear();
}
