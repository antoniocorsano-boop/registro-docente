import type {
  ArenaCurricoloItem,
  ArenaMasterFingerprint,
  ArenaPlanningContext,
  ArenaPlanningContextPreview,
  ArenaPlanningProvenance,
  TeachingProfile
} from './types';

export type ArenaPlanningContextError =
  | 'CONTRACT_MISMATCH'
  | 'CONTRACT_VERSION_MISMATCH'
  | 'SOURCE_PRODUCT_MISMATCH'
  | 'TARGET_PRODUCT_MISMATCH'
  | 'IMPORT_MODE_NOT_PREVIEW_ONLY'
  | 'ACCEPTANCE_NOT_REQUIRED'
  | 'AUTOMATIC_WRITE_FORBIDDEN'
  | 'UNEXPECTED_PROPERTY'
  | 'INSTITUTE_NAME_REQUIRED'
  | 'SOURCE_SCHOOL_YEAR_REQUIRED'
  | 'SCHOOL_YEAR_MISMATCH'
  | 'SCHOOL_ORDER_MISMATCH'
  | 'SUBJECT_MISMATCH'
  | 'GRADE_LEVEL_MISMATCH'
  | 'COHORT_MISMATCH'
  | 'COHORT_KIND_MISMATCH'
  | 'NORMATIVE_REGIME_MISMATCH'
  | 'APPLICABILITY_STATUS_INVALID'
  | 'AUTHORITY_STATE_INVALID'
  | 'VIGENCY_STATUS_INVALID'
  | 'PROVISIONAL_CANNOT_BE_VIGENTE'
  | 'VIGENTE_AUTHORITY_EVIDENCE_REQUIRED'
  | 'MASTER_IDENTITY_REQUIRED'
  | 'PROVENANCE_REQUIRED'
  | 'MASTER_FINGERPRINT_REQUIRED'
  | 'CURRICOLO_ITEMS_REQUIRED'
  | 'PRIVACY_CLASS_MISMATCH';

export type ArenaPlanningContextPreviewResult =
  | { ok: true; context: ArenaPlanningContextPreview }
  | { ok: false; errors: ArenaPlanningContextError[] };

type UnknownRecord = Record<string, unknown>;

const ROOT_KEYS = new Set([
  'contract',
  'contractVersion',
  'sourceProduct',
  'targetProduct',
  'importMode',
  'acceptanceRequired',
  'automaticWriteAllowed',
  'instituteName',
  'schoolYear',
  'sourceSchoolYear',
  'schoolOrder',
  'subjectCode',
  'gradeLevel',
  'cohortRef',
  'cohortRefKind',
  'normativeRegime',
  'applicabilityStatus',
  'authorityState',
  'vigencyStatus',
  'authorityReceiptRef',
  'masterId',
  'masterVersion',
  'structuralFingerprint',
  'provenance',
  'curricoloItems',
  'privacyClass'
]);
const FINGERPRINT_KEYS = new Set(['scope', 'algorithm', 'version', 'hash']);
const PROVENANCE_KEYS = new Set(['repository', 'sourceCommit', 'sourceDocumentId', 'sourceRevisionId']);
const CURRICOLO_ITEM_KEYS = new Set(['id', 'kind', 'schoolStage', 'gradeLabel', 'sourceSection', 'text']);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: UnknownRecord, allowed: Set<string>): boolean =>
  Object.keys(value).every(key => allowed.has(key));

const expectedArenaSchoolOrder = (profile: TeachingProfile): 'primaria' | 'secondaria' =>
  profile.schoolOrder === 'primary' ? 'primaria' : 'secondaria';

function readFingerprint(value: unknown): ArenaMasterFingerprint | null {
  if (!isRecord(value) || !hasOnlyKeys(value, FINGERPRINT_KEYS)) return null;
  if (value.scope !== 'MASTER') return null;
  if (value.algorithm !== 'fnv1a') return null;
  if (value.version !== 1) return null;
  if (typeof value.hash !== 'string' || !/^[0-9a-f]{8}$/.test(value.hash)) return null;

  return {
    scope: 'MASTER',
    algorithm: 'fnv1a',
    version: 1,
    hash: value.hash
  };
}

