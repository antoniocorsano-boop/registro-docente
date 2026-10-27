import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from './emptyProfessionalMemoryState';
import {
  correctProfessionalMemoryEntry,
  recordProfessionalMemoryEvent,
  rememberProfessionalItem,
  removeProfessionalMemoryCategory,
  selectProfessionalMemoryWorkingSet,
  setAutoRememberCategory,
  toRemoteProfessionalMemoryProjection
} from './professionalMemory';

describe('AIC-05 Task 3 review findings regression', () => {
  test('explicit teacher memory outranks even a derived entry with multiple exact context matches', () => {
    const context = {
      className: '2C',
      udaId: 'uda-current',
      lessonId: 'lesson-current',
      sourceId: 'source-current',
      planningProfileId: 'planning-current',
      assessmentId: 'assessment-current'
    };

    let state = setAutoRememberCategory(
      createEmptyProfessionalMemoryState(),
      'didactic-pattern',
      true
    );
    state = recordProfessionalMemoryEvent(state, {
      id: 'event-derived',
      kind: 'proposal-modified',
      category: 'didactic-pattern',
      occurredAt: '2026-10-27T09:40:00.000Z',
      descriptor: 'Voce derivata molto contestuale.',
      context,
      canonicalRef: 'source:derived',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });
    state = rememberProfessionalItem(state, {
      eventId: 'event-explicit',
      entryId: 'entry-explicit',
      category: 'workflow-preference',
      summary: 'Controlla sempre la proposta prima di adottarla.',
      occurredAt: '2026-10-27T09:41:00.000Z',
      context: {},
      canonicalRef: 'source:explicit',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const workingSet = selectProfessionalMemoryWorkingSet({
      state,
      context,
      activeCanonicalRefs: ['source:derived', 'source:explicit']
    });

    expect(workingSet.items[0]?.entryId).toBe('entry-explicit');
  });

  test('bulk category cleanup does not silently change the separate auto-remember authorization', () => {
    let state = setAutoRememberCategory(
      createEmptyProfessionalMemoryState(),
      'format-preference',
      true
    );
    state = rememberProfessionalItem(state, {
      eventId: 'event-format',
      entryId: 'entry-format',
      category: 'format-preference',
      summary: 'Preferisce schede sintetiche.',
      occurredAt: '2026-10-27T09:42:00.000Z',
      context: {},
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const cleaned = removeProfessionalMemoryCategory(state, 'format-preference');

    expect(cleaned.events).toEqual([]);
    expect(cleaned.entries).toEqual([]);
    expect(cleaned.settings.autoRemember['format-preference']).toBe(true);
  });

  test('automatic consolidation preserves a teacher correction while still attaching later source events', () => {
    const context = { udaId: 'uda-energy', sourceId: 'source-energy' };
    let state = setAutoRememberCategory(
      createEmptyProfessionalMemoryState(),
      'material-reuse',
      true
    );
    state = recordProfessionalMemoryEvent(state, {
      id: 'event-link-1',
      kind: 'source-linked',
      category: 'material-reuse',
      occurredAt: '2026-10-27T10:00:00.000Z',
      descriptor: 'Fonte professionale collegata al contesto didattico corrente.',
      context,
      canonicalRef: 'source:source-energy',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const entryId = state.entries[0]?.id;
    expect(entryId).toBeTruthy();
    state = correctProfessionalMemoryEntry(state, {
      entryId: entryId!,
      summary: 'Usa questa fonte con una lettura tecnica guidata.',
      correctedAt: '2026-10-27T10:01:00.000Z'
    });
    state = recordProfessionalMemoryEvent(state, {
      id: 'event-link-2',
      kind: 'source-linked',
      category: 'material-reuse',
      occurredAt: '2026-10-27T10:02:00.000Z',
      descriptor: 'Descrittore automatico successivo che non deve sovrascrivere il docente.',
      context,
      canonicalRef: 'source:source-energy',
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const corrected = state.entries.find(entry => entry.id === entryId);
    expect(corrected?.summary).toBe('Usa questa fonte con una lettura tecnica guidata.');
    expect(corrected?.correctedByTeacherAt).toBe('2026-10-27T10:01:00.000Z');
    expect(corrected?.sourceEventIds).toEqual(['event-link-1', 'event-link-2']);
  });

  test('remote projection bounds long teacher summaries without altering the locally stored text', () => {
    const longSummary = 'x'.repeat(900);
    let state = rememberProfessionalItem(createEmptyProfessionalMemoryState(), {
      eventId: 'event-long-summary',
      entryId: 'entry-long-summary',
      category: 'workflow-preference',
      summary: longSummary,
      occurredAt: '2026-10-27T10:03:00.000Z',
      context: {},
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });

    const workingSet = selectProfessionalMemoryWorkingSet({
      state,
      context: {},
      activeCanonicalRefs: []
    });
    const projection = toRemoteProfessionalMemoryProjection(workingSet);

    expect(state.entries[0]?.summary).toBe(longSummary);
    expect(projection.items[0]?.summary.length).toBe(800);
    expect(projection.items[0]?.summary).toBe(longSummary.slice(0, 800));
  });
});