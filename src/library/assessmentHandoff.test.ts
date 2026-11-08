import { describe, expect, test } from 'bun:test';
import { resolveAssessmentHandoff, type AssessmentHandoffInput } from './assessmentHandoff';
import type { LibrarySource, LibraryStateV1 } from './types';

const source: LibrarySource = {
  id: 'source-teacher',
  kind: 'text',
  title: 'Energia e trasformazioni',
  capturedAt: '2026-11-07T09:00:00.000Z',
  status: 'ready',
  privacy: 'teacher-professional',
  payload: { text: 'Testo della fonte che non deve transitare nella navigazione.' },
  links: [{ targetType: 'uda', targetId: 'uda-of-OTHER-class' }]
};

const library: LibraryStateV1 = { schemaVersion: 1, sources: [source] };
const classes = [{ id: 'class-a', name: '3ª A' }, { id: 'class-b', name: '3ª B' }];

function resolve(partial: Partial<AssessmentHandoffInput> = {}) {
  return resolveAssessmentHandoff({
    request: { sourceId: source.id, classId: 'class-a' },
    library,
    classes,
    activeClassId: 'class-a',
    ...partial
  });
}

describe('INT-02/S1 safe library → assessment navigation descriptor', () => {
  test('requires the explicitly current class; ignores unrelated UDA links', () => {
    const result = resolve();
    expect(result).toEqual({
      status: 'ready',
      handoff: {
        sourceId: 'source-teacher',
        classId: 'class-a',
        className: '3ª A',
        sourceTitle: 'Energia e trasformazioni'
      }
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(source.payload.text!);
    expect(serialized).not.toContain('uda-of-OTHER-class');
    expect(serialized).not.toContain('student');
    expect(serialized).not.toContain('grade');
  });

  test('rejects stale class and absent active class without falling back to the first class', () => {
    expect(resolve({ activeClassId: 'class-b' }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_CHANGED' });
    expect(resolve({ activeClassId: null }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_REQUIRED' });
    expect(resolve({ classes: [classes[1]] }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_REQUIRED' });
    expect(resolve({ classes: [classes[0], classes[0]] }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_REQUIRED' });
  });

  test('rejects missing, duplicated, reclassified, or revoked sources on arrival', () => {
    expect(resolve({ library: { schemaVersion: 1, sources: [] } }))
      .toEqual({ status: 'unavailable', reason: 'SOURCE_UNAVAILABLE' });
    expect(resolve({ library: { schemaVersion: 1, sources: [source, source] } }))
      .toEqual({ status: 'unavailable', reason: 'SOURCE_UNAVAILABLE' });
    for (const privacy of ['unknown', 'student-personal'] as const) {
      expect(resolve({ library: { schemaVersion: 1, sources: [{ ...source, privacy }] } }))
        .toEqual({ status: 'unavailable', reason: 'SOURCE_NOT_PROFESSIONAL' });
    }
    for (const status of ['captured', 'needs-review', 'restricted', 'failed'] as const) {
      expect(resolve({ library: { schemaVersion: 1, sources: [{ ...source, status }] } }))
        .toEqual({ status: 'unavailable', reason: 'SOURCE_NOT_READY' });
    }
  });

  test('requires a nonempty source identifier and a nonempty registered class', () => {
    expect(resolve({ request: { sourceId: '', classId: 'class-a' } }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_REQUIRED' });
    expect(resolve({ classes: [{ id: 'class-a', name: '' }] }))
      .toEqual({ status: 'unavailable', reason: 'CLASS_REQUIRED' });
  });
});
