import { describe, expect, test } from 'bun:test';

const SEMANTIC = new URL('../library/semanticRetrieval.ts', import.meta.url);
const LIBRARY_VIEW = new URL('../components/LibraryView.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);
const RELEVANCE = new URL('../library/relevanceResolver.ts', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  const file = Bun.file(url);
  return (await file.exists()) ? file.text() : '';
}

describe('LIB-05A local semantic retrieval contract', () => {
  test('materializes a dedicated semantic retrieval module over the existing embedding service', async () => {
    const semantic = await readIfExists(SEMANTIC);

    expect(semantic.length).toBeGreaterThan(0);
    expect(semantic).toContain("from '../services/embeddingService'");
    expect(semantic).toContain('getEmbedding');
    expect(semantic).toContain('cosineSimilarity');
    expect(semantic).toContain('retrieveLibrarySourcesByMeaning');
  });

  test('keeps semantic retrieval local-only and fail-closed', async () => {
    const semantic = await readIfExists(SEMANTIC);

    expect(semantic).toContain("config.provider !== 'local'");
    expect(semantic).toContain('!config.enabled');
    expect(semantic).toContain("source.privacy === 'teacher-professional'");
    expect(semantic).toContain("classification: 'TEACHER_PROFESSIONAL'");
    expect(semantic).not.toContain("provider: 'gemini'");
    expect(semantic).not.toContain('/api/embeddings/generate');
  });

  test('does not weaken the deterministic LIB-03B resolver boundary', async () => {
    const relevance = await Bun.file(RELEVANCE).text();

    expect(relevance).not.toContain('semanticRetrieval');
    expect(relevance).not.toContain('getEmbedding');
    expect(relevance).not.toContain('cosineSimilarity');
  });

  test('adds semantic search only behind explicit progressive disclosure while preserving textual search', async () => {
    const view = await Bun.file(LIBRARY_VIEW).text();

    expect(view).toContain('searchLibrarySources(library, query)');
    expect(view).toContain('embeddingConfig?: LocalEmbeddingConfig');
    expect(view).toContain("import { retrieveLibrarySourcesByMeaning } from '../library/semanticRetrieval'");
    expect(view).toContain('data-testid="library-semantic-search-disclosure"');
    expect(view).toContain('Ricerca per significato');
    expect(view).toContain('Cerca per significato');
    expect(view).toContain('non invia automaticamente i materiali a servizi remoti');
    expect(view).not.toContain('onChange={event => void runSemantic');
  });

  test('wires the existing embedding configuration into LibraryView without new persistence', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain('embeddingConfig={settings.embeddingConfig}');
    expect(app).toContain('onAddSource={handleAddLibrarySource}');
    expect(app).toContain('onUpdateSource={handleUpdateLibrarySource}');
  });
});
