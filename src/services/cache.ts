import { getConfig } from '../config/index.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export type CacheScope = 'me' | 'syncsList' | 'syncDetail' | 'smartlinksList' | 'smartlinkDetail';

const store = new Map<string, CacheEntry<unknown>>();

function key(scope: CacheScope, id?: string | number): string {
  return id !== undefined ? `${scope}:${id}` : scope;
}

function ttlFor(scope: CacheScope): number {
  return getConfig().cache.ttls[scope] * 1000;
}

export async function withCache<T>(
  scope: CacheScope,
  id: string | number | undefined,
  fetcher: () => Promise<T>
): Promise<T> {
  const config = getConfig();
  if (!config.cache.enabled) return fetcher();

  const k = key(scope, id);
  const entry = store.get(k) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expiresAt > now) return entry.value;

  const value = await fetcher();
  store.set(k, { value, expiresAt: now + ttlFor(scope) });
  return value;
}

export function invalidate(scope: CacheScope | 'all', id?: string | number): number {
  if (scope === 'all') {
    const n = store.size;
    store.clear();
    return n;
  }
  if (id !== undefined) {
    return store.delete(key(scope, id)) ? 1 : 0;
  }
  let count = 0;
  for (const k of store.keys()) {
    if (k === scope || k.startsWith(`${scope}:`)) {
      store.delete(k);
      count += 1;
    }
  }
  return count;
}

export function clearAllForTest(): void {
  store.clear();
}
