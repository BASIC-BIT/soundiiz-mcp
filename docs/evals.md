# Evals & Smoke Workflow

This is the planned evals + smoke workflow for Soundiiz MCP. It mirrors vrchat-mcp.

## Local checks (always run)

```bash
npm run check       # lint + typecheck + test
npm run test:coverage
```

These should pass on every PR. They use mock fixtures and the vendored OpenAPI spec.

## Mock E2E (always run)

`test/e2e/mock.test.ts` spins up a local mock HTTP server (driven by `test/fixtures/spec.yaml`) and runs the curated tools end-to-end through the MCP harness. No network, no API key required.

## Live smoke (opt-in)

```bash
npm run build
SOUNDIIZ_API_KEY=… npm run smoke:live
```

What it does:

- Calls each curated read tool against the real Soundiiz API.
- Asserts only structural invariants (response shape, IDs present, totals are non-negative).
- Does **not** assert specific contents — your account state changes between runs.
- Skips all write tools.

If you want stricter checks, populate `test/fixtures/e2e.live.json` (gitignored) with expected sync IDs / titles or smartlink shortcodes; `test/e2e/live.test.ts` will assert them.

## Live writes (opt-in, manual)

We do **not** run automated write tests against the real API. Soundiiz writes mutate remote streaming services; the value of automation is too low against the risk.

If you need to verify a write tool works end-to-end:

1. Pick a low-stakes target (e.g., a test sync to a throwaway destination playlist).
2. Add it to `syncs.allowlist`.
3. Run the tool through the MCP harness manually (`npm run mcp:call`).
4. Verify the response shape and the remote effect.
5. Document the steps in a private operator runbook (do not commit live IDs).

## LLM evals (opt-in)

```bash
SOUNDIIZ_API_KEY=… OPENAI_API_KEY=… npm run test:evals
```

Configured via `test/fixtures/evals.live.json` (gitignored). The evals issue natural-language prompts to a small set of LLM clients and assert the agent picks the right curated tool with the right arguments. Useful for validating tool descriptions when we tweak them.

## Smoke matrix coverage (planned)

| Tool                            | Mock | Live read smoke | Live write |
| ------------------------------- | ---- | --------------- | ---------- |
| `soundiiz_me`                   | ✅   | ✅              | n/a        |
| `soundiiz_auth_status`          | ✅   | ✅              | n/a        |
| `soundiiz_syncs_list`           | ✅   | ✅              | n/a        |
| `soundiiz_sync_get`             | ✅   | ✅ (sample id)  | n/a        |
| `soundiiz_syncs_overview`       | ✅   | ✅              | n/a        |
| `soundiiz_syncs_due`            | ✅   | ✅              | n/a        |
| `soundiiz_syncs_failures_recent`| ✅   | ✅              | n/a        |
| `soundiiz_sync_trigger`         | ✅   | ❌              | manual     |
| `soundiiz_sync_delete`          | ✅   | ❌              | manual     |
| `soundiiz_smartlinks_list`      | ✅   | ✅              | n/a        |
| `soundiiz_smartlink_get`        | ✅   | ✅ (sample id)  | n/a        |
| `soundiiz_smartlinks_overview`  | ✅   | ✅              | n/a        |
| `soundiiz_smartlink_delete`     | ✅   | ❌              | manual     |

## Spec-drift watcher (planned)

A weekly CI job:

1. Runs `npm run sync:spec`.
2. Diffs `specs/soundiiz-openapi.json`.
3. Opens a PR titled "chore(spec): refresh Soundiiz OpenAPI" if there's a delta.
4. Maintainers review, regenerate Zod, fix any breakage, merge.
