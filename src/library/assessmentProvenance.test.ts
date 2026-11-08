import { describe, expect, test } from 'bun:test';
import type { LibraryStateV1 } from './types';
import type { OnlineTest } from '../types';
import {
  areAssessmentProvenancesValid,
  prepareAssessmentTestForCommit,
  projectAssessmentsForStudent,
  resolveSavedAssessmentOrigin
} from './assessmentProvenance';

const classes = [{ id: 'class-2c', name: '2ª C - Secondaria' }];
const library: LibraryStateV1 = {
  schemaVersion: 1,
  sources: [{
    id: 'source-a', kind: 'text', title: 'Fonte didattica', capturedAt: '2026-11-08T10:00:00Z',
    payload: { text: 'Solo uso docente' }, status: 'ready', privacy: 'teacher-professional', links: []
  }]
};
const basicTest: OnlineTest = { id: 'test-a', title: 'Verifica', questions: [] };
const provenance = { version: 1 as const, kind: 'library-source' as const, sourceId: 'source-a', confirmedByTeacher: true as const };

function commit(nextTest: OnlineTest, previousTest?: OnlineTest, sourceLibrary = library, classId: string | null = 'class-2c') {
  return prepareAssessmentTestForCommit({
    nextTest, previousTest, request: { sourceId: 'source-a', classId: 'class-2c' },
    library: sourceLibrary, classes, activeClassId: classId
  });
}

describe('INT-02/S2b — permanent source reference', () => {
  test('a new assessment gets only an explicitly confirmed, ready professional source', () => {
    expect(commit({ ...basicTest, provenance }).provenance).toEqual(provenance);
    expect(commit(basicTest).provenance).toBeUndefined();
    expect(() => commit({ ...basicTest, provenance }, undefined, { ...library, sources: [] })).toThrow();
    expect(() => commit({ ...basicTest, provenance }, undefined, {
      ...library, sources: [{ ...library.sources[0], privacy: 'student-personal' }]
    })).toThrow();
    expect(() => commit({ ...basicTest, provenance }, undefined, library, null)).toThrow();
    expect(() => commit({ ...basicTest, provenance: { ...provenance, sourceId: 'other' } })).toThrow();
  });

  test('editing preserves the original source even after deletion, and rejects relinking', () => {
    const previous: OnlineTest = { ...basicTest, provenance };
    expect(commit({ ...basicTest, title: 'Revisione' }, previous, { ...library, sources: [] }).provenance).toEqual(provenance);
    expect(() => commit({ ...basicTest, provenance: { ...provenance, sourceId: 'different' } }, previous)).toThrow();
    expect(() => commit({ ...basicTest, provenance }, basicTest)).toThrow();
  });

  test('invalid provenance metadata fails closed while historical tests remain valid', () => {
    expect(areAssessmentProvenancesValid({ old: basicTest, new: { ...basicTest, provenance } })).toBe(true);
    for (const broken of [null, {}, { ...provenance, sourceId: '' }, { ...provenance, confirmedByTeacher: false },
      { ...provenance, version: 9 }, { ...provenance, sourceUrl: 'https://example.com' }]) {
      expect(areAssessmentProvenancesValid({ broken: { ...basicTest, provenance: broken } })).toBe(false);
    }
  });

  test('teacher source status degrades safely and student projection removes the reference', () => {
    const linked: OnlineTest = { ...basicTest, provenance };
    expect(resolveSavedAssessmentOrigin(linked, library)).toBe('available');
    expect(resolveSavedAssessmentOrigin(linked, { ...library, sources: [] })).toBe('unavailable');
    expect(resolveSavedAssessmentOrigin(basicTest, library)).toBe('unregistered');
    const projected = projectAssessmentsForStudent({ 'test-a': linked });
    expect(projected['test-a'].title).toBe('Verifica');
    expect('provenance' in projected['test-a']).toBe(false);
    expect(JSON.stringify(projected)).not.toContain('source-a');
    expect(linked.provenance).toEqual(provenance);
  });
});
