# Changelog

All notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release.

### Added

- MCP server for the [Soundiiz User API (BETA)](https://soundiiz.com/api/doc).
- Vendored OpenAPI spec at `specs/soundiiz-openapi.json` (refresh with `npm run sync:spec`).
- Bearer auth via `SOUNDIIZ_API_KEY`, with three key stores: env, on-disk file (mode 0600), or OS keychain (`keytar`).
- Curated tools:
  - User: `soundiiz_me`, `soundiiz_auth_status`, `soundiiz_auth_set`, `soundiiz_auth_clear`.
  - Syncs (read): `soundiiz_syncs_list`, `soundiiz_sync_get`, `soundiiz_syncs_overview`, `soundiiz_syncs_due`.
  - Syncs (write): `soundiiz_sync_trigger`, `soundiiz_sync_delete`.
  - SmartLinks (read): `soundiiz_smartlinks_list`, `soundiiz_smartlink_get`, `soundiiz_smartlinks_overview`.
  - SmartLinks (write): `soundiiz_smartlink_delete`.
  - Local: `soundiiz_cache_invalidate`.
- Auto-generated `soundiiz_read_<operationId>` and `soundiiz_write_<operationId>` tools from every operation in the spec.
- Opt-in raw layer: `soundiiz_call`, `soundiiz_list_operations` (enable with `rawTools.enabled=true`).
- Confirmation-token flow on destructive writes (`soundiiz_sync_delete`, `soundiiz_smartlink_delete`) — the first call returns a `confirmId`; the second call (same args + `confirmId`) executes. Tokens are bound to tool name + arg hash and expire after `writes.confirmTtlMs` (120s default).
- `soundiiz_sync_trigger` is treated as a non-destructive write and executes in one call. Rationale: the sync was already configured by the user and runs on a schedule; triggering early just runs it now. Coerce-fix to `paginated` mode of `*_list`: `offset`/`limit` are now returned as numbers (Soundiiz upstream returns them as strings).
- Per-resource allowlists: `syncs.allowlist`, `smartlinks.allowlist`.
- Token-bucket rate limiter (60 req/min default, configurable).
- TTL cache with explicit invalidation per scope (`me`, `syncsList`, `syncDetail`, `smartlinksList`, `smartlinkDetail`).
- Local harness scripts: `mcp:status`, `mcp:list-tools`, `mcp:call`, `smoke:live`, `sync:spec`, `generate:tools-docs`.
- 25 Vitest cases covering spec parsing, tool naming, cache, confirmation tokens, allowlist, rate limiter, and a full mock-server-driven service E2E.

### Configuration defaults

- `writes.allow = true` — writes are enabled. Set to `false` (or `SOUNDIIZ_MCP_ALLOW_WRITES=false`) to lock the server to GET-only.
- `writes.confirmDestructive = true` — destructive operations require the confirmation flow. Disable for trusted automation.
- `auth.keyStore = env` — read API key from `SOUNDIIZ_API_KEY`. Switch to `file` or `keychain` for persistence.

### Known gaps

- The Soundiiz User API is currently in BETA (v1.0). The publisher explicitly warns that the surface may change. Track changes by re-running `npm run sync:spec`.
- The Soundiiz "exports" endpoints announced in the May 2026 changelog are not in the current spec; the `src/services/exports/` placeholder is reserved.
- This release has been validated against the mock server (25 passing tests) but **has not been live-validated against a real Soundiiz Creator-plan account by the maintainer**. If you're an early adopter, `npm run smoke:live` is the first thing to run, and please file an issue if any endpoint behaves differently than the spec suggests.
- The Soundiiz User API requires a [Creator-plan](https://soundiiz.com/pricing) subscription. The webapp's internal API was evaluated but rejected as a backend ([Soundiiz ToS Article 15(f)](https://soundiiz.com/data/termsofservice/Terms_of_Service_SOUNDIIZ20211123EN.pdf) prohibits programmatic use outside the documented API).

[0.1.0]: https://github.com/BASIC-BIT/soundiiz-mcp/releases/tag/v0.1.0
