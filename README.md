# Soundiiz MCP

An MCP server for [Soundiiz](https://soundiiz.com). Lets your AI assistant inspect your sync jobs and SmartLinks across streaming services, and — when you opt in — trigger or delete them.

Built for [Claude Desktop](https://claude.ai/download), [OpenCode](https://opencode.ai/), and any other [Model Context Protocol](https://modelcontextprotocol.io/) client.

Read-only by default. Your API key stays on your machine. Curated tools on top of the Soundiiz User API so agents don't have to paginate through raw endpoints.

This project is unofficial and is not affiliated with Soundiiz.

## What You Can Ask

- Show me all my Soundiiz syncs and which ones are due to run next.
- Summarize sync status: how many succeeded, how many failed, which platforms are involved.
- Which syncs failed recently, and why?
- Trigger sync #42 to run now (after writes are explicitly enabled).
- List all my published SmartLinks and their shortcodes.
- Show details for SmartLink "abc123": fallback URL, per-platform links, status.
- Delete this stale draft SmartLink (after writes are explicitly enabled and confirmed).

## Writes and confirmations

The Soundiiz API exposes three write operations: delete sync, delete smartlink, and trigger sync. None are callable by default.

- Set `writes.allow = true` or `SOUNDIIZ_MCP_ALLOW_WRITES=true` to enable writes.
- Destructive writes (DELETE) and `soundiiz_sync_trigger` return a `confirmId` on the first call. Re-call with the same args plus `confirmId` to execute. Disable via `writes.confirmDestructive = false` if you trust the caller.
- Restrict writes to specific IDs with `syncs.allowlist` and `smartlinks.allowlist`.

## Auth and storage

Your API key is read from `SOUNDIIZ_API_KEY`, a local file, or the OS keychain (via `keytar`). It never leaves your machine except in `Authorization: Bearer` headers to `api.soundiiz.com`.

Logs go to stderr so stdout stays reserved for MCP protocol messages. Live smoke checks and LLM evals are opt-in and read gitignored fixture files.

## Quick Start

Requirements:

- Node.js 22 or newer.
- A Soundiiz account on the **Creator plan**. The Soundiiz User API is currently in BETA and gated to Creator subscribers.
- An MCP client such as Claude Desktop, OpenCode, or another MCP-compatible host.

Generate your personal API key at [soundiiz.com/webapp/settings/api](https://soundiiz.com/webapp/settings/api).

Install from source:

```bash
git clone https://github.com/BASIC-BIT/soundiiz-mcp.git
cd soundiiz-mcp
npm install
npm run build
```

## MCP Client Config

Use the built server for day-to-day use. Replace the path with your local checkout.

```json
{
  "mcpServers": {
    "soundiiz": {
      "command": "node",
      "args": ["<ABS_PATH_TO_REPO>/dist/bin/cli.js"],
      "env": {
        "SOUNDIIZ_API_KEY": "<YOUR_KEY>",
        "SOUNDIIZ_MCP_USER_AGENT": "your-name (email@example.com)"
      }
    }
  }
}
```

For active development, point at the TypeScript entrypoint instead:

```json
{
  "mcpServers": {
    "soundiiz-dev": {
      "command": "npx",
      "args": ["tsx", "<ABS_PATH_TO_REPO>/src/index.ts"],
      "env": {
        "SOUNDIIZ_API_KEY": "<YOUR_KEY>",
        "SOUNDIIZ_MCP_USER_AGENT": "your-name (email@example.com)"
      }
    }
  }
}
```

## Configuration

Defaults live in `src/config/defaults.json`. To override them, create a JSON config file and point to it with `SOUNDIIZ_MCP_CONFIG_FILE`.

Example `soundiiz-mcp.config.json`:

```json
{
  "api": {
    "baseUrl": "https://api.soundiiz.com",
    "userAgent": "your-name (email@example.com)"
  },
  "auth": { "keyStore": "env" },
  "writes": { "allow": false, "confirmDestructive": true, "confirmTtlMs": 120000 },
  "syncs": { "allowlist": [] },
  "smartlinks": { "allowlist": [] },
  "rateLimit": { "perMinute": 60 },
  "cache": { "enabled": true }
}
```

Environment variables override the config file when set.

Common environment variables:

- `SOUNDIIZ_MCP_CONFIG_FILE`: path to a JSON config file.
- `SOUNDIIZ_API_KEY`: your personal Soundiiz User API key (Bearer token).
- `SOUNDIIZ_MCP_USER_AGENT`: descriptive user agent. Include contact info when possible.
- `SOUNDIIZ_MCP_API_BASE`: override the API base URL. Defaults to `https://api.soundiiz.com`.
- `SOUNDIIZ_MCP_LOG_LEVEL`: `debug`, `info`, `warn`, or `error`.
- `SOUNDIIZ_MCP_KEY_STORE`: `env`, `file`, or `keychain`.
- `SOUNDIIZ_MCP_KEY_FILE`: file path when `SOUNDIIZ_MCP_KEY_STORE=file`.
- `SOUNDIIZ_MCP_ALLOW_WRITES`: enable non-GET operations.
- `SOUNDIIZ_MCP_CONFIRM_DESTRUCTIVE`: require a confirmation token for DELETE / trigger.
- `SOUNDIIZ_MCP_SYNC_ALLOWLIST`: comma-separated list of sync IDs permitted for write actions.
- `SOUNDIIZ_MCP_SMARTLINK_ALLOWLIST`: comma-separated list of smartlink IDs permitted for write actions.
- `SOUNDIIZ_MCP_ENABLE_RAW_CALL`: enable the raw `soundiiz_call` tool. Disabled by default.
- `SOUNDIIZ_MCP_DISABLE_GENERATED_READ_TOOLS`: disable auto-generated read tools.
- `SOUNDIIZ_MCP_DISABLE_GENERATED_WRITE_TOOLS`: disable auto-generated write tools.

## Tool Surface

Soundiiz MCP exposes three layers (mirroring the vrchat-mcp pattern):

- **Curated tools** for common agent workflows: `soundiiz_me`, `soundiiz_syncs_list`, `soundiiz_syncs_overview`, `soundiiz_syncs_due`, `soundiiz_sync_get`, `soundiiz_smartlinks_list`, `soundiiz_smartlinks_overview`, `soundiiz_smartlink_get`, plus opt-in writes `soundiiz_sync_trigger`, `soundiiz_sync_delete`, `soundiiz_smartlink_delete`.
- **Auto-generated read tools** named `soundiiz_read_<operationId>` for GET operations from the Soundiiz OpenAPI spec.
- **Auto-generated write tools** named `soundiiz_write_<operationId>` for non-GET operations. These remain gated by `writes.allow`.

Local-only tools include:

- `soundiiz_auth_status` — check whether a key is loaded and valid (calls `/v1/me`).
- `soundiiz_cache_invalidate` for MCP-local cache control.

The generated catalog lives in `docs/tools.md`. The shorter usage guide lives in `docs/tools-guide.md`.

## Optional Swagger UI

If you want a Swagger UI proxy for the MCP tools, use `mcpo`:

```bash
uvx mcpo --port 8000 --api-key "top-secret" -- node <ABS_PATH_TO_REPO>/dist/bin/cli.js
```

Then open `http://localhost:8000/docs`.

## Development

Useful scripts:

- `npm run dev` — run `src/index.ts` through `tsx`.
- `npm run build` — type-check and emit to `dist/`.
- `npm run start` — run the built server from `dist/`.
- `npm run lint`, `npm run typecheck`, `npm test` — quality gates.
- `npm run check` — lint + typecheck + test.
- `npm run mcp:status` — check whether the configured key authenticates.
- `npm run mcp:list-tools`, `npm run mcp:call` — local harness.
- `npm run smoke:live` — opt-in read-only live smoke matrix against the built server.
- `npm run sync:spec` — refetch the Soundiiz OpenAPI spec from `https://soundiiz.com/api/doc`.
- `npm run generate:schemas` — regenerate Zod schemas from `specs/soundiiz-openapi.json`.
- `npm run generate:tools-docs` — regenerate `docs/tools.md`.

Project layout (planned):

- `src/index.ts` — server bootstrap.
- `src/config/` — defaults and config loader.
- `src/auth/` — API key loading from env / file / keychain.
- `src/core/` — HTTP client, spec parser, generated tool registries.
- `src/services/` — domain services for syncs, smartlinks, user, cache.
- `src/schemas/` — shared Zod schemas for tool inputs and outputs.
- `src/generated/` — Zod schemas generated from the Soundiiz OpenAPI spec.
- `src/tools/` — MCP tool registration (curated + auto-generated + raw + auth + cache).
- `src/infra/` — logging.
- `src/utils/` — small helpers.
- `specs/soundiiz-openapi.json` — vendored copy of the Soundiiz User API spec.
- `docs/` — architecture, tool inventory, evals, design notes, launch plan.

## Testing And Evals

Local checks:

```bash
npm run check
```

Read-only live smoke checks are opt-in and require a Creator-plan API key:

```bash
npm run build
SOUNDIIZ_API_KEY=... npm run smoke:live
```

Live E2E and LLM evals use gitignored local fixture files. See `docs/evals.md`.

## Documentation

- `docs/tools.md` — generated tool catalog with schemas.
- `docs/tools-guide.md` — short human guide for the tool surface.
- `docs/architecture.md` — codebase overview and data flow.
- `docs/curated-tools.md` — curated tool charter and risk tiers.
- `docs/evals.md` — smoke, LLM, and manual agent eval workflow.
- `docs/public-launch-plan.md` — release awareness, registry, and launch-channel plan.
- `docs/design-notes.md` — archived design notes and future-facing ideas.

## License

MIT.
