# Design Notes

Working notes for design decisions made during initial scoping. These are not commitments — they capture the tradeoffs so a future maintainer (or fresh agent) understands the why.

## Why mirror vrchat-mcp?

BASIC-BIT's vrchat-mcp is the reference implementation of the BASICs MCP pattern: curated tools first, OpenAPI-driven generated layers second, raw call last; confirmation tokens for destructive ops; allowlists; cookie/key store with multiple backends; logs to stderr; vendored spec; opt-in live evals. Reusing the same skeleton means:

- Faster scaffolding (we know which files exist and why).
- Consistent operator UX across BASIC's MCP servers.
- Shared documentation patterns (`docs/architecture.md`, `docs/curated-tools.md`, `docs/public-launch-plan.md`).
- A clear pattern for the next MCP server we build.

Differences from vrchat-mcp that simplify Soundiiz MCP:

- No browser-based login flow needed — the user pastes a key from the Soundiiz settings page.
- No realtime websocket pipeline — the Soundiiz API is REST-only.
- No 2FA / cookie management complexity — Bearer auth only.
- Tiny API surface (8 endpoints) so curated coverage is essentially complete from day one.
- `keytar` is wired in from v0.1 with `auth.keyStore=keychain`. Env and file stores are also available.

## Why vendor the spec instead of fetching at runtime?

The Soundiiz User API is BETA. Upstream spec changes should be a deliberate, reviewed event rather than a silent runtime mutation. Workflow:

1. `npm run sync:spec` → updates `specs/soundiiz-openapi.json`.
2. Diff in PR review.
3. `npm run generate:schemas` → regenerates Zod.
4. `npm run check` → lint/typecheck/test.
5. `npm run generate:tools-docs` → regenerates the catalog.

A post-publish CI job can run `sync:spec` weekly and open a PR if the spec changes.

## Confirmation tokens vs explicit `--yes` flag

We chose tokens because:

- Agents can produce a "show me the plan, then execute" two-call rhythm naturally.
- Tokens bind to argument hash, so changing `id` between calls invalidates.
- Operator can disable globally via `writes.confirmDestructive=false` for trusted automation.

Trade-off: agents need to remember the `confirmId` across two calls. The `confirm_required` response includes the confirmId and a recap of what would happen, so the agent's next turn has everything it needs.

## Why `soundiiz_sync_trigger` is non-destructive (no confirmation token)

`POST /v1/me/syncs/{id}/trigger` runs a sync that the user has already configured and which is already scheduled to run on its own (typically weekly). The cost of an accidental trigger is:

- Repeated calls while a sync is in flight return `409 SYNC_PROCESSING` instead of queuing duplicates — idempotent in practice.
- The sync's effect on remote playlists is whatever the user asked for; it's just running earlier than the schedule.
- The only real downside is that Soundiiz runs one sync at a time per account, so an unexpected trigger can occupy that slot for up to an hour.

That's a UX cost, not data loss. Treating it with the same gravity as a DELETE (confirmation token + replay) felt heavy-handed in practice, so triggers execute in one call. Operators who want to lock the trigger down can still:

- Set `writes.allow=false` to disable all writes, or
- Set `syncs.allowlist` to restrict which sync IDs can be triggered.

Deletes (`soundiiz_sync_delete`, `soundiiz_smartlink_delete`) still go through the confirmation flow because they actually destroy state.

## Cache TTLs

- `/v1/me`: 1h. User profile rarely changes.
- Syncs list: 60s. Status changes (`processing` → `idle`) can happen often during active windows.
- Sync detail: 30s. Same reasoning, slightly tighter for the focused-detail use case.
- SmartLinks list: 5min. SmartLinks change much less frequently than syncs.
- SmartLink detail: 5min.

All caches are explicitly invalidated after the relevant write tool fires (e.g., `soundiiz_sync_trigger` clears the syncs list cache and the detail cache for that ID).

## Rate limiting

Soundiiz does not publish rate limits. Conservative default 60 req/min protects against runaway agent loops without being annoying for normal use. The bucket is a single global one rather than per-endpoint because the API surface is tiny and per-endpoint would add complexity for little gain.

If we observe `429`s in the wild, we'll switch to per-endpoint buckets and surface `Retry-After` more aggressively.

## Why not implement Exports yet?

The May 2026 changelog mentions "syncs, SmartLinks, exports, and user-related actions" for Creator-plan API access. The current published spec only includes the first three. We leave a `src/services/exports/` placeholder so when the spec gains those endpoints, the auto-generated layer picks them up immediately and a curated `soundiiz_exports_list` / `soundiiz_export_get` can land in a single PR.

## Open questions for v0.1

1. Do we want a `soundiiz_sync_create` curated tool? The current public spec has no `POST /v1/me/syncs` create endpoint — sync creation appears to still happen in the web UI. If a creator endpoint lands, this becomes a high-value tool.
2. SmartLink update / publish: same situation — only `GET` and `DELETE` are exposed. Skip for v0.1, monitor for spec growth.
3. Do we want a built-in "spec diff" report at startup if the vendored spec doesn't match the latest fetched version? Probably yes — it would warn maintainers their generated layer is stale. Track as a follow-up issue.
4. Do we want a `soundiiz://syncs/changes` MCP resource (delta feed) like vrchat-mcp's friend changes feed? Probably not for v0.1 — sync state changes aren't event-driven, they're polled. A polling resource would just be a thin wrapper around the cached list.