function readProvenance(value: unknown): ArenaPlanningProvenance | null {
  if (!isRecord(value) || !hasOnlyKeys(value, PROVENANCE_KEYS)) return null;
  if (value.repository !== 'antoniocorsano-boop/CurManLight_arena') return null;
  if (typeof value.sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(value.sourceCommit)) return null;
  if (!nonEmptyString(value.sourceDocumentId)) return null;
  if (!nonEmptyString(value.sourceRevisionId)) return null;

  return {
    repository: 'antoniocorsano-boop/CurManLight_arena',
    sourceCommit: value.sourceCommit,
    sourceDocumentId: value.sourceDocumentId,
    sourceRevisionId: value.sourceRevisionId
  };
}

function readCurricoloItems(value: unknown): ArenaCurricoloItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const items: ArenaCurricoloItem[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, CURRICOLO_ITEM_KEYS)) return null;
    if (!nonEmptyString(candidate.id)) return null;
    if (candidate.kind !== 'ANNUALITA_DISCIPLINARE') return null;
    if (!nonEmptyString(candidate.schoolStage)) return null;
    if (!nonEmptyString(candidate.gradeLabel)) return null;
    if (!nonEmptyString(candidate.sourceSection)) return null;
    if (!nonEmptyString(candidate.text)) return null;

    items.push({
      id: candidate.id,
      kind: 'ANNUALITA_DISCIPLINARE',
      schoolStage: candidate.schoolStage,
      gradeLabel: candidate.gradeLabel,
      sourceSection: candidate.sourceSection,
      text: candidate.text
    });
  }

  return items;
}

