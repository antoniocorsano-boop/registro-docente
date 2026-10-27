import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from './emptyProfessionalMemoryState';
import {
  rememberProfessionalItem,
  selectProfessionalMemoryWorkingSet,
  toRemoteProfessionalMemoryProjection
} from './professionalMemory';
import type { ProfessionalMemoryStateV1 } from './types';

function addExplicit(
  state: ProfessionalMemoryStateV1,
  index: number,
  context: Record<string, string> = {},
  canonicalRef = `source:professional-${index}`
): ProfessionalMemoryStateV1 {
  return rememberProfessionalItem(state, {
    eventId: `event-${index}`,
    entryId: `entry-${index}`,
    category: index % 2 === 0 ? 'material-reuse' : 'didactic-pattern',
    summary: `Memoria professionale ${index}`,
    occurredAt: `2026-10-27T09:${String(10 + index).padStart(2, '0')}:00.000Z`,
    context,
    canonicalRef,
    privacyClassification: 'TEACHER_PROFESSIONAL'
  });
}

describe('AIC-05 deterministic professional memory retrieval', () => {
  test('excludes stale or orphaned entries and caps the working set at five', () => {
    let state = createEmptyProfessionalMemoryState();
    for (let index = 0; index < 7; index += 1) {
      state = addExplicit(
        state,
        index,
        index === 6 ? { className: '2C', udaId: 'uda-current' } : {},
        index === 5 ? 'source:removed' : `source:professional-${index}`
      );
    }
    state = {
      ...state,
      entries: state.entries.map(entry => (
        entry.id === 'entry-4' ? { ...entry, status: 'stale' as const } : entry
      ))
    };

    const workingSet = selectProfessionalMemoryWorkingSet({
      state,
      context: { className: '2C', udaId: 'uda-current' },
      activeCanonicalRefs: [
        'source:professional-0',
        'source:professional-1',
        'source:professional-2',
        'source:professional-3',
        'source:professional-4',
        'source:professional-6'
      ]
    });

    expect(workingSet.items.length).toBeLessThanOrEqual(5);
    expect(workingSet.items[0]?.entryId).toBe('entry-6');
    expect(workingSet.items.map(item => item.entryId)).not.toContain('entry-4');
    expect(workingSet.items.map(item => item.entryId)).not.toContain('entry-5');
  });

  test('remote projection exposes only compact category and summary fields', () => {
    const state = addExplicit(
      createEmptyProfessionalMemoryState(),
      1,
      { className: '3C', udaId: 'uda-energy', lessonId: 'lesson-1' },
      'uda:uda-energy'
    );
    const workingSet = selectProfessionalMemoryWorkingSet({
      state,
      context: { className: '3C', udaId: 'uda-energy', lessonId: 'lesson-1' },
      activeCanonicalRefs: ['uda:uda-energy']
    });
    const remote = toRemoteProfessionalMemoryProjection(workingSet);
    const serialized = JSON.stringify(remote);

    expect(remote.items).toEqual([
      {
        category: 'didactic-pattern',
        summary: 'Memoria professionale 1'
      }
    ]);
    expect(serialized).not.toContain('events');
    expect(serialized).not.toContain('sourceEventIds');
    expect(serialized).not.toContain('canonicalRef');
    expect(serialized).not.toContain('provenance');
    expect(serialized).not.toContain('className');
    expect(serialized).not.toContain('uda-energy');
  });
});
