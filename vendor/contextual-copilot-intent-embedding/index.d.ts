import type { IntentPort } from '@trama/contextual-copilot-core';

export type IntentEmbeddingFunction = (
  text: string
) => Promise<readonly number[]>;

export interface IntentExampleSet {
  actionId: string;
  examples: readonly string[];
}

export interface EmbeddingIntentPortOptions {
  embed: IntentEmbeddingFunction;
  intents: readonly IntentExampleSet[];
  minSimilarity?: number;
  minMargin?: number;
}

export function createEmbeddingIntentPort(
  options: EmbeddingIntentPortOptions
): IntentPort;
