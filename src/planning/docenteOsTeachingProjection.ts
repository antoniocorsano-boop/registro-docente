// @trama-readonly — pure Docente OS projection preview/validator; no persistence or remote mutation.

export const DOCENTE_OS_TEACHING_PROJECTION_CONTRACT = 'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1' as const;

export type DocenteOsTeachingProjectionGrade = 1 | 2 | 3;
export type DocenteOsTeachingProjectionSectionStatus = 'PROVVISORIA' | 'DA_CONFERMARE' | 'CONFERMATA';

export type DocenteOsTeachingProjectionUdaV1 = {
  sourceUdaRef: string;
  projectedUdaId: string;
  title: string;
  focus: string;
  plannedHours: number;
  period: string;
  packRefs: string[];
  canonicalGenerationId: string;
};

export type DocenteOsTeachingProjectionClassV1 = {
  sourceSectionId: string;
  grade: DocenteOsTeachingProjectionGrade;
  sectionCode: string;
  compactLabel: string;
  displayLabel: string;
  sectionStatus: DocenteOsTeachingProjectionSectionStatus;
  canonicalPlan: {
    code: string;
    assetId: string;
    generationId: string;
  };
  udas: DocenteOsTeachingProjectionUdaV1[];
};

export type DocenteOsTeachingProjectionV1 = {
  contract: typeof DOCENTE_OS_TEACHING_PROJECTION_CONTRACT;
  contractVersion: 1;
  sourceProduct: 'DOCENTE_OS';
  targetProduct: 'REGISTRO_DOCENTE';
  importMode: 'READ_ONLY_PROJECTION';
  acceptanceRequired: true;
  automaticWriteAllowed: false;
  schoolYear: string;
  disciplineName: string;
  generatedAt: string;
  projectionFingerprint: {
    algorithm: 'SHA-256';
    hash: string;
  };
  provenance: {
    repository: 'antoniocorsano-boop/docente-os-2026-27';
    sourceCommit: string;
    sourceBranch: string;
  };
  classes: DocenteOsTeachingProjectionClassV1[];
  privacyClass: 'PROFESSIONAL_NON_PERSONAL';
};

export type DocenteOsProjectionValidationErrorCode =
  | 'INVALID_ROOT_SHAPE'
  | 'INVALID_CONTRACT'
  | 'INVALID_PRODUCT_BOUNDARY'
  | 'INVALID_AUTHORITY_BOUNDARY'
  | 'INVALID_PRIVACY_CLASS'
  | 'INVALID_METADATA'
  | 'INVALID_FINGERPRINT'
  | 'INVALID_PROVENANCE'
  | 'INVALID_CLASSES'
  | 'INVALID_CLASS_SHAPE'
  | 'INVALID_CLASS'
  | 'DUPLICATE_SOURCE_SECTION_ID'
  | 'INVALID_CANONICAL_PLAN'
  | 'INVALID_UDAS'
  | 'INVALID_UDA_SHAPE'
  | 'INVALID_UDA'
  | 'INVALID_UDA_GENERATION'
  | 'INVALID_PROJECTED_UDA_ID'
  | 'DUPLICATE_PROJECTED_UDA_ID'
  | 'FINGERPRINT_MISMATCH';

export type DocenteOsProjectionPreviewResult =
  | { ok: true; projection: DocenteOsTeachingProjectionV1 }
  | { ok: false; code: DocenteOsProjectionValidationErrorCode; message: string };

const ROOT_KEYS = [
  'contract',
  'contractVersion',
  'sourceProduct',
  'targetProduct',
  'importMode',
  'acceptanceRequired',
  'automaticWriteAllowed',
  'schoolYear',
  'disciplineName',
  'generatedAt',
  'projectionFingerprint',
  'provenance',
  'classes',
  'privacyClass',
] as const;
const FINGERPRINT_KEYS = ['algorithm', 'hash'] as const;
const PROVENANCE_KEYS = ['repository', 'sourceCommit', 'sourceBranch'] as const;
const CLASS_KEYS = [
  'sourceSectionId',
  'grade',
  'sectionCode',
  'compactLabel',
  'displayLabel',
  'sectionStatus',
  'canonicalPlan',
  'udas',
] as const;
const PLAN_KEYS = ['code', 'assetId', 'generationId'] as const;
const UDA_KEYS = [
  'sourceUdaRef',
  'projectedUdaId',
  'title',
  'focus',
  'plannedHours',
  'period',
  'packRefs',
  'canonicalGenerationId',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSchoolYear(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})\/(\d{4})$/.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(parsed);
}

function isSectionCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9-]{1,4}$/.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Hex(text: string): string {
  const source = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;

  const bitLength = source.length * 8;
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const w15 = words[index - 15];
      const w2 = words[index - 2];
      const s0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const s1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
}

function fingerprintPayload(projection: Omit<DocenteOsTeachingProjectionV1, 'projectionFingerprint'>) {
  const { generatedAt: _generatedAt, ...stable } = projection;
  return stable;
}

export function computeDocenteOsTeachingProjectionFingerprint(
  projection: Omit<DocenteOsTeachingProjectionV1, 'projectionFingerprint'>,
): string {
  return sha256Hex(stableJson(fingerprintPayload(projection)));
}

function invalid(code: DocenteOsProjectionValidationErrorCode, message: string): DocenteOsProjectionPreviewResult {
  return { ok: false, code, message };
}

export function previewDocenteOsTeachingProjection(input: unknown): DocenteOsProjectionPreviewResult {
  if (!isRecord(input) || !hasExactKeys(input, ROOT_KEYS)) {
    return invalid('INVALID_ROOT_SHAPE', 'Projection root must contain exactly the v1 contract properties.');
  }
  if (input.contract !== DOCENTE_OS_TEACHING_PROJECTION_CONTRACT || input.contractVersion !== 1) {
    return invalid('INVALID_CONTRACT', 'Unsupported Registro teaching projection contract.');
  }
  if (input.sourceProduct !== 'DOCENTE_OS' || input.targetProduct !== 'REGISTRO_DOCENTE') {
    return invalid('INVALID_PRODUCT_BOUNDARY', 'Projection product boundary is invalid.');
  }
  if (input.importMode !== 'READ_ONLY_PROJECTION' || input.acceptanceRequired !== true || input.automaticWriteAllowed !== false) {
    return invalid('INVALID_AUTHORITY_BOUNDARY', 'Projection must remain explicit, read-only and non-automatic.');
  }
  if (input.privacyClass !== 'PROFESSIONAL_NON_PERSONAL') {
    return invalid('INVALID_PRIVACY_CLASS', 'Projection must be professional and non-personal.');
  }
  if (!isSchoolYear(input.schoolYear) || !isNonEmptyString(input.disciplineName) || !isIsoTimestamp(input.generatedAt)) {
    return invalid('INVALID_METADATA', 'Projection metadata is incomplete or invalid.');
  }

  if (!isRecord(input.projectionFingerprint) || !hasExactKeys(input.projectionFingerprint, FINGERPRINT_KEYS)) {
    return invalid('INVALID_FINGERPRINT', 'Projection fingerprint shape is invalid.');
  }
  if (
    input.projectionFingerprint.algorithm !== 'SHA-256' ||
    typeof input.projectionFingerprint.hash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(input.projectionFingerprint.hash)
  ) {
    return invalid('INVALID_FINGERPRINT', 'Projection fingerprint must be a lower-case SHA-256 hex digest.');
  }

  if (!isRecord(input.provenance) || !hasExactKeys(input.provenance, PROVENANCE_KEYS)) {
    return invalid('INVALID_PROVENANCE', 'Projection provenance shape is invalid.');
  }
  if (
    input.provenance.repository !== 'antoniocorsano-boop/docente-os-2026-27' ||
    typeof input.provenance.sourceCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(input.provenance.sourceCommit) ||
    !isNonEmptyString(input.provenance.sourceBranch)
  ) {
    return invalid('INVALID_PROVENANCE', 'Projection provenance is invalid.');
  }

  if (!Array.isArray(input.classes)) return invalid('INVALID_CLASSES', 'Projection classes must be an array.');
  const sourceSectionIds = new Set<string>();
  const projectedUdaIds = new Set<string>();

  for (const section of input.classes) {
    if (!isRecord(section) || !hasExactKeys(section, CLASS_KEYS)) {
      return invalid('INVALID_CLASS_SHAPE', 'Projected class contains unexpected or missing properties.');
    }
    if (!isNonEmptyString(section.sourceSectionId)) {
      return invalid('INVALID_CLASS', 'Projected class source id is required.');
    }
    if (sourceSectionIds.has(section.sourceSectionId)) {
      return invalid('DUPLICATE_SOURCE_SECTION_ID', 'Projected class source ids must be unique.');
    }
    sourceSectionIds.add(section.sourceSectionId);
    if (section.grade !== 1 && section.grade !== 2 && section.grade !== 3) {
      return invalid('INVALID_CLASS', 'Projected class grade is invalid.');
    }
    if (
      !isSectionCode(section.sectionCode) ||
      section.compactLabel !== `${section.grade}${section.sectionCode}` ||
      section.displayLabel !== `${section.grade}ª ${section.sectionCode}`
    ) {
      return invalid('INVALID_CLASS', 'Projected class labels are incomplete or inconsistent.');
    }
    if (
      section.sectionStatus !== 'PROVVISORIA' &&
      section.sectionStatus !== 'DA_CONFERMARE' &&
      section.sectionStatus !== 'CONFERMATA'
    ) {
      return invalid('INVALID_CLASS', 'Projected class status is invalid.');
    }
    if (!isRecord(section.canonicalPlan) || !hasExactKeys(section.canonicalPlan, PLAN_KEYS)) {
      return invalid('INVALID_CANONICAL_PLAN', 'Canonical plan identity is invalid.');
    }
    if (
      !isNonEmptyString(section.canonicalPlan.code) ||
      !isNonEmptyString(section.canonicalPlan.assetId) ||
      !isNonEmptyString(section.canonicalPlan.generationId)
    ) {
      return invalid('INVALID_CANONICAL_PLAN', 'Canonical plan identity is incomplete.');
    }
    if (!Array.isArray(section.udas)) return invalid('INVALID_UDAS', 'Projected UDAs must be an array.');

    for (const uda of section.udas) {
      if (!isRecord(uda) || !hasExactKeys(uda, UDA_KEYS)) {
        return invalid('INVALID_UDA_SHAPE', 'Projected UDA contains unexpected or missing properties.');
      }
      if (
        !isNonEmptyString(uda.sourceUdaRef) ||
        !isNonEmptyString(uda.projectedUdaId) ||
        !isNonEmptyString(uda.title) ||
        !isNonEmptyString(uda.focus) ||
        typeof uda.plannedHours !== 'number' ||
        !Number.isFinite(uda.plannedHours) ||
        uda.plannedHours <= 0 ||
        !isNonEmptyString(uda.period) ||
        !Array.isArray(uda.packRefs) ||
        !uda.packRefs.every(isNonEmptyString) ||
        !isNonEmptyString(uda.canonicalGenerationId)
      ) {
        return invalid('INVALID_UDA', 'Projected UDA is incomplete or invalid.');
      }
      if (uda.canonicalGenerationId !== section.canonicalPlan.generationId) {
        return invalid('INVALID_UDA_GENERATION', 'Projected UDA generation must match its canonical plan generation.');
      }
      const expectedId = `docente-os:${section.sourceSectionId}:${section.canonicalPlan.generationId}:${uda.sourceUdaRef}`;
      if (uda.projectedUdaId !== expectedId) {
        return invalid('INVALID_PROJECTED_UDA_ID', 'Projected UDA identity does not match canonical source identity.');
      }
      if (projectedUdaIds.has(uda.projectedUdaId)) {
        return invalid('DUPLICATE_PROJECTED_UDA_ID', 'Projected UDA identities must be unique.');
      }
      projectedUdaIds.add(uda.projectedUdaId);
    }
  }

  const projection = input as DocenteOsTeachingProjectionV1;
  const { projectionFingerprint, ...withoutFingerprint } = projection;
  const expectedHash = computeDocenteOsTeachingProjectionFingerprint(withoutFingerprint);
  if (projectionFingerprint.hash !== expectedHash) {
    return invalid('FINGERPRINT_MISMATCH', 'Projection fingerprint does not match the stable payload.');
  }

  return { ok: true, projection };
}
