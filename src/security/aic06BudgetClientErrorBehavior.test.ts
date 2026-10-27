import { describe, expect, test } from 'bun:test';
import { parseLibraryProposalServiceError } from '../services/libraryProposalErrors';

describe('AIC-06 client budget escalation error', () => {
  test('preserves the stable budget reason without exposing provider tuning', () => {
    const error = parseLibraryProposalServiceError({
      error: {
        code: 'AI_BUDGET_ESCALATION_REQUIRED',
        message: 'provider-internal-message-that-must-not-win',
        retriable: false,
        requestId: 'request-aic06',
        reason: 'BINARY_SOURCE'
      }
    }, 409) as any;

    expect(error.code).toBe('AI_BUDGET_ESCALATION_REQUIRED');
    expect(error.status).toBe(409);
    expect(error.retriable).toBe(false);
    expect(error.requestId).toBe('request-aic06');
    expect(error.budgetReason).toBe('BINARY_SOURCE');
    expect(error.message).toContain('più impegnativa');
    expect(error.message).not.toContain('provider-internal');
  });

  test('unknown budget reason falls back to the generic governed explanation', () => {
    const error = parseLibraryProposalServiceError({
      error: {
        code: 'AI_BUDGET_ESCALATION_REQUIRED',
        retriable: false,
        reason: 'ATTACKER_DEFINED_REASON'
      }
    }, 409) as any;

    expect(error.code).toBe('AI_BUDGET_ESCALATION_REQUIRED');
    expect(error.budgetReason).toBeUndefined();
    expect(error.message).toContain('più capacità');
  });
});
