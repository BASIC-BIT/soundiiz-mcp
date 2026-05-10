import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig } from '../../config/index.js';
import { CallError } from '../../core/client.js';
import { checkSyncAllowed } from '../../services/allowlist.js';
import { consumeConfirmation, issueConfirmation } from '../../services/confirmations.js';
import {
  deleteSync,
  getSync,
  listAllSyncs,
  listSyncsPage,
  triggerSync,
  type SyncDetail,
  type SyncSummary,
} from '../../services/syncs/index.js';
import { toolError, toolJson } from '../../utils/toolResponses.js';

function compactSync(s: SyncSummary) {
  return {
    id: s.id,
    title: s.title,
    source: `${s.source.serviceName}:${s.source.type}:${s.source.id}`,
    destination: `${s.destination.serviceName}:${s.destination.type}:${s.destination.id}`,
    method: s.method,
    frequency: s.frequency,
    status: s.status,
    nextExecutionDate: s.nextExecutionDate,
    lastExecutionDate: s.lastExecutionDate,
    scheduled: s.scheduled,
  };
}

function isCallError(err: unknown): err is CallError {
  return err instanceof CallError;
}

function asToolError(err: unknown) {
  if (isCallError(err)) {
    return toolError(err.message, err.payload ?? { error: err.message });
  }
  return toolError((err as Error).message);
}

