import { describe, expect, test } from 'bun:test';
import { resolvePlanningFrame } from '../planning/planningFrameResolver';
import type { ArenaPlanningContext, PlanningState, TeachingProfile } from '../planning/types';

const profile = (changes: Partial<TeachingProfile> = {}): TeachingProfile => ({
  id: 'tech-2', schoolYear: '2026/27', schoolOrder: 'lower_secondary',
  gradeLevel: 2, cohortRef: '2026-2027:secondaria:classe-ii',
  subjectCode: ' Tecnologia ', normativeRegime: 'IN2025',
  normativeReference: { id: 'n', sourceRef: 'norma', version: '1', nationalHoursDefined: false },
  reservePercent: 15, assessmentPeriods: [],
  calendar: { startDate: '2026-09-01', endDate: '2027-06-30', closureDates: [], weeklySlots: [] },
  ...changes
});
const arena = (p: TeachingProfile, changes: Partial<ArenaPlanningContext> = {}): ArenaPlanningContext => ({
  id: 'arena-2', profileId: p.id, contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
  contractVersion: 1, sourceProduct: 'ARENA', targetProduct: 'REGISTRO_DOCENTE',
  importMode: 'PREVIEW_ONLY', acceptanceRequired: true, automaticWriteAllowed: false,
  institutionRef: 'school', schoolYear: '2026-2027', sourceSchoolYear: '2026-2027',
  schoolOrder: 'secondaria', subjectCode: p.subjectCode, gradeLevel: p.gradeLevel,
  cohortRef: p.cohortRef, cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
  applicabilityStatus: 'APPLICABLE', regimeRef: p.normativeRegime ?? 'IN2025',
  authorityState: 'APPROVED', vigencyStatus: 'VIGENTE', authorityReceiptRef: 'receipt',
  masterId: 'master', masterVersion: '1', structuralFingerprint: {
    scope: 'MASTER', algorithm: 'fnv1a', version: 1, hash: 'abc'
  }, provenance: {
    repository: 'arena', sourceCommit: 'a'.repeat(40),
    sourceDocumentId: 'source', sourceRevisionId: 'rev'
  }, curricoloItems: [], privacyClass: 'PROFESSIONAL_NON_PERSONAL',
  acceptedAt: '2026-11-01T00:00:00.000Z', ...changes
});
const planning = (
  profiles: TeachingProfile[],
  arenaContexts: ArenaPlanningContext[] = []
): PlanningState => ({
  schemaVersion: 2, profiles, arenaContexts, resources: [],
  masterPrograms: [], classInstances: [], docenteOsProjections: []
});
const input = (p: PlanningState, className: string | null = '2C') => ({
  className, planning: p, schoolYear: '2026-2027', subjectCode: 'tecnologia'
});

describe('INT-01 class-first planning frame', () => {
  test('does not require a fictional UDA to diagnose a missing class', () => {
    expect(resolvePlanningFrame(input(planning([profile()]), null)))
      .toEqual({ status: 'unavailable', reason: 'CLASS_CONTEXT_MISSING' });
  });
  test('resolves the existing canonical Registro class label without parsing arbitrary words', () => {
    const p = profile({ gradeLevel: 3 });
    expect(resolvePlanningFrame(input(planning([p]), '3ª A - Secondaria I Grado'))).toEqual({
      status: 'resolved', reason: 'RESOLVED', className: '3ª A - Secondaria I Grado',
      profile: p, arenaContext: null
    });
    expect(resolvePlanningFrame(input(planning([p]), 'classe terza C'))).toEqual({
      status: 'unavailable', reason: 'GRADE_LEVEL_UNRESOLVED'
    });
  });
  test('rejects ambiguous and malformed class identities', () => {
    expect(resolvePlanningFrame(input(planning([profile()]), 'classe seconda C')))
      .toEqual({ status: 'unavailable', reason: 'GRADE_LEVEL_UNRESOLVED' });
  });
  test('resolves a unique profile by year, subject and grade without an UDA', () => {
    const p = profile();
    expect(resolvePlanningFrame(input(planning([p])))).toEqual({
      status: 'resolved', reason: 'RESOLVED', className: '2C', profile: p, arenaContext: null
    });
  });
  test('does not invent a profile when missing', () => {
    expect(resolvePlanningFrame(input(planning([profile({ gradeLevel: 3 })]))))
      .toEqual({ status: 'unavailable', reason: 'PLANNING_PROFILE_NOT_FOUND' });
  });
  test('fails closed with two matching profiles', () => {
    expect(resolvePlanningFrame(input(planning([profile(), profile({ id: 'another' })]))))
      .toEqual({ status: 'ambiguous', reason: 'PLANNING_PROFILE_AMBIGUOUS' });
  });
  test('exposes only an authoritative and current Arena context', () => {
    const p = profile();
    const a = arena(p);
    const result = resolvePlanningFrame(input(planning([p], [
      arena(p, { id: 'stale', regimeRef: 'outdated' }),
      arena(p, { id: 'old', vigencyStatus: 'NON_VIGENTE' }),
      arena(p, { id: 'provisional', authorityState: 'PROVISIONAL_COMPLETE' }),
      arena(p, { id: 'wrong-order', schoolOrder: 'primaria' }),
      arena(p, { id: 'wrong-cohort', cohortRef: 'other' }),
      { ...arena(p, { id: 'personal' }), privacyClass: 'STUDENT_PERSONAL' } as unknown as ArenaPlanningContext,
      a
    ])));
    expect(result).toEqual({
      status: 'resolved', reason: 'RESOLVED', className: '2C', profile: p, arenaContext: a
    });
  });
  test('fails closed when two fully eligible Arena contexts match', () => {
    const p = profile();
    expect(resolvePlanningFrame(input(planning([p], [
      arena(p), arena(p, { id: 'newer', acceptedAt: '2026-11-02T00:00:00.000Z' })
    ])))).toEqual({ status: 'ambiguous', reason: 'ARENA_CONTEXT_AMBIGUOUS' });
  });
});
