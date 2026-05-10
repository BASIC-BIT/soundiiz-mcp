import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig } from '../../config/index.js';
import { CallError } from '../../core/client.js';
import { checkSmartlinkAllowed } from '../../services/allowlist.js';
import { consumeConfirmation, issueConfirmation } from '../../services/confirmations.js';
import {
  deleteSmartlink,
  getSmartlink,
  listAllSmartlinks,
  listSmartlinksPage,
  type SmartlinkSummary,
} from '../../services/smartlinks/index.js';
import { toolError, toolJson } from '../../utils/toolResponses.js';

function compactSmartlink(s: SmartlinkSummary) {
  return {
    id: s.id,
    shortcode: s.shortcode,
    title: s.title,
    artist: s.artist,
    category: s.category,
    status: s.status,
    platforms: s.links.map((l) => l.platform),
    fallback: s.fallback,
    updatedDate: s.updatedDate,
    subDomain: s.subDomain,
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

export function registerCuratedSmartlinkTools(server: McpServer): void {
  server.tool(
    'soundiiz_smartlinks_list',
    'List Soundiiz SmartLinks as compact rows. Auto-paginates by default; pass paginated=true for one page.',
    {
      paginated: z.boolean().optional(),
      offset: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      status: z.enum(['draft', 'published']).optional(),
    },
    async ({ paginated, offset, limit, status }) => {
      try {
        if (paginated) {
          const page = await listSmartlinksPage(offset ?? 0, limit ?? 50);
          const filtered = status ? page.items.filter((s) => s.status === status) : page.items;
          return toolJson({
            offset: page.offset,
            limit: page.limit,
            total: page.total,
            items: filtered.map(compactSmartlink),
          });
        }
        const all = await listAllSmartlinks();
        const filtered = status ? all.filter((s) => s.status === status) : all;
        return toolJson({ total: filtered.length, items: filtered.map(compactSmartlink) });
      } catch (err) {
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_smartlink_get',
    'Get a single Soundiiz SmartLink by id, including all per-platform links.',
    { id: z.number().int().positive() },
    async ({ id }) => {
      try {
        const detail = await getSmartlink(id);
        return toolJson(detail);
      } catch (err) {
        if (isCallError(err) && err.status === 404) {
          return toolJson({
            ok: false,
            status: 404,
            message: 'SMARTLINK_NOT_FOUND',
            hint: 'Use soundiiz_smartlinks_list to discover valid IDs.',
          });
        }
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_smartlinks_overview',
    'Counts across all SmartLinks: by status, by category, by platform across all link members; plus most-recently-updated.',
    { recentLimit: z.number().int().positive().max(50).optional().describe('Default 10') },
    async ({ recentLimit }) => {
      try {
        const items = await listAllSmartlinks();
        const byStatus: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byPlatform: Record<string, number> = {};
        for (const s of items) {
          byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
          byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
          for (const link of s.links) {
            byPlatform[link.platform] = (byPlatform[link.platform] ?? 0) + 1;
          }
        }
        const recentlyUpdated = [...items]
          .sort((a, b) => b.updatedDate - a.updatedDate)
          .slice(0, recentLimit ?? 10)
          .map(compactSmartlink);
        return toolJson({
          total: items.length,
          byStatus,
          byCategory,
          byPlatform,
          recentlyUpdated,
        });
      } catch (err) {
        return asToolError(err);
      }
    }
  );

  server.tool(
    'soundiiz_smartlink_delete',
    'Delete a Soundiiz SmartLink. Returns a confirmId on the first call; re-call with the same args plus that confirmId to execute (skip via writes.confirmDestructive=false).',
    {
      id: z.number().int().positive(),
      confirmId: z.string().optional(),
    },
    async (args) => {
      const config = getConfig();
      if (!config.writes.allow) {
        return toolError('Writes are disabled in config (writes.allow=false).');
      }
      const allowed = checkSmartlinkAllowed(args.id);
      if (!allowed.ok) return toolError(allowed.reason!);

      if (config.writes.confirmDestructive) {
        if (!args.confirmId) {
          const ticket = issueConfirmation('soundiiz_smartlink_delete', args);
          return toolJson({
            confirm_required: true,
            recap: `DELETE SmartLink #${args.id}`,
            ...ticket,
            replayInstruction:
              'Re-call soundiiz_smartlink_delete with the same arguments plus this confirmId to execute.',
          });
        }
        const check = consumeConfirmation('soundiiz_smartlink_delete', args, args.confirmId);
        if (!check.ok) return toolError(check.reason!);
      }

      try {
        const data = await deleteSmartlink(args.id, { internalOverrideWriteGate: true });
        return toolJson({ ok: true, data });
      } catch (err) {
        if (isCallError(err) && err.status === 404) {
          return toolJson({ ok: false, status: 404, message: 'SMARTLINK_NOT_FOUND' });
        }
        return asToolError(err);
      }
    }
  );
}
