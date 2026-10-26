import type {
  LibraryIntentExpected,
  LibraryIntentFixture
} from './fixtures/libraryIntentReferenceCorpus';

export interface LibraryIntentEvaluationFailure {
  id: string;
  utterance: string;
  expected: LibraryIntentExpected;
  actual: LibraryIntentExpected;
  class: LibraryIntentFixture['class'];
}

export interface LibraryIntentEvaluation {
  total: number;
  canonicalAccuracy: number;
  unsupportedFalsePositiveRate: number;
  supportedPrecision: number;
  supportedRecall: number;
  paraphraseNoisyRecall: number;
  counts: {
    canonicalSupported: number;
    unsupported: number;
    supported: number;
    paraphraseNoisySupported: number;
    emitted: number;
  };
  failures: readonly LibraryIntentEvaluationFailure[];
}

export type DiscoverLibraryIntent = (utterance: string) => Promise<LibraryIntentExpected>;

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 1 : numerator / denominator;

export async function evaluateLibraryIntentCorpus(
  fixtures: readonly LibraryIntentFixture[],
  discover: DiscoverLibraryIntent
): Promise<LibraryIntentEvaluation> {
  const observations = await Promise.all(fixtures.map(async fixture => ({
    fixture,
    actual: await discover(fixture.utterance)
  })));

  const canonicalSupported = observations.filter(({ fixture }) =>
    fixture.class === 'canonical' && fixture.expected !== 'NO_INTENT_MATCH'
  );
  const unsupported = observations.filter(({ fixture }) => fixture.expected === 'NO_INTENT_MATCH');
  const supported = observations.filter(({ fixture }) => fixture.expected !== 'NO_INTENT_MATCH');
  const paraphraseNoisySupported = supported.filter(({ fixture }) =>
    fixture.class === 'paraphrase' || fixture.class === 'noisy'
  );
  const emitted = observations.filter(({ actual }) => actual !== 'NO_INTENT_MATCH');

  const correct = <T extends typeof observations>(items: T): number =>
    items.filter(({ fixture, actual }) => actual === fixture.expected).length;

  const falsePositives = unsupported.filter(({ actual }) => actual !== 'NO_INTENT_MATCH').length;
  const failures = observations
    .filter(({ fixture, actual }) => fixture.expected !== actual)
    .map(({ fixture, actual }) => ({
      id: fixture.id,
      utterance: fixture.utterance,
      expected: fixture.expected,
      actual,
      class: fixture.class
    }));

  return {
    total: observations.length,
    canonicalAccuracy: ratio(correct(canonicalSupported), canonicalSupported.length),
    unsupportedFalsePositiveRate: ratio(falsePositives, unsupported.length),
    supportedPrecision: ratio(correct(emitted), emitted.length),
    supportedRecall: ratio(correct(supported), supported.length),
    paraphraseNoisyRecall: ratio(correct(paraphraseNoisySupported), paraphraseNoisySupported.length),
    counts: {
      canonicalSupported: canonicalSupported.length,
      unsupported: unsupported.length,
      supported: supported.length,
      paraphraseNoisySupported: paraphraseNoisySupported.length,
      emitted: emitted.length
    },
    failures
  };
}
