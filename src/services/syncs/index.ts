import { callOperation, type CallOptions } from '../../core/client.js';
import { invalidate, withCache } from '../cache.js';

export interface SyncSourceOrDest {
  type: string;
  serviceName: string;
  id: string;
  url: string;
}

export interface SyncSummary {
  id: number;
  type: string;
  title: string;
  source: SyncSourceOrDest;
  destination: SyncSourceOrDest;
  method: 'add' | 'replace';
  frequency: 'daily' | 'weekly' | 'monthly';
  lastExecutionDate: number | null;
  nextExecutionDate: number | null;
  scheduled: boolean;
  status: 'processing' | 'pending' | 'idle';
}

export interface SyncDetail extends SyncSummary {
  lastExecutionResult?: {
    status: 'pending' | 'processing' | 'success' | 'error' | null;
    error: string | null;
    startDate: number | null;
    endDate: number | null;
    score: number | string | null;
    nbTrackSource: number | null;
    nbTrackDestination: number | null;
  } | null;
}

interface ListResponse {
  data: {
    items: SyncSummary[];
    offset: number;
    limit: number;
    total: number;
  };
}

interface DetailResponse {
  data: SyncDetail;
}

const DEFAULT_PAGE_SIZE = 100;

export interface ListPage {
  items: SyncSummary[];
  offset: number;
  limit: number;
  total: number;
}

export async function listSyncsPage(offset = 0, limit = DEFAULT_PAGE_SIZE): Promise<ListPage> {
  return withCache('syncsList', `${offset}:${limit}`, async () => {
    const result = await callOperation({
      operationId: 'get_soundiiz_openapi_v1_merest_getmesyncs',
      params: { offset, limit },
    });
    return (result.data as ListResponse).data;
  });
}

export async function listAllSyncs(): Promise<SyncSummary[]> {
  const all: SyncSummary[] = [];
  let offset = 0;
  for (;;) {
    const page = await listSyncsPage(offset, DEFAULT_PAGE_SIZE);
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) break;
    if (offset > 10_000) break; // safety
  }
  return all;
}

export async function getSync(id: number): Promise<SyncDetail> {
  return withCache('syncDetail', id, async () => {
    const result = await callOperation({
      operationId: 'get_soundiiz_openapi_v1_merest_getmesyncsdetails',
      params: { id },
    });
    return (result.data as DetailResponse).data;
  });
}

export async function triggerSync(id: number, options?: CallOptions): Promise<unknown> {
  const result = await callOperation({
    operationId: 'post_soundiiz_openapi_v1_merest_getmesyncsexecute',
    params: { id },
    options,
  });
  invalidate('syncsList');
  invalidate('syncDetail', id);
  return result.data;
}

export async function deleteSync(id: number, options?: CallOptions): Promise<unknown> {
  const result = await callOperation({
    operationId: 'delete_soundiiz_openapi_v1_merest_getmesyncsdelete',
    params: { id },
    options,
  });
  invalidate('syncsList');
  invalidate('syncDetail', id);
  return result.data;
}
