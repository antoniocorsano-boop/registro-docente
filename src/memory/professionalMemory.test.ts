import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from './emptyProfessionalMemoryState';
import { canPersistProfessionalMemoryCandidate } from './memoryPolicy';
import {
  correctProfessionalMemoryEntry,
  recordProfessionalMemoryEvent,
  rememberProfessionalItem,
  removeProfessionalMemoryEntry,
  setAutoRememberCategory
} from './professionalMemory';

describe('AIC-05 professional memory privacy contract', () => {
  test('starts with every automatic memory category disabled', () => {
    expect(createEmptyProfessionalMemoryState()).toEqual({
      schemaVersion: 1,
      events: [],
      entries: [],
      settings: {
        autoRemember: {
          'format-preference': false,
          'didactic-pattern': false,
          'material-reuse': false,
          'planning-continuity': false,
          'workflow-preference': false
        }
      }
    });
  });

  test('fails closed for student-personal and ambiguous candidates', () => {
    expect(canPersistProfessionalMemoryCandidate({ classification: 'STUDENT_PERSONAL' })).toEqual({
      decision: 'DENY_STUDENT_PERSONAL'
    });
    expect(canPersistProfessionalMemoryCandidate({ classification: 'AMBIGUOUS' })).toEqual({
      decision: 'DENY_AMBIGUOUS'
    });
  });

  test('allows only approved professional classes', () => {
    for (const classification of [
      'TEACHER_PROFESSIONAL',
      'CURRICULUM_PLANNING',
      'PUBLIC_EXTERNAL_CONTENT',
      'AGGREGATED_NON_IDENTIFIABLE'
    ] as const) {
      expect(canPersistProfessionalMemoryCandidate({ classification })).toEqual({ decision: 'ALLOW' });
    }
  });
});

describe('AIC-05 professional memory event and teacher-control contract', () => {
  const automaticEvent = {
    id: 'event-format-1',
    kind: 'proposal-modified' as const,
    category: 'format-preference' as const,
    occurredAt: '2026-10-27T09:30:00.000Z',
    descriptor: 'Preferisce una scheda sintetica con domande guida.',
    context: { className: '2C', udaId: 'uda-agricoltura' },
    canonicalRef: 'uda:uda-agricoltura',
    privacyClassification: 'TEACHER_PROFESSIONAL' as const
  };

  test('disabled categories ignore automatic events while enabled categories capture and consolidate them', () => {
    const empty = createEmptyProfessionalMemoryState();
    expect(recordProfessionalMemoryEvent(empty, automaticEvent)).toEqual(empty);

    const enabled = setAutoRememberCategory(empty, 'format-preference', true);
    const remembered = recordProfessionalMemoryEvent(enabled, automaticEvent);

    expect(remembered.events).toHaveLength(1);
    expect(remembered.events[0]?.provenance.kind).toBe('product-event');
    expect(remembered.entries).toHaveLength(1);
    expect(remembered.entries[0]?.summary).toBe(automaticEvent.descriptor);
    expect(remembered.entries[0]?.sourceEventIds).toEqual(['event-format-1']);
  });

  test('explicit memory is distinguishable and correction preserves provenance', () => {
    const explicit = rememberProfessionalItem(createEmptyProfessionalMemoryState(), {
      eventId: 'event-explicit-1',
      entryId: 'entry-explicit-1',
      category: 'didactic-pattern',
      summary: 'Avvia spesso dal problema concreto prima della formalizzazione.',
      occurredAt: '2026-10-27T09:31:00.000Z',
      context: { className: '3C' },
      canonicalRef: 'uda:energia',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    expect(explicit.events[0]?.provenance.kind).toBe('teacher-explicit');
    expect(explicit.entries[0]?.provenance.kind).toBe('teacher-explicit');

    const corrected = correctProfessionalMemoryEntry(explicit, {
      entryId: 'entry-explicit-1',
      summary: 'Parte dal problema concreto e poi costruisce la formalizzazione.',
      correctedAt: '2026-10-27T09:32:00.000Z'
    });

    expect(corrected.entries[0]?.summary).toContain('problema concreto');
    expect(corrected.entries[0]?.provenance).toEqual(explicit.entries[0]?.provenance);
    expect(corrected.entries[0]?.correctedByTeacherAt).toBe('2026-10-27T09:32:00.000Z');
  });

  test('removing a memory entry does not delete its source event or canonical product data', () => {
    const remembered = rememberProfessionalItem(createEmptyProfessionalMemoryState(), {
      eventId: 'event-explicit-2',
      entryId: 'entry-explicit-2',
      category: 'workflow-preference',
      summary: 'Controlla la proposta prima di adottarla.',
      occurredAt: '2026-10-27T09:33:00.000Z',
      context: {},
      canonicalRef: 'source:professional-1',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const removed = removeProfessionalMemoryEntry(remembered, 'entry-explicit-2');
    expect(removed.entries).toEqual([]);
    expect(removed.events.map(event => event.id)).toEqual(['event-explicit-2']);
  });

  test('explicit memory rejects denied classifications instead of persisting them', () => {
    expect(() => rememberProfessionalItem(createEmptyProfessionalMemoryState(), {
      eventId: 'event-denied',
      entryId: 'entry-denied',
      category: 'workflow-preference',
      summary: 'Dato individuale',
      occurredAt: '2026-10-27T09:34:00.000Z',
      context: {},
      privacyClassification: 'STUDENT_PERSONAL'
    })).toThrow(/student|personale|privacy/i);
  });
});