# Tools Guide

This is the human-oriented overview for how to use the tool surface. The full, generated catalog of exposed tools (with schemas) will live in `docs/tools.md` once the build pipeline is in place.

## How to use tools

- Prefer **curated tools** first. They are designed for agent ergonomics and include summary flows.
- Use **auto-generated tools** (`soundiiz_read_<operationId>`, `soundiiz_write_<operationId>`) only when a curated tool does not exist.
- **Writes are opt-in**. Set `writes.allow = true` (or `SOUNDIIZ_MCP_ALLOW_WRITES=true`) to enable any non-GET operation.
- **Destructive writes (DELETE, sync trigger) require a confirmation token** unless `writes.confirmDestructive=false`. The first call returns `confirm_required` with a `confirmId`; the second call (same args + `confirmId`) executes.
- Sync write actions can be restricted by `syncs.allowlist`. SmartLink write actions can be restricted by `smartlinks.allowlist`.

## Typical agent flows

### "What's going on with my syncs?"

```
soundiiz_syncs_overview
  → returns: total=12, byStatus={idle:10, processing:1, pending:1},
    byFrequency={daily:5, weekly:6, monthly:1},
    dueSoon=[{id:42, title:"Workout", nextExecutionDate:…}, …],
    recentFailures=[{id:7, error:"PLATFORM_DISCONNECTED", endDate:…}, …]
```

### "Show me sync 42 in full"

```
soundiiz_sync_get { id: 42 }
  → returns full sync incl. lastExecutionResult{score, nbTrackSource, nbTrackDestination, error}
```

### "Run sync 42 now"

```
soundiiz_sync_trigger { id: 42 }
  → returns: { confirm_required, confirmId: "ct_…", recap: "Trigger sync 42 (Workout, spotify→deezer, replace mode)" }
soundiiz_sync_trigger { id: 42, confirmId: "ct_…" }
  → returns: { status: "accepted", message: "SYNC_EXECUTION_ACCEPTED" }
```

### "Delete the stale draft SmartLink"

```
soundiiz_smartlinks_list { status: "draft" }
  → returns compact rows incl. ids
soundiiz_smartlink_delete { id: 101 }
  → confirm_required + confirmId
soundiiz_smartlink_delete { id: 101, confirmId: "ct_…" }
  → deleted
```

## Where the truth lives

- `docs/tools.md` will be generated from code + the OpenAPI spec and reflect the actual exposed tools.
- `docs/curated-tools.md` describes the curated tool charter and risk tiers.
- `specs/soundiiz-openapi.json` is the vendored Soundiiz User API spec we generate from.
