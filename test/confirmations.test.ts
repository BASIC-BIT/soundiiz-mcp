import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllForTest,
  consumeConfirmation,
  issueConfirmation,
} from '../src/services/confirmations.js';

describe('confirmations', () => {
  beforeEach(() => clearAllForTest());

  it('issues a token that consumes successfully with matching args', () => {
    const args = { id: 42 };
    const { confirmId } = issueConfirmation('soundiiz_sync_trigger', args);
    expect(confirmId.startsWith('ct_')).toBe(true);
    const result = consumeConfirmation('soundiiz_sync_trigger', { ...args, confirmId }, confirmId);
    expect(result.ok).toBe(true);
  });

  it('rejects a token used for a different tool', () => {
    const { confirmId } = issueConfirmation('soundiiz_sync_trigger', { id: 1 });
    const result = consumeConfirmation('soundiiz_sync_delete', { id: 1, confirmId }, confirmId);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CONFIRM_TOKEN_TOOL_MISMATCH');
  });

  it('rejects a token if args change', () => {
    const { confirmId } = issueConfirmation('soundiiz_sync_trigger', { id: 1 });
    const result = consumeConfirmation(
      'soundiiz_sync_trigger',
      { id: 2, confirmId },
      confirmId
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CONFIRM_TOKEN_ARGS_CHANGED');
  });

  it('rejects an unknown token', () => {
    const result = consumeConfirmation('soundiiz_sync_trigger', { id: 1 }, 'ct_nope');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CONFIRM_TOKEN_INVALID_OR_EXPIRED');
  });

  it('is single-use', () => {
    const { confirmId } = issueConfirmation('soundiiz_sync_trigger', { id: 1 });
    const first = consumeConfirmation('soundiiz_sync_trigger', { id: 1, confirmId }, confirmId);
    expect(first.ok).toBe(true);
    const second = consumeConfirmation('soundiiz_sync_trigger', { id: 1, confirmId }, confirmId);
    expect(second.ok).toBe(false);
  });
});
