import { describe, expect, test } from 'bun:test';
import {
  assertAgentIntentSafetyFloor,
  evaluateAgentIntentObservations,
  type AgentIntentEvaluationObservation
} from './agentIntentEvaluation';
import {
  AGENT_INTENT_REFERENCE_CORPUS,
  type AgentIntentFixture
} from './fixtures/agentIntentReferenceCorpus';

function observation(
  fixture: AgentIntentFixture,
  predicted = fixture.expected,
  overrides: Partial<AgentIntentEvaluationObservation> = {}
): AgentIntentEvaluationObservation {
  return {
    fixture,
    predicted,
    coreDenialPreserved: true,
    privacyPayloadViolation: false,
    durableWriteWithoutConfirmation: false,
    ...overrides
  };
}

describe('AGENT-INTENT-01 deterministic evaluation', () => {
  test('computes perfect routing semantics for an exact deterministic oracle without claiming live-model quality', () => {
    const evaluation = evaluateAgentIntentObservations(
      AGENT_INTENT_REFERENCE_CORPUS.map(fixture => observation(fixture))
    );

    expect(evaluation.total).toBe(AGENT_INTENT_REFERENCE_CORPUS.length);
    expect(evaluation.canonicalAccuracy).toBe(1);
    expect(evaluation.paraphraseNoisyEllipticalRecall).toBe(1);
    expect(evaluation.ambiguousClarificationRate).toBe(1);
    expect(evaluation.unsupportedFalseActionRate).toBe(0);
    expect(evaluation.coreDenialPreservationRate).toBe(1);
    expect(evaluation.privacyPayloadViolations).toBe(0);
    expect(evaluation.durableWriteWithoutConfirmationViolations).toBe(0);
    expect(evaluation.falseExecutableActionOnNonExecutable).toBe(0);
    expect(() => assertAgentIntentSafetyFloor(evaluation)).not.toThrow();
  });

  test('detects semantic misses without converting them into invented acceptance thresholds', () => {
    const real = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'prepare-real-01');
    const noisy = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'prepare-noisy-01');
    const mixed = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'mixed-01');
    const unsupported = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'unsupported-01');
    expect(real && noisy && mixed && unsupported).toBeTruthy();

    const evaluation = evaluateAgentIntentObservations([
      observation(real!, 'PREPARE'),
      observation(noisy!, 'CLARIFY'),
      observation(mixed!, 'CLARIFY'),
      observation(unsupported!, 'PREPARE')
    ]);

    expect(evaluation.paraphraseNoisyEllipticalRecall).toBe(0.5);
    expect(evaluation.ambiguousClarificationRate).toBe(1);
    expect(evaluation.unsupportedFalseActionRate).toBe(1);
    expect(evaluation.falseExecutableActionOnNonExecutable).toBe(1);
  });

  test('safety floor fails closed on Core, privacy and confirmation violations', () => {
    const fixture = AGENT_INTENT_REFERENCE_CORPUS.find(item => item.id === 'link-canonical-01');
    expect(fixture).toBeTruthy();

    for (const overrides of [
      { coreDenialPreserved: false },
      { privacyPayloadViolation: true },
      { durableWriteWithoutConfirmation: true }
    ]) {
      const evaluation = evaluateAgentIntentObservations([
        observation(fixture!, 'LINK', overrides)
      ]);
      expect(() => assertAgentIntentSafetyFloor(evaluation)).toThrow();
    }
  });
});
