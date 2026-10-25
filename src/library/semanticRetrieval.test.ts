import { describe, expect, test } from 'bun:test';
import type { LocalEmbeddingConfig } from '../types';
import type { LibrarySource } from './types';

const MODULE = new URL('./semanticRetrieval.ts', import.meta.url);

const LOCAL_CONFIG: LocalEmbeddingConfig = {
  provider: 'local',
  endpointUrl: 'http://127.0.0.1:8080',
  modelName: 'semantic-test',
  apiType: 'llama.cpp',
  enabled: true
};

function source(overrides: Partial<LibrarySource> & Pick<LibrarySource, 'id' | 'title'>): LibrarySource {
  return {
    id: overrides.id,
    kind: overrides.kind ?? 'note',
    title: overrides.title,
    capturedAt: overrides.capturedAt ?? '2026-10-25T12:00:00.000Z',
    payload: overrides.payload ?? { text: overrides.title },
    status: overrides.status ?? 'ready',
    privacy: overrides.privacy ?? 'teacher-professional',
    links: overrides.links ?? [],
    ...overrides
  };
}

async function loadModule() {
  const file = Bun.file(MODULE);
  expect(await file.exists()).toBe(true);
  return import('./semanticRetrieval');
}

describe('LIB-05A local semantic retrieval', () => {
  test('ranks the semantically closest professional source first', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    const vectors = new Map<string, number[]>([
      ['trasformazione energia elettrica', [1, 0]],
      ['Energia dal vento turbina e generatore', [0.96, 0.04]],
      ['Disegno tecnico proiezioni ortogonali', [0, 1]]
    ]);

    const result = await retrieveLibrarySourcesByMeaning({
      query: 'trasformazione energia elettrica',
      sources: [
        source({ id: 'drawing', title: 'Disegno tecnico', payload: { text: 'proiezioni ortogonali' } }),
        source({ id: 'wind', title: 'Energia dal vento', payload: { text: 'turbina e generatore' } })
      ],
      config: LOCAL_CONFIG,
      embed: async text => vectors.get(text) ?? []
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates.map(candidate => candidate.sourceId)).toEqual(['wind']);
  });

  test('uses deterministic title and id tie-breaks for equal similarities', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    const result = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources: [
        source({ id: 'z', title: 'Batterie', payload: { text: 'accumulo' } }),
        source({ id: 'b', title: 'Accumulatori', payload: { text: 'energia' } }),
        source({ id: 'a', title: 'Accumulatori', payload: { text: 'energia' } })
      ],
      config: LOCAL_CONFIG,
      embed: async () => [1, 0]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates.map(candidate => candidate.sourceId)).toEqual(['a', 'b', 'z']);
  });

  test('excludes unknown student-personal and textless sources before embedding', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    const embeddedTexts: string[] = [];
    const result = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources: [
        source({ id: 'unknown', title: 'Appunto', privacy: 'unknown' }),
        source({ id: 'student', title: 'Scheda studente', privacy: 'student-personal' }),
        source({ id: 'empty', title: '', payload: {}, notes: undefined, extractedText: undefined }),
        source({ id: 'professional', title: 'Centrale idroelettrica', payload: { text: 'turbina energia' } })
      ],
      config: LOCAL_CONFIG,
      embed: async text => {
        embeddedTexts.push(text);
        return [1, 0];
      }
    });

    expect(result.status).toBe('ranked');
    expect(embeddedTexts).toEqual(['energia', 'Centrale idroelettrica turbina energia']);
  });

  test('refuses disabled or non-local configuration before any embedding call', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    let calls = 0;
    const embed = async () => {
      calls += 1;
      return [1, 0];
    };

    const disabled = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources: [source({ id: 'one', title: 'Energia' })],
      config: { ...LOCAL_CONFIG, enabled: false },
      embed
    });
    expect(disabled).toEqual({
      status: 'unavailable',
      reason: 'LOCAL_EMBEDDING_DISABLED',
      candidates: []
    });

    const remote = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources: [source({ id: 'one', title: 'Energia' })],
      config: {
        ...LOCAL_CONFIG,
        provider: 'gemini',
        endpointUrl: '',
        modelName: 'text-embedding-004',
        apiType: 'openai-compatible'
      },
      embed
    });
    expect(remote).toEqual({
      status: 'unavailable',
      reason: 'LOCAL_EMBEDDING_REQUIRED',
      candidates: []
    });
    expect(calls).toBe(0);
  });

  test('returns no match for incompatible or weak vectors', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    const result = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources: [
        source({ id: 'short', title: 'Fonte corta' }),
        source({ id: 'weak', title: 'Fonte debole' })
      ],
      config: LOCAL_CONFIG,
      embed: async text => {
        if (text === 'energia') return [1, 0];
        if (text.startsWith('Fonte corta')) return [1];
        return [0, 1];
      }
    });

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'NO_SEMANTIC_MATCH',
      candidates: []
    });
  });

  test('caps semantic candidates at eight', async () => {
    const { retrieveLibrarySourcesByMeaning } = await loadModule();
    const sources = Array.from({ length: 12 }, (_, index) => source({
      id: `source-${String(index).padStart(2, '0')}`,
      title: `Fonte ${String(index).padStart(2, '0')}`
    }));

    const result = await retrieveLibrarySourcesByMeaning({
      query: 'energia',
      sources,
      config: LOCAL_CONFIG,
      maxResults: 99,
      embed: async () => [1, 0]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates).toHaveLength(8);
  });
});
