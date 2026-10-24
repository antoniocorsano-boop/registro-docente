import { describe, expect, test } from 'bun:test';

test('EDU-PLAN-01B harness sentinel must be observed', () => {
  expect('RED_SENTINEL').toBe('GREEN_SENTINEL');
});

const validProfile = () => ({
  id: 'profile-tech-grade1',
  schoolYear: '2026/27',
  schoolOrder: 'lower_secondary' as const,
  gradeLevel: 1,
  cohortRef: '2026-2027:secondaria:classe-i',
  subjectCode: 'tecnologia',
  normativeRegime: 'Regime 2025',
  normativeReference: {
    id: 'norm-tech',
    sourceRef: 'DPR_89_2009_ART5_TABLE_3',
    version: 'DPR-89-2009',
    nationalHoursDefined: true,
    nationalWeeklyHours: 2,
    nationalAnnualHours: 66,
    allocationScope: 'discipline' as const
  },
  reservePercent: 15,
  assessmentPeriods: [],
  calendar: {
    startDate: '2026-09-14',
    endDate: '2027-06-08',
    closureDates: [],
    weeklySlots: [{ id: 'slot-1', weekday: 1 as const, hours: 2 }]
  }
});

const validPayload = () => ({
  contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
  contractVersion: 1,
  sourceProduct: 'ARENA',
  targetProduct: 'REGISTRO_DOCENTE',
  importMode: 'PREVIEW_ONLY',
  acceptanceRequired: true,
  automaticWriteAllowed: false,
  instituteName: 'Istituto Comprensivo Statale “Lorenzo Milani”',
  schoolYear: '2026/27',
  sourceSchoolYear: '2026-2027',
  schoolOrder: 'secondaria',
  subjectCode: 'tecnologia',
  gradeLevel: 1,
  cohortRef: '2026-2027:secondaria:classe-i',
  cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
  normativeRegime: 'Regime 2025',
  applicabilityStatus: 'APPLICABLE',
  authorityState: 'PROVISIONAL_COMPLETE',
  vigencyStatus: 'NON_VIGENTE',
  authorityReceiptRef: null,
  masterId: 'CAN-CURR-MASTER-00',
  masterVersion: '1.3',
  structuralFingerprint: {
    scope: 'MASTER',
    algorithm: 'fnv1a',
    version: 1,
    hash: 'b355be71'
  },
  provenance: {
    repository: 'antoniocorsano-boop/CurManLight_arena',
    sourceCommit: '7d34344ede0ae5dcd2c0224c83f5a46d40fad825',
    sourceDocumentId: 'drive-doc-id',
    sourceRevisionId: 'drive-revision-id'
  },
  curricoloItems: [{
    id: 'secondaria-di-primo-grado-tecnologia-classe-i',
    kind: 'ANNUALITA_DISCIPLINARE',
    schoolStage: 'Secondaria di primo grado',
    gradeLabel: 'Classe I',
    sourceSection: '7.3.8',
    text: 'Contenuto curricolare Arena.'
  }],
  privacyClass: 'PROFESSIONAL_NON_PERSONAL'
});

