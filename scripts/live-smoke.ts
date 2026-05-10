#!/usr/bin/env node
// Read-only live smoke test against the real Soundiiz API. Requires SOUNDIIZ_API_KEY.
// Asserts only structural invariants (response shape) — does not assert specific contents.
import { authManager } from '../src/auth/index.js';
import { CallError } from '../src/core/client.js';
import { getMe } from '../src/services/users/index.js';
import { listSyncsPage } from '../src/services/syncs/index.js';
import { listSmartlinksPage } from '../src/services/smartlinks/index.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function run(): Promise<void> {
  if (!process.env.SOUNDIIZ_API_KEY?.trim()) {
    console.error('SOUNDIIZ_API_KEY is required for the live smoke test.');
    process.exit(2);
  }
  await authManager.init();
  const checks: CheckResult[] = [];

  try {
    const me = await getMe();
    checks.push({
      name: 'soundiiz_me',
      ok: typeof me.id === 'number' && typeof me.username === 'string',
      detail: `id=${me.id} username=${me.username}`,
    });
  } catch (err) {
    checks.push({ name: 'soundiiz_me', ok: false, detail: errMsg(err) });
  }

  try {
    const page = await listSyncsPage(0, 5);
    checks.push({
      name: 'syncs_list',
      ok: typeof page.total === 'number' && Array.isArray(page.items),
      detail: `total=${page.total} sample=${page.items.length}`,
    });
  } catch (err) {
    checks.push({ name: 'syncs_list', ok: false, detail: errMsg(err) });
  }

  try {
    const page = await listSmartlinksPage(0, 5);
    checks.push({
      name: 'smartlinks_list',
      ok: typeof page.total === 'number' && Array.isArray(page.items),
      detail: `total=${page.total} sample=${page.items.length}`,
    });
  } catch (err) {
    checks.push({ name: 'smartlinks_list', ok: false, detail: errMsg(err) });
  }

  let failed = 0;
  for (const c of checks) {
    const tag = c.ok ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${c.name}: ${c.detail}`);
    if (!c.ok) failed += 1;
  }
  if (failed > 0) process.exit(1);
}

function errMsg(err: unknown): string {
  if (err instanceof CallError) return `${err.status ?? '?'} ${err.message}`;
  return (err as Error).message;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
