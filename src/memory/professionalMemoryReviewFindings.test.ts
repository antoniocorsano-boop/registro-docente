import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from './emptyProfessionalMemoryState';
import {
  recordProfessionalMemoryEvent,
  rememberProfessionalItem,
  removeProfessionalMemoryCategory,
  selectProfessionalMemoryWorkingSet,
  setAutoRememberCategory
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
});
