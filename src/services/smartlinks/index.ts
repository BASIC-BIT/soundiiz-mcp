import { callOperation, type CallOptions } from '../../core/client.js';
import { invalidate, withCache } from '../cache.js';

export interface SmartlinkLink {
  id: number;
  type: string;
  platform: string;
  url: string;
}

export interface SmartlinkSummary {
  id: number;
  type: string;
  subDomain: string | null;
  shortcode: string;
  category: 'playlist' | 'album' | 'track' | 'artist';
  fallback: string;
  title: string;
  artist: string;
  description: string | null;
  addedDate: number;
  updatedDate: number;
  links: SmartlinkLink[];
  status: 'draft' | 'published';
}

interface ListResponse {
  data: {
    items: SmartlinkSummary[];
    offset: number;
    limit: number;
    total: number;
  };
}

interface DetailResponse {
  data: SmartlinkSummary;
}

const DEFAULT_PAGE_SIZE = 100;

export interface ListPage {
  items: SmartlinkSummary[];
  offset: number;
  limit: number;
  total: number;
}

export async function listSmartlinksPage(offset = 0, limit = DEFAULT_PAGE_SIZE): Promise<ListPage> {
  return withCache('smartlinksList', `${offset}:${limit}`, async () => {
    const result = await callOperation({
      operationId: 'get_soundiiz_openapi_v1_merest_getmesmartlinks',
      params: { offset, limit },
    });
    return (result.data as ListResponse).data;
  });
}

export async function listAllSmartlinks(): Promise<SmartlinkSummary[]> {
  const all: SmartlinkSummary[] = [];
  let offset = 0;
  for (;;) {
    const page = await listSmartlinksPage(offset, DEFAULT_PAGE_SIZE);
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) break;
    if (offset > 10_000) break;
  }
  return all;
}

export async function getSmartlink(id: number): Promise<SmartlinkSummary> {
  return withCache('smartlinkDetail', id, async () => {
    const result = await callOperation({
      operationId: 'get_soundiiz_openapi_v1_merest_getmesmartlinksdetails',
      params: { id },
    });
    return (result.data as DetailResponse).data;
  });
}

export async function deleteSmartlink(id: number, options?: CallOptions): Promise<unknown> {
  const result = await callOperation({
    operationId: 'delete_soundiiz_openapi_v1_merest_getmesmartlinksdelete',
    params: { id },
    options,
  });
  invalidate('smartlinksList');
  invalidate('smartlinkDetail', id);
  return result.data;
}
