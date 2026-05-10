# Architecture Overview

This server is organized by responsibility so each file stays small and focused. The structure mirrors `vrchat-mcp` to keep cognitive load low across BASIC's MCP family.

## Entry point

- `src/index.ts` boots the MCP server, validates config, initializes auth, registers tools, and connects the stdio transport.

## Core API plumbing (`src/core/`)

- `spec.ts` loads and caches the Soundiiz OpenAPI spec from `specs/soundiiz-openapi.json` (vendored). Optional `SOUNDIIZ_MCP_SPEC_URL` lets a developer point at a remote URL for testing.
- `client.ts` executes API operations against `https://api.soundiiz.com` with Bearer auth, the configured user-agent, write gating, allowlist enforcement, and a token-bucket rate limiter.
- `readTools.ts` provides read helpers (pagination unrolling, field selection, shaping into compact rows).
- `readToolRegistry.ts` registers auto-generated GET tools (`soundiiz_read_<operationId>`) from the spec.
- `writeToolRegistry.ts` registers auto-generated non-GET tools (`soundiiz_write_<operationId>`) from the spec, all gated by `writes.allow` and (for DELETE) the confirmation-token flow.

## Tool registration (`src/tools/`)

- `registerAllTools.ts` is the single place that wires up all tools.
- `raw.ts` exposes `soundiiz_call` for direct operationId invocation (disabled by default; enable via `rawTools.enabled`).
- `auth.ts` exposes `soundiiz_auth_status` (and `soundiiz_auth_clear` for in-memory keys).
- `cache.ts` exposes `soundiiz_cache_invalidate`.
- `curated/` contains high-signal, agent-friendly tools.
- `read/` contains system read utilities (config/time).

## Schemas (`src/schemas/`)

- Shared Zod schemas for tool inputs/outputs.

## Services (`src/services/`)

- Small, testable domain services:
  - `users/` — `/v1/me`.
  - `syncs/` — list, detail, trigger, delete; aggregations for overview / due / failures.
  - `smartlinks/` — list, detail, delete; aggregations.
  - `cache.ts` — keyed TTL cache with explicit invalidation by service + (optional) ID.
  - `exports/` — placeholder for the not-yet-public Exports endpoints announced in the May 2026 changelog.

## Auth (`src/auth/`)

- `keyStore.ts` — load API key from one of: env var (`SOUNDIIZ_API_KEY`), config file (`auth.apiKey`), or OS keychain (via `keytar`, when `auth.keyStore=keychain`).
- `index.ts` — `authManager.init()`, `authManager.getKey()`, `authManager.clearMemory()`.
- No browser flow is required: the user pastes their personal key from `https://soundiiz.com/webapp/settings/api`.

## Confirmation tokens (`src/services/confirm.ts`)

- In-memory map of `{tokenId → {tool, argHash, issuedAt}}`.
- TTL bounded by `confirmations.ttlMs` (default 120s).
- Tokens are scoped to tool name + canonical-JSON arg hash (excluding `confirmId` itself), so changing args invalidates the token.

## Rate limiting (`src/services/rateLimit.ts`)

- Single token bucket per process, default 60 req/min.
- Honors any `Retry-After` and `X-RateLimit-*` headers if Soundiiz returns them.
- Bypassed for the `soundiiz_auth_status` health probe? No — health probes count too. Operators who hammer the probe will trip their own bucket, which is the correct signal.

## Resources (`src/resources/`)

Reserved for future MCP resources (e.g., a `soundiiz://syncs/snapshot` feed). Not required for v0.1.

## Infra + utils

- `src/infra/logger.ts` — stderr-only pino-style logger with levels (`debug`/`info`/`warn`/`error`).
- `src/utils/toolNames.ts` — operationId → tool name mapping (`soundiiz_read_<op>`, `soundiiz_write_<op>`).
- `src/utils/argHash.ts` — canonical JSON hash for confirmation tokens.

## Tests

- `test/` focuses on deterministic behavior (spec parsing, tool naming, read helpers, cache, confirmation tokens, allowlist enforcement, rate limiter).
- `test/e2e/mock.test.ts` runs against a local mock server backed by the same spec fixture.
- `test/e2e/live.test.ts` is opt-in via a gitignored fixture file.
- Coverage is reported via `npm run test:coverage`.

## Data flow (read path)

```
MCP client
  → curated tool (e.g. soundiiz_syncs_list)
    → service (syncs.list with auto-pagination)
      → cache check (TTL 60s)
        → core/client.executeOperation('get_…getmesyncs', {offset, limit})
          → undici request to https://api.soundiiz.com/v1/me/syncs
          → bearer auth header injected
          → rate limiter awaited
        → cache populate
      → service shaper (compact rows)
    → MCP response (smallest field set, IDs included)
```

## Data flow (write path with confirmation)

```
MCP client → soundiiz_sync_trigger {id: 42}
  → service: writes.allow? ✓  allowlist? ✓  destructive? ✓ → returns confirm_required + confirmId
MCP client → soundiiz_sync_trigger {id: 42, confirmId: "…"}
  → service: token valid + arg hash matches?
    → core/client.executeOperation('post_…getmesyncsexecute', {id: 42})
    → on 202: invalidate sync cache for id=42, return success
    → on 409 TOO_MANY_SYNCS_IN_PROGRESS: return structured guidance
```
