#!/usr/bin/env node
// Refetch the Soundiiz OpenAPI spec embedded in https://soundiiz.com/api/doc and
// write it to specs/soundiiz-openapi.json. Diff before committing — the spec is BETA.

import { fetch } from 'undici';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = process.env.SOUNDIIZ_MCP_SPEC_URL?.trim() || 'https://soundiiz.com/api/doc';
const OUTPUT = path.resolve(process.cwd(), 'specs/soundiiz-openapi.json');

function extractSpec(html: string): unknown {
  const match = /<script id="swagger-data" type="application\/json">([\s\S]+?)<\/script>/.exec(html);
  if (!match) {
    throw new Error('Could not find swagger-data script tag in the API doc page.');
  }
  const parsed = JSON.parse(match[1]!) as { spec?: unknown };
  if (!parsed.spec) {
    throw new Error('swagger-data JSON did not contain a "spec" field.');
  }
  return parsed.spec;
}

async function main(): Promise<void> {
  console.log(`Fetching ${SOURCE} ...`);
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${SOURCE}`);
  }
  const html = await res.text();
  const spec = extractSpec(html);
  writeFileSync(OUTPUT, JSON.stringify(spec, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${OUTPUT}`);
  const obj = spec as { info?: { title?: string; version?: string }; paths?: Record<string, unknown> };
  console.log(
    `  ${obj.info?.title ?? 'untitled'} v${obj.info?.version ?? '?'} — ${Object.keys(obj.paths ?? {}).length} paths`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