export function registerCuratedSyncTools(server: McpServer): void {
  server.tool(
    'soundiiz_syncs_list',
    'List Soundiiz syncs as compact rows. Auto-paginates by default; pass paginated=true for a single page.',
    {
      paginated: z.boolean().optional().describe('If true, return only one page.'),
      offset: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ paginated, offset, limit }) => {
      try {
        if (paginated) {
          const page = await listSyncsPage(offset ?? 0, limit ?? 50);
          return toolJson({
            offset: page.offset,
            limit: page.limit,
            total: page.total,
            items: page.items.map(compactSync),
          });
        }
        const all = await listAllSyncs();
        return toolJson({ total: all.length, items: all.map(compactSync) });
      } catch (err) {
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_sync_get',
    'Get a single Soundiiz sync by id, including lastExecutionResult.',
    { id: z.number().int().positive() },
    async ({ id }) => {
      try {
        const detail = await getSync(id);
        return toolJson(detail);
      } catch (err) {
        if (isCallError(err) && err.status === 404) {
          return toolJson({
            ok: false,
            status: 404,
            message: 'SYNC_NOT_FOUND',
            hint: 'Use soundiiz_syncs_list to discover valid sync IDs.',
          });
        }
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_syncs_overview',
    'Counts and shortlists across all syncs: by status, by frequency, by source/destination platform pair, plus dueSoon and recentFailures.',
    {
      dueWithinHours: z.number().positive().optional().describe('Default 24'),
      recentFailureLimit: z.number().int().positive().max(50).optional().describe('Default 10'),
    },
    async ({ dueWithinHours, recentFailureLimit }) => {
      try {
        const items = await listAllSyncs();
        const now = Math.floor(Date.now() / 1000);
        const window = (dueWithinHours ?? 24) * 3600;
        const failureLimit = recentFailureLimit ?? 10;

        const byStatus: Record<string, number> = {};
        const byFrequency: Record<string, number> = {};
        const byPair: Record<string, number> = {};
        for (const s of items) {
          byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
          byFrequency[s.frequency] = (byFrequency[s.frequency] ?? 0) + 1;
          const pair = `${s.source.serviceName}->${s.destination.serviceName}`;
          byPair[pair] = (byPair[pair] ?? 0) + 1;
        }

        const dueSoon = items
          .filter((s) => s.scheduled && s.nextExecutionDate && s.nextExecutionDate - now <= window)
          .sort((a, b) => (a.nextExecutionDate ?? 0) - (b.nextExecutionDate ?? 0))
          .slice(0, 25)
          .map(compactSync);

        // Failure detection requires the per-sync detail; do a best-effort scan limited to N most recent.
        type FailureRow = ReturnType<typeof compactSync> & { error?: string | null };
        const recentFailures: FailureRow[] = [];
        const candidates = items
          .filter((s) => s.lastExecutionDate)
          .sort((a, b) => (b.lastExecutionDate ?? 0) - (a.lastExecutionDate ?? 0))
          .slice(0, Math.min(50, items.length));
        for (const candidate of candidates) {
          if (recentFailures.length >= failureLimit) break;
          try {
            const detail: SyncDetail = await getSync(candidate.id);
            if (detail.lastExecutionResult?.status === 'error') {
              recentFailures.push({
                ...compactSync(detail),
                error: detail.lastExecutionResult.error,
              });
            }
          } catch {
            // skip
          }
        }

        return toolJson({
          total: items.length,
          byStatus,
          byFrequency,
          byPair,
          dueSoon,
          recentFailures,
        });
      } catch (err) {
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_syncs_due',
    'Return syncs scheduled to run within the given window (default 24 hours).',
    { withinHours: z.number().positive().optional() },
    async ({ withinHours }) => {
      try {
        const items = await listAllSyncs();
        const now = Math.floor(Date.now() / 1000);
        const window = (withinHours ?? 24) * 3600;
        const due = items
          .filter((s) => s.scheduled && s.nextExecutionDate && s.nextExecutionDate - now <= window)
          .sort((a, b) => (a.nextExecutionDate ?? 0) - (b.nextExecutionDate ?? 0))
          .map(compactSync);
        return toolJson({ withinHours: withinHours ?? 24, count: due.length, items: due });
      } catch (err) {
        return asToolError(err);
      }
    }
  );

  registerSyncWriteTools(server);
}

function registerSyncWriteTools(server: McpServer): void {
  server.tool(
    'soundiiz_sync_trigger',
    'Trigger execution of a Soundiiz sync. Returns a confirmId on the first call; re-call with the same args plus that confirmId to execute (skip via writes.confirmDestructive=false).',
    {
      id: z.number().int().positive(),
      confirmId: z.string().optional(),
    },
    async (args) => {
      const config = getConfig();
      if (!config.writes.allow) {
        return toolError('Writes are disabled in config (writes.allow=false).');
      }
      const allowed = checkSyncAllowed(args.id);
      if (!allowed.ok) return toolError(allowed.reason!);

      if (config.writes.confirmDestructive) {
        if (!args.confirmId) {
          const ticket = issueConfirmation('soundiiz_sync_trigger', args);
          return toolJson({
            confirm_required: true,
            recap: `Trigger sync #${args.id} now`,
            ...ticket,
            replayInstruction:
              'Re-call soundiiz_sync_trigger with the same arguments plus this confirmId to execute.',
          });
        }
        const check = consumeConfirmation('soundiiz_sync_trigger', args, args.confirmId);
        if (!check.ok) return toolError(check.reason!);
      }

      try {
        const data = await triggerSync(args.id, { internalOverrideWriteGate: true });
        return toolJson({ ok: true, data });
      } catch (err) {
        if (isCallError(err) && err.status === 409) {
          return toolJson({
            ok: false,
            status: 409,
            message: err.message,
            hint:
              'Either this sync is already in progress (SYNC_PROCESSING/SYNC_PENDING) or you have too many concurrent syncs (TOO_MANY_SYNCS_IN_PROGRESS). Wait, then retry.',
          });
        }
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_sync_delete',
    'Delete a Soundiiz sync. Returns a confirmId on the first call; re-call with the same args plus that confirmId to execute (skip via writes.confirmDestructive=false).',
    {
      id: z.number().int().positive(),
      confirmId: z.string().optional(),
    },
    async (args) => {
      const config = getConfig();
      if (!config.writes.allow) {
        return toolError('Writes are disabled in config (writes.allow=false).');
      }
      const allowed = checkSyncAllowed(args.id);
      if (!allowed.ok) return toolError(allowed.reason!);

      if (config.writes.confirmDestructive) {
        if (!args.confirmId) {
          const ticket = issueConfirmation('soundiiz_sync_delete', args);
          return toolJson({
            confirm_required: true,
            recap: `DELETE sync #${args.id}`,
            ...ticket,
            replayInstruction:
              'Re-call soundiiz_sync_delete with the same arguments plus this confirmId to execute.',
          });
        }
        const check = consumeConfirmation('soundiiz_sync_delete', args, args.confirmId);
        if (!check.ok) return toolError(check.reason!);
      }

      try {
        const data = await deleteSync(args.id, { internalOverrideWriteGate: true });
        return toolJson({ ok: true, data });
      } catch (err) {
        if (isCallError(err) && err.status === 409) {
          return toolJson({
            ok: false,
            status: 409,
            message: err.message,
            hint: 'Sync is currently processing or pending. Wait for it to finish before deleting.',
          });
        }
        if (isCallError(err) && err.status === 404) {
          return toolJson({ ok: false, status: 404, message: 'SYNC_NOT_FOUND' });
        }
        return asToolError(err);
      }
    }
  );
}