export function previewArenaPlanningContext(
  payload: unknown,
  profile: TeachingProfile
): ArenaPlanningContextPreviewResult {
  const errors: ArenaPlanningContextError[] = [];

  if (!isRecord(payload)) {
    return { ok: false, errors: ['CONTRACT_MISMATCH'] };
  }
  if (!hasOnlyKeys(payload, ROOT_KEYS)) errors.push('UNEXPECTED_PROPERTY');

  if (payload.contract !== 'ARENA_REGISTRO_PLANNING_CONTEXT_V1') errors.push('CONTRACT_MISMATCH');
  if (payload.contractVersion !== 1) errors.push('CONTRACT_VERSION_MISMATCH');
  if (payload.sourceProduct !== 'ARENA') errors.push('SOURCE_PRODUCT_MISMATCH');
  if (payload.targetProduct !== 'REGISTRO_DOCENTE') errors.push('TARGET_PRODUCT_MISMATCH');
  if (payload.importMode !== 'PREVIEW_ONLY') errors.push('IMPORT_MODE_NOT_PREVIEW_ONLY');
  if (payload.acceptanceRequired !== true) errors.push('ACCEPTANCE_NOT_REQUIRED');
  if (payload.automaticWriteAllowed !== false) errors.push('AUTOMATIC_WRITE_FORBIDDEN');
  if (!nonEmptyString(payload.instituteName)) errors.push('INSTITUTE_NAME_REQUIRED');
  if (!nonEmptyString(payload.sourceSchoolYear)) errors.push('SOURCE_SCHOOL_YEAR_REQUIRED');

  if (payload.schoolYear !== profile.schoolYear) errors.push('SCHOOL_YEAR_MISMATCH');
  if (payload.schoolOrder !== expectedArenaSchoolOrder(profile)) errors.push('SCHOOL_ORDER_MISMATCH');
  if (payload.subjectCode !== profile.subjectCode) errors.push('SUBJECT_MISMATCH');
  if (!Number.isInteger(payload.gradeLevel) || (payload.gradeLevel as number) < 1 || (payload.gradeLevel as number) > 5 || payload.gradeLevel !== profile.gradeLevel) {
    errors.push('GRADE_LEVEL_MISMATCH');
  }
  if (payload.cohortRef !== profile.cohortRef) errors.push('COHORT_MISMATCH');
  if (payload.cohortRefKind !== 'DERIVED_APPLICABILITY_KEY') errors.push('COHORT_KIND_MISMATCH');
  if (!nonEmptyString(profile.normativeRegime) || payload.normativeRegime !== profile.normativeRegime) {
    errors.push('NORMATIVE_REGIME_MISMATCH');
  }

  if (payload.applicabilityStatus !== 'APPLICABLE' && payload.applicabilityStatus !== 'TRANSITIONAL') {
    errors.push('APPLICABILITY_STATUS_INVALID');
  }
  if (payload.authorityState !== 'APPROVED' && payload.authorityState !== 'PROVISIONAL_COMPLETE') {
    errors.push('AUTHORITY_STATE_INVALID');
  }
  if (payload.vigencyStatus !== 'VIGENTE' && payload.vigencyStatus !== 'NON_VIGENTE') {
    errors.push('VIGENCY_STATUS_INVALID');
  }
  if (payload.authorityState === 'PROVISIONAL_COMPLETE' && payload.vigencyStatus === 'VIGENTE') {
    errors.push('PROVISIONAL_CANNOT_BE_VIGENTE');
  }
  if (
    payload.vigencyStatus === 'VIGENTE' &&
    (payload.authorityState !== 'APPROVED' || !nonEmptyString(payload.authorityReceiptRef))
  ) {
    errors.push('VIGENTE_AUTHORITY_EVIDENCE_REQUIRED');
  }
  if (
    payload.vigencyStatus !== 'VIGENTE' &&
    payload.authorityReceiptRef !== undefined &&
    payload.authorityReceiptRef !== null &&
    typeof payload.authorityReceiptRef !== 'string'
  ) {
    errors.push('VIGENTE_AUTHORITY_EVIDENCE_REQUIRED');
  }

  if (!nonEmptyString(payload.masterId) || !nonEmptyString(payload.masterVersion)) {
    errors.push('MASTER_IDENTITY_REQUIRED');
  }

  const structuralFingerprint = readFingerprint(payload.structuralFingerprint);
  if (!structuralFingerprint) errors.push('MASTER_FINGERPRINT_REQUIRED');

  const provenance = readProvenance(payload.provenance);
  if (!provenance) errors.push('PROVENANCE_REQUIRED');

  const curricoloItems = readCurricoloItems(payload.curricoloItems);
  if (!curricoloItems) errors.push('CURRICOLO_ITEMS_REQUIRED');

  if (payload.privacyClass !== 'PROFESSIONAL_NON_PERSONAL') errors.push('PRIVACY_CLASS_MISMATCH');

  if (errors.length > 0) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    context: {
      profileId: profile.id,
      contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
      contractVersion: 1,
      sourceProduct: 'ARENA',
      targetProduct: 'REGISTRO_DOCENTE',
      importMode: 'PREVIEW_ONLY',
      acceptanceRequired: true,
      automaticWriteAllowed: false,
      institutionRef: payload.instituteName as string,
      schoolYear: payload.schoolYear as string,
      sourceSchoolYear: payload.sourceSchoolYear as string,
      schoolOrder: payload.schoolOrder as 'primaria' | 'secondaria',
      subjectCode: payload.subjectCode as string,
      gradeLevel: payload.gradeLevel as number,
      cohortRef: payload.cohortRef as string,
      cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
      applicabilityStatus: payload.applicabilityStatus as 'APPLICABLE' | 'TRANSITIONAL',
      regimeRef: payload.normativeRegime as string,
      authorityState: payload.authorityState as 'APPROVED' | 'PROVISIONAL_COMPLETE',
      vigencyStatus: payload.vigencyStatus as 'VIGENTE' | 'NON_VIGENTE',
      authorityReceiptRef: nonEmptyString(payload.authorityReceiptRef) ? payload.authorityReceiptRef : null,
      masterId: payload.masterId as string,
      masterVersion: payload.masterVersion as string,
      structuralFingerprint: structuralFingerprint!,
      provenance: provenance!,
      curricoloItems: curricoloItems!,
      privacyClass: 'PROFESSIONAL_NON_PERSONAL'
    }
  };
}

export function bindAcceptedArenaPlanningContext(
  current: ArenaPlanningContext[],
  preview: ArenaPlanningContextPreview,
  decision: { accepted: boolean; acceptedAt: string }
): ArenaPlanningContext[] {
  if (!decision.accepted) {
    throw new Error('ARENA_CONTEXT_ACCEPTANCE_REQUIRED');
  }
  if (!nonEmptyString(decision.acceptedAt)) {
    throw new Error('ARENA_CONTEXT_ACCEPTANCE_TIMESTAMP_REQUIRED');
  }

  const id = [
    'arena-context',
    preview.profileId,
    preview.masterId,
    preview.masterVersion,
    preview.structuralFingerprint.hash,
    preview.provenance.sourceCommit
  ].join(':');

  if (current.some(existing => existing.id === id)) {
    return current;
  }

  return [
    ...current,
    {
      ...preview,
      id,
      acceptedAt: decision.acceptedAt
    }
  ];
}
