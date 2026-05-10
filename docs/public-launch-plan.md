# Public Launch Plan

This is the working checklist for taking Soundiiz MCP from a fresh repo to a publishable, discoverable MCP server. It mirrors the vrchat-mcp launch playbook so we can keep the same discipline.

## Goals

- Make the project discoverable to people searching for Soundiiz, MCP, Claude, OpenCode, music sync automation, and SmartLinks tooling.
- Keep trust and safety as the leading message: read-only by default, local-first authentication, explicit and confirmation-gated writes, and no affiliation with Soundiiz.
- Prefer durable developer surfaces over broad paid ads for the first launch.
- Use a short feedback loop: ship public, watch installs / issues / stars / registry traffic, then decide whether broader promotion is worth it.

## Launch Gates

| Gate                 | Required Before Public Launch | Notes                                                                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Architecture + tools | Yes                           | Curated tools + auto-generated layers built and tested against the mock server.                        |
| Live smoke           | Yes                           | `npm run smoke:live` against a Creator-plan key. Fixture stays gitignored.                             |
| Confirmation flow    | Yes                           | DELETE + sync trigger require a `confirmId` by default. Prove with a test.                             |
| README               | Yes                           | Public-facing README with safety model up top.                                                         |
| Repo metadata        | Yes                           | Description, homepage, and topics set via `gh repo edit`.                                              |
| Social preview       | Yes                           | Add `assets/social-preview.png` (1280x640).                                                            |
| Logo                 | Recommended                   | `assets/logo.svg` for README header parity with vrchat-mcp.                                            |
| Release notes        | Yes                           | Add `CHANGELOG.md` before tagging `v0.1.0`.                                                            |
| Package validation   | Yes                           | `npm run check`, `npm run build`, `npm pack --dry-run` on final `main`.                                |
| npm publish decision | Yes                           | Official MCP Registry expects a public package artifact for npm-based servers.                         |

## Primary Discovery Surfaces

| Surface                   | Why It Matters                                                                                        | Action                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GitHub repository         | Primary source of trust, docs, issues, stars, and topic discovery.                                    | Make public, add social preview manually, create `v0.1.0` release.                                         |
| npm                       | Install path and prerequisite for official MCP Registry metadata.                                     | Publish `soundiiz-mcp@0.1.0`. Decide unscoped vs scoped (`@basic-bit/soundiiz-mcp`).                       |
| Official MCP Registry     | Upstream source of truth for MCP server discovery. Other registries may consume it.                   | Add `mcpName`, publish npm package, create `server.json`, authenticate with `mcp-publisher`, then publish. |
| GitHub MCP Registry       | High-intent discovery inside GitHub's MCP ecosystem.                                                  | Verify listing after official MCP Registry submission.                                                     |
| Smithery                  | MCP marketplace with install/distribution workflow.                                                   | Submit after public repo + npm package are stable. Use safety-first description.                           |
| MCP.so                    | Third-party MCP marketplace with a visible Submit flow.                                               | Submit via `https://mcp.so/submit` after public release.                                                   |
| Glama MCP Servers         | Large indexed MCP directory.                                                                          | Use Add Server flow after public release.                                                                  |
| Awesome MCP Servers lists | High-reach GitHub discovery.                                                                          | Submit PRs to `punkpeye/awesome-mcp-servers` and `appcypher/awesome-mcp-servers` after public release.     |

## Official MCP Registry Steps

1. Confirm final npm package name and publish strategy.
2. Add `mcpName` to `package.json` before npm publishing.
3. Verify namespace rules for `BASIC-BIT`.
4. Publish the package to npm.
5. Install `mcp-publisher`.
6. Run `mcp-publisher init` and review generated `server.json`.
7. Ensure `server.json` declares stdio transport, required env vars (`SOUNDIIZ_API_KEY`), repository URL, and exact package version.
8. Run `mcp-publisher login github`.
9. Run `mcp-publisher publish`.
10. Verify via registry API search.

Candidate server description:

```text
Local-first MCP server for safe AI access to Soundiiz syncs and SmartLinks. Read-only by default with confirmation-gated writes. Requires a Creator-plan API key.
```

## Community Launch Channels

Use these after the repo is public.

| Channel                              | Fit          | Notes                                                                                       |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------- |
| MCP Discord / registry discussions   | High         | Best early feedback channel for registry correctness and MCP ergonomics.                    |
| GitHub release announcement          | High         | Durable link for registries and social posts.                                               |
| Soundiiz Twitter / Bluesky reply     | Medium       | Reply to `@SoundiizExp` API tweets / changelog posts. Be transparent: unofficial.           |
| Reddit r/spotify, r/musicstreaming   | Medium       | Frame as open-source tooling, lead with safety model and Creator-plan requirement.          |
| Hacker News Show HN                  | Medium       | Worth considering once README + install path are clean. Lead with local-first safety.       |
| X / Mastodon                         | Medium       | Post in MCP-builder circles with a concrete demo prompt.                                    |
| Product Hunt                         | Low (v0.1)   | More work than value unless we have screenshots, demo video, and a polished install path.   |

## Paid Awareness

Do not start with paid for the first public release.

If we test paid later, use a capped experiment:

- Budget: $10–$25/day for 7 days.
- Channels: exact-match Google Search, sponsor placement on an MCP directory if available.
- Keywords: `Soundiiz MCP`, `Soundiiz Claude`, `Soundiiz API automation`, `playlist sync MCP`.
- Landing page: GitHub README.
- Success metric: qualified installs, stars, issues, npm downloads — not impressions.

## Launch Copy Kit

Short description:

```text
Soundiiz MCP gives AI assistants safe, local-first access to Soundiiz syncs and SmartLinks, with read-only defaults and confirmation-gated writes.
```

One paragraph:

```text
Soundiiz MCP is an unofficial Model Context Protocol server for the Soundiiz User API. It is read-only by default, keeps your API key local, and gives MCP clients like Claude Desktop and OpenCode curated tools to inspect sync jobs, summarize SmartLinks, and (with explicit opt-in) trigger or clean them up.
```

Launch post draft:

```text
I am releasing Soundiiz MCP, an unofficial local-first MCP server for Soundiiz.

It lets MCP clients answer questions like "which of my syncs are due to run today" and "which SmartLinks are still drafts," and can trigger or delete syncs/links after you opt in to writes.

Requires a Soundiiz Creator-plan API key (User API is in BETA).

Repo: <PUBLIC_REPO_URL>
```

Registry tags:

```text
soundiiz, mcp, model-context-protocol, claude, opencode, typescript, music, playlist, smartlinks, sync
```

## Manual GitHub Settings

Upload `assets/social-preview.png` (1280x640) at:

```text
Settings -> General -> Social preview -> Edit -> Upload an image
```

## First 48 Hours After Public Release

- Watch GitHub issues and discussions closely.
- Pin or link one canonical install/config answer if repeated questions appear.
- Keep a short known-issues section in the release notes (especially around BETA spec drift).
- Avoid enabling write-heavy demos until users understand the write opt-in + confirmation model.
- Track which channels actually send qualified users.

## Open Questions

- Unscoped npm `soundiiz-mcp` or `@basic-bit/soundiiz-mcp`?
- Add `server.json` to the repo before or during npm publication?
- Demo GIF/video before or after `v0.1.0`?
- Should we ship a tiny `npx soundiiz-mcp test-key` helper for first-time users to validate their key without an MCP client?
- How do we want to surface the BETA-spec churn risk in the README — a banner, a FAQ entry, or both?
