import { describe, expect, test } from 'bun:test';
import { resolveProfessionalContext } from '../context/professionalContext';
import type { PlanningFrameResolution } from '../planning/planningFrameResolver';
import type { LibraryPlanningContextResolution } from '../library/planningContextBridge';

const frame = (className = '2C', profileId = 'p2'): PlanningFrameResolution => ({
  status: 'resolved', reason: 'RESOLVED', className,
  profile: { id: profileId }, arenaContext: { id: 'arena-2' }
}) as PlanningFrameResolution;

const base = { surface: 'planning' as const, currentClass: { id: 'c2', name: '2C' } };
describe('INT-01 CTX-01 planning and teaching projection', () => {
  test('resolves planning frame from class-only context without inventing an UDA', () => {
    const result = resolveProfessionalContext({ ...base, planningFrame: frame() });
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.context.planningProfileId).toBe('p2');
      expect(result.context.arenaContextId).toBe('arena-2');
      expect(result.context.udaId).toBeUndefined();
    }
  });
  test('fails closed when the planning frame is ambiguous', () => {
    const result = resolveProfessionalContext({
      ...base, planningFrame: { status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' }
    });
    expect(result).toEqual({
      status: 'conflict', conflicts: ['PLANNING_CONTEXT_AMBIGUOUS']
    });
  });
  test('fails closed when planning frame class disagrees with the selected class', () => {
    const result = resolveProfessionalContext({ ...base, planningFrame: frame('3C') });
    expect(result).toEqual({ status: 'conflict', conflicts: ['CLASS_MISMATCH'] });
  });
  test('fails closed when teaching focus disagrees with the planning frame', () => {
    const result = resolveProfessionalContext({
      ...base, planningFrame: frame('3C'),
      teachingContext: { udaId: 'uda2', className: '2C', period: 'Q1' }
    });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') expect(result.conflicts).toContain('CLASS_MISMATCH');
  });
  test('does not silently combine conflicting legacy and new planning profiles', () => {
    const legacy = {
      status: 'resolved', reason: 'RESOLVED',
      teachingContext: { udaId: 'uda2', className: '2C', period: 'Q1' },
      profile: { id: 'different' }, arenaContext: null
    } as LibraryPlanningContextResolution;
    const result = resolveProfessionalContext({
      ...base, planningFrame: frame(), planningContext: legacy
    });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') expect(result.conflicts).toContain('PLANNING_CONTEXT_AMBIGUOUS');
  });
});
