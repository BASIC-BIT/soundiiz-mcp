import { afterEach, describe, expect, it } from 'vitest';
import { resetConfigCacheForTest } from '../src/config/index.js';
import { checkSmartlinkAllowed, checkSyncAllowed } from '../src/services/allowlist.js';

describe('allowlist', () => {
  afterEach(() => {
    delete process.env.SOUNDIIZ_MCP_SYNC_ALLOWLIST;
    delete process.env.SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST;
    resetConfigCacheForTest();
  });

  it('allows everything when no allowlist is configured', () => {
    expect(checkSyncAllowed(42).ok).toBe(true);
    expect(checkSmartlinkAllowed(42).ok).toBe(true);
  });

  it('blocks IDs not in syncs.allowlist', () => {
    process.env.SOUNDIIZ_MCP_SYNC_ALLOWLIST = '1,2,3';
    resetConfigCacheForTest();
    expect(checkSyncAllowed(2).ok).toBe(true);
    const blocked = checkSyncAllowed(99);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain('not in syncs.allowlist');
  });

  it('blocks IDs not in smartlinks.allowlist', () => {
    process.env.SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST = '101';
    resetConfigCacheForTest();
    expect(checkSmartlinkAllowed(101).ok).toBe(true);
    expect(checkSmartlinkAllowed(102).ok).toBe(false);
  });
});
