import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllForTest, invalidate, withCache } from '../src/services/cache.js';

describe('cache', () => {
  afterEach(() => clearAllForTest());

  it('caches a value within TTL', async () => {
    const fetcher = vi.fn(() => Promise.resolve('A'));
    const a = await withCache('me', undefined, fetcher);
    const b = await withCache('me', undefined, fetcher);
    expect(a).toBe('A');
    expect(b).toBe('A');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keys by id within a scope', async () => {
    const fetcher = vi.fn((n: number) => Promise.resolve(`S${n}`));
    const a = await withCache('syncDetail', 1, () => fetcher(1));
    const b = await withCache('syncDetail', 2, () => fetcher(2));
    expect(a).toBe('S1');
    expect(b).toBe('S2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate clears matching scope entries', async () => {
    await withCache('syncsList', 'a', () => Promise.resolve('x'));
    await withCache('syncsList', 'b', () => Promise.resolve('y'));
    const cleared = invalidate('syncsList');
    expect(cleared).toBe(2);
  });
});
