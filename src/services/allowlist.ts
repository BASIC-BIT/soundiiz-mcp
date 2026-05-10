import { getConfig } from '../config/index.js';

export interface AllowResult {
  ok: boolean;
  reason?: string;
}

export function checkSyncAllowed(syncId: number | undefined): AllowResult {
  const allowlist = getConfig().syncs.allowlist;
  if (allowlist.length === 0) return { ok: true };
  if (syncId === undefined) {
    return { ok: false, reason: 'syncs.allowlist is set but no syncId was provided' };
  }
  if (!allowlist.includes(syncId)) {
    return {
      ok: false,
      reason: `Sync id ${syncId} is not in syncs.allowlist (${allowlist.join(', ')})`,
    };
  }
  return { ok: true };
}

export function checkSmartlinkAllowed(smartlinkId: number | undefined): AllowResult {
  const allowlist = getConfig().smartlinks.allowlist;
  if (allowlist.length === 0) return { ok: true };
  if (smartlinkId === undefined) {
    return { ok: false, reason: 'smartlinks.allowlist is set but no smartlinkId was provided' };
  }
  if (!allowlist.includes(smartlinkId)) {
    return {
      ok: false,
      reason: `Smartlink id ${smartlinkId} is not in smartlinks.allowlist (${allowlist.join(', ')})`,
    };
  }
  return { ok: true };
}
