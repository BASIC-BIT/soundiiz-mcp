import { describe, expect, it } from 'vitest';
import { getSpecIndex, clearSpecCache } from '../src/core/spec.js';

describe('spec', () => {
  it('parses the vendored Soundiiz OpenAPI spec', () => {
    clearSpecCache();
    const index = getSpecIndex();
    const ops = Array.from(index.operations.values());
    expect(ops.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(ops.map((o) => o.operationId));
    for (const expected of [
      'get_soundiiz_openapi_v1_merest_getme',
      'get_soundiiz_openapi_v1_merest_getmesyncs',
      'get_soundiiz_openapi_v1_merest_getmesyncsdetails',
      'delete_soundiiz_openapi_v1_merest_getmesyncsdelete',
      'post_soundiiz_openapi_v1_merest_getmesyncsexecute',
      'get_soundiiz_openapi_v1_merest_getmesmartlinks',
      'get_soundiiz_openapi_v1_merest_getmesmartlinksdetails',
      'delete_soundiiz_openapi_v1_merest_getmesmartlinksdelete',
    ]) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it('flags id as a required path parameter on detail endpoints', () => {
    const op = getSpecIndex().operations.get('get_soundiiz_openapi_v1_merest_getmesyncsdetails');
    expect(op).toBeDefined();
    const idParam = op!.parameters.find((p) => p.name === 'id');
    expect(idParam?.in).toBe('path');
    expect(idParam?.required).toBe(true);
  });
});
