# AGENTS

This repo uses linting, typechecking, and tests to validate changes.

## Workflow

- After significant code changes (or at the end of a work loop), run `npm run check`.
- For a single step, use `npm run lint`, `npm run typecheck`, or `npm test`.
- After making a change, run at least one relevant targeted test (or add/edit one) and confirm it passes before reporting back.
- For PR review workflow: before pushing any new commits, respond to each open review comment (reply or reaction) and resolve the thread.
- Keep stdout reserved for MCP protocol; log to stderr only.
- Config defaults live in `src/config/defaults.json`; override via `SOUNDIIZ_MCP_CONFIG_FILE` (env overrides still supported).
- Writes are enabled by default. Set `writes.allow=false` to lock the server to GET-only mode.
- Destructive writes (DELETE, sync trigger) require a confirmation token unless `writes.confirmDestructive=false`. Treat the confirmation flow as the canonical safety net for destructive operations.
- Regenerate tool catalog docs after spec updates: `npm run generate:tools-docs`.
- The brand mark lives in `scripts/lib/mark.ts`. **Do not hand-edit `assets/logo.svg` or `assets/social-preview.svg`.** Edit the mark module, then run `npm run build:assets` to regenerate both surfaces and the social-preview PNG together. The two assets share gradient ids and geometry by construction, so they cannot drift.
- Refetch the Soundiiz OpenAPI spec when the upstream BETA changes: `npm run sync:spec`. This rewrites `specs/soundiiz-openapi.json`. Diff the file before committing — the spec is in BETA and may shift.
- Regenerate Zod schemas after spec updates: `npm run generate:schemas` (updates `src/generated/soundiiz-schemas.ts`; do not edit manually).
- Regenerate mock test schemas after spec tweaks: `npm run generate:test-schemas`.

## Tool ergonomics goals (distilled)

- Prefer names / shortcodes / titles over numeric IDs when reasonable: tools should accept human inputs as first-class arguments where the API allows.
- Keep tools strict and explicit: each tool has a single, obvious purpose and should not hide search/fallback behaviors internally.
- Fail cleanly with guidance: when a lookup fails, return a structured "not found" response that points to the next obvious tool.
- Chainable outputs: successful responses should include both human labels and IDs for follow-up calls.

## Curated output philosophy

- Curated tools should return the smallest set of fields that answer the likely user question and support follow-up actions.
- For paginated collections (syncs, smartlinks), never return full objects by default; return compact summaries + IDs.
- High-volume curated tools should auto-unroll pagination internally; only expose pagination when partial results are the intent.
- Avoid arbitrary sampling. Either return counts/aggregations, or return a compact snippet for every item (and mark truncation explicitly).
- Use name/title-first flows; include IDs in results so the agent can resolve detail views explicitly.
- Add argument descriptions for curated tools (especially include flags, filters, and paging knobs) so agents understand when to toggle them vs. use a different tool.

### Specific notes (current direction)

- `soundiiz_syncs_list` should auto-unroll pagination by default and return compact rows: `{id, title, source: "spotify:playlist:…", destination: "deezer:playlist:…", method, frequency, status, nextExecutionDate}`. Expose a `paginated=true` mode for partial fetches.
- `soundiiz_syncs_overview` should return counts only (by status, by frequency, by source/destination platform pair) plus a `dueSoon` shortlist and a `recentFailures` shortlist. No raw items.
- `soundiiz_sync_get` is KISS: accept `id`, return full detail including `lastExecutionResult`. On 404, return a structured not-found pointing at `soundiiz_syncs_list`.
- `soundiiz_sync_trigger` is medium-risk: accept `id`, return a `confirm_required` response on first call (unless `writes.confirmDestructive=false`), execute on second call with `confirmId`. Map `409 TOO_MANY_SYNCS_IN_PROGRESS` to clean guidance ("retry later or wait for in-flight syncs").
- `soundiiz_sync_delete` and `soundiiz_smartlink_delete` are destructive: always require a `confirmId` unless explicitly disabled in config.
- For `soundiiz_me`, return a compact summary (`{id, username, email, plan?}`) — no view presets needed for such a small payload.

## Caching considerations

- `/v1/me`: TTL 1h.
- `/v1/me/syncs` (list): TTL 60s. Invalidate after `trigger` or `delete`.
- `/v1/me/syncs/{id}` (detail): TTL 30s. Invalidate after `trigger` or `delete` of that ID.
- `/v1/me/smartlinks` (list): TTL 5min. Invalidate after `delete`.
- `/v1/me/smartlinks/{id}` (detail): TTL 5min. Invalidate after `delete` of that ID.
- Expose an explicit cache-control tool (`soundiiz_cache_invalidate`) so agents can force refreshes.

## Rate limiting

- The Soundiiz User API does not publicly document rate limits. Apply a conservative client-side token bucket (default 60 req/min) and expose it via `rateLimit.perMinute`.
- Surface `Retry-After` and any `X-RateLimit-*` response headers if present; fall back to bucket-only otherwise.
- Cache aggressively to keep agent loops well under the bucket.

## Confirmation tokens (medium- and high-risk writes)

- DELETE and sync `trigger` tools may return `confirm_required` with a `confirmId`.
- Re-run the tool with the same arguments + `confirmId` to execute.
- Tokens expire after `confirmations.ttlMs` (default 120000ms).
- Tokens are bound to the tool name + argument hash, not just the resource ID.

## Allowlist guards

- Set `syncs.allowlist` to a list of sync IDs to limit sync write operations (`trigger`, `delete`).
- Set `smartlinks.allowlist` to a list of smartlink IDs to limit smartlink write operations (`delete`).

## E2E tests

- Mock E2E runs by default (`test/e2e/mock.test.ts`) and uses the OpenAPI fixtures + a mock server.
- Live E2E is opt-in: create `test/fixtures/e2e.live.json` (gitignored) to run `test/e2e/live.test.ts`.
- Configure expectations in that file (see `test/fixtures/e2e.live.example.json`).
- LLM evals are opt-in: create `test/fixtures/evals.live.json` (gitignored) to run `test/evals/mock-llm.test.ts`.
  - Requires an OpenAI API key + model.
  - Run with `npm run test:evals`.

## BETA API notes

The Soundiiz User API is currently in BETA (v1.0). The publisher explicitly warns content may change. Practical implications:

- Vendor the spec at `specs/soundiiz-openapi.json` and treat changes as version-bumping events.
- Keep curated tools thin so a spec shift only requires regeneration of the `_read_` / `_write_` layer.
- The May 2026 changelog mentions Creator-plan endpoints for "syncs, SmartLinks, exports, and user-related actions". Only Syncs / SmartLinks / User are in the current BETA spec; **Exports** is expected to land later — leave room in `src/services/` for an `exports/` module.
