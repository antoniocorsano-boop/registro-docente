import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from './types';
import type { UdaRecord } from '../types';

async function loadResolver() {
  const moduleUrl = new URL('./relevanceResolver.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = './' + 'relevanceResolver';
  return import(modulePath);
}

function source(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'source-1',
    kind: 'text',
    title: 'Energia eolica',
    capturedAt: '2026-10-25T09:00:00.000Z',
    payload: { text: 'Il vento muove una turbina e genera energia elettrica.' },
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

function uda(overrides: Partial<UdaRecord> = {}): UdaRecord {
  return {
    id: 'uda-energia',
    title: 'Energia e trasformazioni',
    className: '3C',
    hours: 12,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 4,
    description: 'Fonti rinnovabili, trasformazioni energetiche e produzione elettrica.',
    lessons: [],
    ...overrides
  };
}

describe('LIB-03B relevance resolver — deterministic lexical core', () => {
  test('ranks the lexically relevant UDA before unrelated candidates', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const candidates = [
      uda({ id: 'uda-materiali', title: 'Materiali', description: 'Proprietà dei materiali.' }),
      uda({ id: 'uda-energia', title: 'Energia e trasformazioni' })
    ];

    const result = resolveLibraryRelevance({ source: source(), udas: candidates });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    expect(result.candidates[0]?.targetType).toBe('uda');
    expect(result.candidates[0]?.targetId).toBe('uda-energia');
    expect(result.candidates[0]?.signals).toContain('SOURCE_TITLE_MATCH');
    expect(result.candidates[0]?.matchedTerms).toContain('energia');
  });

  test('adds a title-match signal to a lesson whose topic matches the source title', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: 'Turbina eolica' }),
      udas: [uda({
        lessons: [{ id: 'lesson-turbina', date: '2026-10-25', topic: 'La turbina eolica', hours: 1 }]
      })]
    });

    expect(result.status).toBe('ranked');
    if (result.status !== 'ranked') return;
    const lesson = result.candidates.find((candidate: { targetId: string }) => candidate.targetId === 'lesson-turbina');
    expect(lesson?.targetType).toBe('lesson');
    expect(lesson?.signals).toContain('SOURCE_TITLE_MATCH');
    expect(lesson?.matchedTerms).toEqual(expect.arrayContaining(['turbina', 'eolica']));
  });

  test('counts lexical terms as sets so repeated source words do not inflate the score', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const once = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [uda({ title: 'Energia' })]
    });
    const repeated = resolveLibraryRelevance({
      source: source({ title: 'Energia energia energia', payload: { text: '' } }),
      udas: [uda({ title: 'Energia' })]
    });

    expect(once.status).toBe('ranked');
    expect(repeated.status).toBe('ranked');
    if (once.status !== 'ranked' || repeated.status !== 'ranked') return;
    expect(repeated.candidates[0]?.score).toBe(once.candidates[0]?.score);
  });

  test('fails closed when neither local source text nor teaching context is available', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const result = resolveLibraryRelevance({
      source: source({ title: '   ', payload: {}, extractedText: undefined, notes: undefined }),
      udas: [uda()]
    });

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'SOURCE_AND_CONTEXT_UNAVAILABLE',
      candidates: []
    });
  });

  test('uses deterministic tie-breaks independent of input order', async () => {
    const { resolveLibraryRelevance } = await loadResolver();
    const tiedUda = uda({ id: 'b-uda', title: 'Energia' });
    const tiedUdaA = uda({ id: 'a-uda', title: 'Energia' });
    const parent = uda({
      id: 'z-parent',
      title: 'Altro',
      lessons: [{ id: 'a-lesson', date: '2026-10-25', topic: 'Energia', hours: 1 }]
    });

    const first = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [tiedUda, parent, tiedUdaA]
    });
    const second = resolveLibraryRelevance({
      source: source({ title: 'Energia', payload: { text: '' } }),
      udas: [parent, tiedUdaA, tiedUda]
    });

    expect(first.status).toBe('ranked');
    expect(second.status).toBe('ranked');
    if (first.status !== 'ranked' || second.status !== 'ranked') return;
    expect(first.candidates.map((candidate: { targetType: string; targetId: string }) => `${candidate.targetType}:${candidate.targetId}`))
      .toEqual(second.candidates.map((candidate: { targetType: string; targetId: string }) => `${candidate.targetType}:${candidate.targetId}`));
    expect(first.candidates.slice(0, 2).map((candidate: { targetId: string }) => candidate.targetId)).toEqual(['a-uda', 'b-uda']);
  });
});
