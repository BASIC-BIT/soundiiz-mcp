# Curated Tool Charter

This document defines the high-signal, agent-friendly tool surface. The goal is to keep the
default toolset small, explicit, and task-oriented so an agent can reason about what to do next
without paginating through the underlying API.

## Principles

- Small and explicit: each tool has a single, obvious purpose.
- Human-input friendly: accept titles / shortcodes when the API allows; IDs are first-class for precision.
- Composable: outputs include IDs and metadata for follow-ups.
- Confirmation-token flow is the canonical safety net for destructive operations.
- `writes.allow=false` is an explicit kill switch for environments that should be GET-only.
- Allowlist guards: per-resource (`syncs.allowlist`, `smartlinks.allowlist`) for write scopes.

## Risk tiers

| Tier            | Examples                                                        | Gating                                                                 |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| read            | `soundiiz_me`, `soundiiz_syncs_list`, `soundiiz_smartlink_get`  | Always enabled.                                                        |
| non-destructive | `soundiiz_sync_trigger`                                         | Sync allowlist (if set). Honors `writes.allow`. No confirmation token. |
| destructive     | `soundiiz_sync_delete`, `soundiiz_smartlink_delete`             | Confirmation token + resource allowlist (if set). Honors `writes.allow`. |

## Curated tools (planned for v0.1)

User (read):

- `soundiiz_me` — current user profile (id, username, email).
- `soundiiz_auth_status` — local-only; verifies the configured key authenticates.

Syncs (read):

- `soundiiz_syncs_list` — auto-paginated compact list. Args: `paginated?: boolean`, `offset?`, `limit?`. Default returns all syncs as compact rows.
- `soundiiz_sync_get` — full sync detail (`source`, `destination`, `method`, `frequency`, `status`, `lastExecutionResult`). Args: `id` (required).
- `soundiiz_syncs_overview` — counts by status, by frequency, by source/destination platform pair; plus `dueSoon` (next N hours, default 24) and `recentFailures` shortlists. Args: `dueWithinHours?`, `recentFailureLimit?`.
- `soundiiz_syncs_due` — syncs scheduled to run within a window. Args: `withinHours?` (default 24).
- `soundiiz_syncs_failures_recent` — recent failed executions across syncs. Args: `limit?` (default 10).

Syncs (write):

- `soundiiz_sync_trigger` — request execution. Args: `id` (required). Executes in one call (no confirmation token). Returns `{ ok: true, status: 'accepted', message }`. Maps `409 TOO_MANY_SYNCS_IN_PROGRESS` and `409 SYNC_PROCESSING/SYNC_PENDING` to clean guidance.
- `soundiiz_sync_delete` — destructive. Args: `id` (required), `confirmId?`. Returns `confirm_required` then `deleted`. Maps `409 SYNC_PROCESSING/SYNC_PENDING` to "wait for the in-flight execution before deleting".

SmartLinks (read):

- `soundiiz_smartlinks_list` — auto-paginated compact list. Args: `paginated?`, `offset?`, `limit?`, `status?` (`draft`/`published`).
- `soundiiz_smartlink_get` — detail. Args: `id` (required).
- `soundiiz_smartlinks_overview` — counts by status, by category, by platform across all `links[]`; plus most-recently-updated shortlist.

SmartLinks (write):

- `soundiiz_smartlink_delete` — destructive. Args: `id` (required), `confirmId?`.

System (local-only):

- `soundiiz_cache_invalidate` — invalidate cache. Args: `scope?` (`all`/`me`/`syncs`/`smartlinks`), `id?`.
- `soundiiz_config_get` — return the runtime config (with the API key redacted).

## Auto-generated layers

- `soundiiz_read_<operationId>` — enabled by default (one per GET in the spec).
- `soundiiz_write_<operationId>` — enabled by default. Honors `writes.allow`. Destructive ops at this layer do NOT layer the confirmation flow — that's only on the curated tools. If you need agent-safe destructive writes, use the curated tools.
- `soundiiz_call` — raw operationId invocation. Off by default; enable via `rawTools.enabled`.

For the current BETA spec, the auto-generated layers add:

- `soundiiz_read_get_…getme`
- `soundiiz_read_get_…getmesyncs`
- `soundiiz_read_get_…getmesyncsdetails`
- `soundiiz_read_get_…getmesmartlinks`
- `soundiiz_read_get_…getmesmartlinksdetails`
- `soundiiz_write_post_…getmesyncsexecute`
- `soundiiz_write_delete_…getmesyncsdelete`
- `soundiiz_write_delete_…getmesmartlinksdelete`

We will rename operationIds in `core/generatedToolOverrides.ts` to nicer aliases (e.g. `soundiiz_read_user_me`, `soundiiz_write_sync_trigger`) so the auto-generated names are still ergonomic if a curated tool is missing.

## Next up (after v0.1)

- Exports endpoints once they ship in the BETA spec (May 2026 changelog signaled they're coming for Creator users).
- `soundiiz_sync_trigger_batch` — convenience for kicking off N syncs with built-in 409 backoff.
- `soundiiz_smartlinks_search` — local search over the cached list (title/artist/shortcode contains).

## Allowlist guard

- Use `syncs.allowlist` to limit `soundiiz_sync_trigger` and `soundiiz_sync_delete` to specific sync IDs.
- Use `smartlinks.allowlist` to limit `soundiiz_smartlink_delete` to specific smartlink IDs.
- Empty allowlist means "no restriction"; presence of any IDs activates the guard.
