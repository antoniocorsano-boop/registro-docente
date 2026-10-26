import { describe, expect, test } from 'bun:test';
import { discoverLibraryCopilotIntent } from './contextualCoreAdapter';
import { evaluateLibraryIntentCorpus } from './intentEvaluation';
import {
  LIBRARY_INTENT_REFERENCE_CORPUS,
  type LibraryIntentExpected
} from './fixtures/libraryIntentReferenceCorpus';
import type { LibrarySource } from './types';

const SUPPORTED_ACTION_IDS = new Set<LibraryIntentExpected>([
  'review-source',
  'link-source-to-uda',
  'prepare-from-source'
]);

const makeSource = (): LibrarySource => ({
  id: 'intent-reference-corpus-source',
  kind: 'note',
  title: 'Fonte sintetica corpus intenti',
  capturedAt: '2026-10-26T06:00:00.000Z',
  origin: 'fixture Task 5',
  payload: { text: 'Materiale professionale sintetico usato solo per qualificare il routing locale.' },
  extractedText: 'Materiale professionale sintetico usato solo per qualificare il routing locale.',
  status: 'ready',
  privacy: 'teacher-professional',
  links: [],
  notes: ''
});

async function discoverExpected(utterance: string): Promise<LibraryIntentExpected> {
  const result = await discoverLibraryCopilotIntent({
    source: makeSource(),
    message: utterance
  });

  if (result.status !== 'DISCOVERED' || result.intents.length !== 1) {
    return 'NO_INTENT_MATCH';
  }

  const actionId = result.intents[0]?.actionId as LibraryIntentExpected | undefined;
  return actionId && SUPPORTED_ACTION_IDS.has(actionId) ? actionId : 'NO_INTENT_MATCH';
}

describe('Task 5 library intent reference corpus', () => {
  test('freezes the approved coverage before any tuning', () => {
    const corpus = LIBRARY_INTENT_REFERENCE_CORPUS;
    expect(corpus.filter(item => item.expected === 'review-source')).toHaveLength(12);
    expect(corpus.filter(item => item.expected === 'link-source-to-uda')).toHaveLength(12);
    expect(corpus.filter(item => item.expected === 'prepare-from-source')).toHaveLength(12);
    expect(corpus.filter(item => item.class === 'mixed')).toHaveLength(12);
    expect(corpus.filter(item => item.class === 'oos' || item.class === 'hard-negative')).toHaveLength(20);
    expect(new Set(corpus.map(item => item.id)).size).toBe(corpus.length);
    expect(corpus).toHaveLength(68);
  });

  test('qualifies current local intent routing without relaxing abstention', async () => {
    const evaluation = await evaluateLibraryIntentCorpus(
      LIBRARY_INTENT_REFERENCE_CORPUS,
      discoverExpected
    );

    console.info('LIBRARY_INTENT_EVALUATION', JSON.stringify(evaluation, null, 2));

    expect(evaluation.canonicalAccuracy).toBe(1);
    expect(evaluation.unsupportedFalsePositiveRate).toBe(0);
    expect(evaluation.supportedPrecision).toBe(1);
    expect(evaluation.paraphraseNoisyRecall).toBeGreaterThanOrEqual(0.9);
  });
});
