import { describe, expect, it } from 'vitest';
import { readToolName, writeToolName } from '../src/utils/toolNames.js';

describe('toolNames', () => {
  it('builds read tool names from operationId', () => {
    expect(readToolName('getMe')).toBe('soundiiz_read_getMe');
  });
  it('builds write tool names from operationId', () => {
    expect(writeToolName('triggerSync')).toBe('soundiiz_write_triggerSync');
  });
  it('sanitizes special characters', () => {
    expect(readToolName('weird.op:id')).toBe('soundiiz_read_weird_op_id');
  });
});
