import { describe, expect, test } from 'bun:test';

const EMBEDDING_MODULE = new URL('./localIntentEmbedding.ts', import.meta.url);
const CATALOG_MODULE = new URL('./libraryIntentCatalog.ts', import.meta.url);

async function loadEmbeddingModule() {
  return import(EMBEDDING_MODULE.href);
}

async function loadCatalogModule() {
  return import(CATALOG_MODULE.href);
}

function l2Norm(vector: readonly number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
}

describe('LIB-06A local intent embedding', () => {
  test('materializes the local embedding and consumer-owned catalog modules', async () => {
    expect(await Bun.file(EMBEDDING_MODULE).exists()).toBe(true);
    expect(await Bun.file(CATALOG_MODULE).exists()).toBe(true);
  });

  test('normalizes equivalent Italian text deterministically', async () => {
    const { embedLocalIntentText } = await loadEmbeddingModule();

    const first = await embedLocalIntentText('  PREPARA   un’attività per la LEZIONE  ');
    const second = await embedLocalIntentText("prepara un'attivita per la lezione");
    const repeated = await embedLocalIntentText('  PREPARA   un’attività per la LEZIONE  ');

    expect(first).toEqual(second);
    expect(first).toEqual(repeated);
  });

  test('returns a fixed-size finite non-zero L2-normalized vector without network access', async () => {
    const { embedLocalIntentText } = await loadEmbeddingModule();
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;

    globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
      fetchCalls += 1;
      throw new Error('network access is forbidden for local intent embedding');
    }) as typeof fetch;

    try {
      const vector = await embedLocalIntentText('Collega questa fonte alla UDA energia.');

      expect(vector.length).toBeGreaterThanOrEqual(128);
      expect(vector.every((value: number) => Number.isFinite(value))).toBe(true);
      expect(vector.some((value: number) => value !== 0)).toBe(true);
      expect(Math.abs(l2Norm(vector) - 1)).toBeLessThan(1e-10);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('catalog exposes exactly REVIEW, LINK and PREPARE and excludes SUMMARIZE', async () => {
    const { LIBRARY_INTENT_CATALOG } = await loadCatalogModule();
    const actionIds = LIBRARY_INTENT_CATALOG.map((entry: { actionId: string }) => entry.actionId).sort();

    expect(actionIds).toEqual([
      'link-source-to-uda',
      'prepare-from-source',
      'review-source',
    ]);
    expect(actionIds).not.toContain('summarize-source');
    expect(LIBRARY_INTENT_CATALOG.every((entry: { examples: readonly string[] }) => entry.examples.length >= 4)).toBe(true);
  });
});
