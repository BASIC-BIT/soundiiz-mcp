# Contributing

Thanks for your interest! A few quick notes before opening a PR.

## Local checks

```bash
npm install
npm run check   # lint + typecheck + test
```

## Spec changes

The Soundiiz User API is BETA. If upstream shifts:

```bash
npm run sync:spec     # refetches specs/soundiiz-openapi.json
npm run check
npm run generate:tools-docs
```

Commit the spec diff in its own commit.

## Safety review

When adding a tool, classify it in `docs/curated-tools.md` under one of the risk tiers (read / low / medium / destructive). Destructive writes must require a confirmation token unless explicitly disabled in config.

Never commit a real Soundiiz API key, even in fixtures.
