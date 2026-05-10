import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authManager } from '../src/auth/index.js';
import { resetConfigCacheForTest } from '../src/config/index.js';
import { CallError } from '../src/core/client.js';
import { clearAllForTest as clearCache } from '../src/services/cache.js';
import { resetRateLimitForTest } from '../src/services/rateLimit.js';
import {
  deleteSmartlink,
  getSmartlink,
  listAllSmartlinks,
  listSmartlinksPage,
} from '../src/services/smartlinks/index.js';
import {
  deleteSync,
  getSync,
  listAllSyncs,
  listSyncsPage,
  triggerSync,
} from '../src/services/syncs/index.js';
import { getMe } from '../src/services/users/index.js';
import { clearMockEnv, setupMockEnv, startMockServer, type MockServerHandle } from './mockServer.js';

describe('services (mock server)', () => {
  let handle: MockServerHandle;

  beforeAll(async () => {
    handle = await startMockServer();
    setupMockEnv(handle);
    resetConfigCacheForTest();
    resetRateLimitForTest();
    await authManager.init();
  });

  afterAll(async () => {
    await handle.close();
    clearMockEnv();
    resetConfigCacheForTest();
  });

  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    clearCache();
  });

  it('GET /v1/me', async () => {
    const me = await getMe();
    expect(me.username).toBe('tester');
  });

  it('lists syncs paginated and unrolled', async () => {
    const page = await listSyncsPage(0, 10);
    expect(page.total).toBe(handle.state.syncs.length);
    const all = await listAllSyncs();
    expect(all.length).toBe(handle.state.syncs.length);
  });

  it('returns sync detail with lastExecutionResult', async () => {
    const sync = await getSync(1);
    expect(sync.id).toBe(1);
    expect(sync.lastExecutionResult?.status).toBe('success');
  });

  it('triggers a sync (write override)', async () => {
    const before = handle.state.triggers.length;
    const data = await triggerSync(1, { internalOverrideWriteGate: true });
    expect((data as any).data.status).toBe('accepted');
    expect(handle.state.triggers.length).toBe(before + 1);
  });

  it('deletes a sync (write override)', async () => {
    const all = await listAllSyncs();
    const target = all[0]!.id;
    await deleteSync(target, { internalOverrideWriteGate: true });
    expect(handle.state.syncs.find((s) => s.id === target)).toBeUndefined();
  });

  it('lists smartlinks and fetches detail', async () => {
    const list = await listSmartlinksPage();
    expect(list.total).toBeGreaterThan(0);
    const detail = await getSmartlink(list.items[0]!.id);
    expect(detail.shortcode).toBeDefined();
  });

  it('lists all smartlinks (unrolled)', async () => {
    const all = await listAllSmartlinks();
    expect(all.length).toBe(handle.state.smartlinks.length);
  });

  it('deletes a smartlink (write override)', async () => {
    const before = handle.state.smartlinks.length;
    if (before === 0) return;
    await deleteSmartlink(handle.state.smartlinks[0]!.id, { internalOverrideWriteGate: true });
    expect(handle.state.smartlinks.length).toBe(before - 1);
  });

  it('blocks writes when explicitly disabled', async () => {
    process.env.SOUNDIIZ_MCP_ALLOW_WRITES = 'false';
    resetConfigCacheForTest();
    try {
      await expect(triggerSync(1)).rejects.toBeInstanceOf(CallError);
    } finally {
      delete process.env.SOUNDIIZ_MCP_ALLOW_WRITES;
      resetConfigCacheForTest();
    }
  });
});