async function loadConsumer() {
  const moduleUrl = new URL('../planning/arenaPlanningContext.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  const modulePath = '../planning/' + 'arenaPlanningContext';
  return import(modulePath);
}

describe('EDU-PLAN-01B Arena → Registro read-only consumer', () => {
  test('accepts the governed v1 payload only as a preview and preserves authority, vigency and provenance', async () => {
    const { previewArenaPlanningContext } = await loadConsumer();
    const result = previewArenaPlanningContext(validPayload(), validProfile());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.context).toMatchObject({
      profileId: 'profile-tech-grade1',
      contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
      importMode: 'PREVIEW_ONLY',
      authorityState: 'PROVISIONAL_COMPLETE',
      vigencyStatus: 'NON_VIGENTE',
      regimeRef: 'Regime 2025',
      structuralFingerprint: {
        scope: 'MASTER',
        hash: 'b355be71'
      },
      provenance: {
        repository: 'antoniocorsano-boop/CurManLight_arena',
        sourceCommit: '7d34344ede0ae5dcd2c0224c83f5a46d40fad825'
      }
    });
    expect(result.context.curricoloItems[0].sourceSection).toBe('7.3.8');
  });

  test('fails closed on downstream policy violations', async () => {
    const { previewArenaPlanningContext } = await loadConsumer();

    const cases = [
      { patch: { targetProduct: 'DOCENTE_OS' }, code: 'TARGET_PRODUCT_MISMATCH' },
      { patch: { importMode: 'WRITE_THROUGH' }, code: 'IMPORT_MODE_NOT_PREVIEW_ONLY' },
      { patch: { acceptanceRequired: false }, code: 'ACCEPTANCE_NOT_REQUIRED' },
      { patch: { automaticWriteAllowed: true }, code: 'AUTOMATIC_WRITE_FORBIDDEN' }
    ];

    for (const item of cases) {
      const result = previewArenaPlanningContext({ ...validPayload(), ...item.patch }, validProfile());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContain(item.code);
    }
  });

  test('fails closed when profile identity, cohort or normative regime do not match', async () => {
    const { previewArenaPlanningContext } = await loadConsumer();
    const payload = validPayload();

    const mismatches = [
      { profile: { ...validProfile(), schoolYear: '2027/28' }, code: 'SCHOOL_YEAR_MISMATCH' },
      { profile: { ...validProfile(), subjectCode: 'scienze' }, code: 'SUBJECT_MISMATCH' },
      { profile: { ...validProfile(), gradeLevel: 2 }, code: 'GRADE_LEVEL_MISMATCH' },
      { profile: { ...validProfile(), cohortRef: 'other-cohort' }, code: 'COHORT_MISMATCH' },
      { profile: { ...validProfile(), normativeRegime: 'Regime precedente' }, code: 'NORMATIVE_REGIME_MISMATCH' }
    ];

    for (const item of mismatches) {
      const result = previewArenaPlanningContext(payload, item.profile);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContain(item.code);
    }
  });

  test('rejects inconsistent authority/vigency and incomplete provenance/content', async () => {
    const { previewArenaPlanningContext } = await loadConsumer();

    const provisionalVigente = previewArenaPlanningContext({
      ...validPayload(),
      vigencyStatus: 'VIGENTE'
    }, validProfile());
    expect(provisionalVigente.ok).toBe(false);
    if (!provisionalVigente.ok) expect(provisionalVigente.errors).toContain('PROVISIONAL_CANNOT_BE_VIGENTE');

    const approvedWithoutReceipt = previewArenaPlanningContext({
      ...validPayload(),
      authorityState: 'APPROVED',
      vigencyStatus: 'VIGENTE',
      authorityReceiptRef: null
    }, validProfile());
    expect(approvedWithoutReceipt.ok).toBe(false);
    if (!approvedWithoutReceipt.ok) expect(approvedWithoutReceipt.errors).toContain('VIGENTE_AUTHORITY_EVIDENCE_REQUIRED');

    const incomplete = previewArenaPlanningContext({
      ...validPayload(),
      provenance: { ...validPayload().provenance, sourceCommit: '' },
      structuralFingerprint: { ...validPayload().structuralFingerprint, hash: '' },
      curricoloItems: []
    }, validProfile());
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.errors).toEqual(expect.arrayContaining([
        'PROVENANCE_REQUIRED',
        'MASTER_FINGERPRINT_REQUIRED',
        'CURRICOLO_ITEMS_REQUIRED'
      ]));
    }
  });

  test('does not persist preview data until the teacher explicitly accepts the binding', async () => {
    const { previewArenaPlanningContext, bindAcceptedArenaPlanningContext } = await loadConsumer();
    const preview = previewArenaPlanningContext(validPayload(), validProfile());
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(() => bindAcceptedArenaPlanningContext([], preview.context, {
      accepted: false,
      acceptedAt: '2026-10-24T10:30:00.000Z'
    })).toThrow('ARENA_CONTEXT_ACCEPTANCE_REQUIRED');

    const bound = bindAcceptedArenaPlanningContext([], preview.context, {
      accepted: true,
      acceptedAt: '2026-10-24T10:30:00.000Z'
    });

    expect(bound).toHaveLength(1);
    expect(bound[0]).toMatchObject({
      profileId: 'profile-tech-grade1',
      acceptedAt: '2026-10-24T10:30:00.000Z',
      authorityState: 'PROVISIONAL_COMPLETE',
      vigencyStatus: 'NON_VIGENTE'
    });
  });
});
