import type {
  AppData, AppSettings, ClassData, CouncilEvidenceAggregatesV1,
  CouncilEvidenceSnapshotV1, CouncilSession
} from '../types';
import { buildCouncilEvidenceOverview } from './councilEvidenceOverview';
import { isCouncilSessionDateValid, normalizeSchoolYear } from './councilModel';

/**
 * CDC-02/S2b-P1 — pure, isolated model.
 * NO Vault writes, UI effects, backup upgrades, network, or official council documents.
 * Fingerprints are encrypted-record integrity hints, NOT signatures/anonymization.
 */
const SNAPSHOT_CONTRACT = 'council-evidence-overview-v1' as const;
const SNAPSHOT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COUNTS = [
  'totalStudents', 'withNumericEvidence', 'withoutNumericEvidence',
  'numericEvidenceCount', 'withSavedTeacherProposal', 'withoutSavedTeacherProposal'
] as const;

export interface CouncilCaptureClockV1 {
  capturedAt: string;
  captureLocalDate: string;
  captureUtcOffsetMinutes: number;
}

export interface CouncilSnapshotContextV1 {
  classId: string;
  schoolYear: string;
  sessionId: string;
  cutoff: string;
}

/** No confirmation marker or digest appears in a preview. */
export type CouncilSnapshotPreviewV1 = Omit<
  CouncilEvidenceSnapshotV1, 'id' | 'confirmedByTeacher' | 'contentDigest'
>;

function civilDate(date: Date): string {
  return [String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

/** Called at commit with ONE Date instance, never three independent clock reads. */
export function createCaptureClock(instant: Date): CouncilCaptureClockV1 {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw new Error('Istante di acquisizione non valido.');
  }
  return {
    capturedAt: instant.toISOString(),
    captureLocalDate: civilDate(instant),
    captureUtcOffsetMinutes: instant.getTimezoneOffset()
  };
}

function validDate(date: unknown): date is string {
  if (typeof date !== 'string' || !ISO_DATE.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Deterministic local-day check independent of the timezone on restore. */
export function isCaptureClockValid(value: unknown): value is CouncilCaptureClockV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  // Never let a structurally assignable clock carry extra snapshot fields.
  if (Object.keys(input).length !== 3
    || Object.keys(input).some(key => ![
      'capturedAt', 'captureLocalDate', 'captureUtcOffsetMinutes'
    ].includes(key))) return false;
  if (typeof input.capturedAt !== 'string' || !ISO_UTC.test(input.capturedAt)
    || !validDate(input.captureLocalDate)
    || typeof input.captureUtcOffsetMinutes !== 'number'
    || !Number.isInteger(input.captureUtcOffsetMinutes)
    || input.captureUtcOffsetMinutes < -840
    || Number(input.captureUtcOffsetMinutes) > 840) return false;
  const at = Date.parse(input.capturedAt);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== input.capturedAt) return false;
  const localMillis = at - Number(input.captureUtcOffsetMinutes) * 60_000;
  const localInstant = new Date(localMillis);
  return Number.isFinite(localInstant.getTime())
    && localInstant.toISOString().slice(0, 10) === input.captureLocalDate;
}

function nfc(value: string): string {
  return value.normalize('NFC');
}

function stringOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Hash fixed-position arrays, never locale-dependent object iteration order. */
async function digest(tuple: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(tuple));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isCounts(value: unknown): value is CouncilEvidenceAggregatesV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const map = value as Record<string, unknown>;
  if (Object.keys(map).length !== COUNTS.length
    || Object.keys(map).some(key => !COUNTS.includes(key as typeof COUNTS[number]))
    || COUNTS.some(key => typeof map[key] !== 'number'
      || !Number.isSafeInteger(map[key]) || Number(map[key]) < 0)) return false;
  return Number(map.withNumericEvidence) + Number(map.withoutNumericEvidence) === Number(map.totalStudents)
    && Number(map.withSavedTeacherProposal) + Number(map.withoutSavedTeacherProposal) === Number(map.totalStudents)
    && Number(map.numericEvidenceCount) >= Number(map.withNumericEvidence)
    && (Number(map.totalStudents) !== 0 || Number(map.numericEvidenceCount) === 0);
}

function snapshotTuple(snapshot: Omit<CouncilEvidenceSnapshotV1, 'contentDigest'>): unknown[] {
  const a = snapshot.aggregates;
  return [
    'CDC-02/S2B/snapshot-v1', snapshot.schemaVersion, nfc(snapshot.id),
    nfc(snapshot.classId), snapshot.schoolYear, nfc(snapshot.sessionId),
    snapshot.sessionDate, snapshot.sessionKind, snapshot.revision,
    snapshot.supersedesSnapshotId ? nfc(snapshot.supersedesSnapshotId) : null,
    snapshot.capturedAt, snapshot.captureLocalDate, snapshot.captureUtcOffsetMinutes,
    snapshot.confirmedByTeacher, snapshot.requestedCutoff, snapshot.effectiveCutoff,
    snapshot.cutoffClampedToSchoolYear, snapshot.calculationContract,
    ...COUNTS.map(key => a[key]), snapshot.rosterFingerprint, snapshot.sourceFingerprint
  ];
}

async function hashSnapshot(snapshot: Omit<CouncilEvidenceSnapshotV1, 'contentDigest'>): Promise<string> {
  return digest(snapshotTuple(snapshot));
}

function validateTemporal(
  year: string, sessionDate: string, cutoff: string, clock: CouncilCaptureClockV1
): void {
  const normalizedYear = normalizeSchoolYear(year);
  if (!normalizedYear || !validDate(cutoff) || !isCaptureClockValid(clock)
    || !isCouncilSessionDateValid(sessionDate, normalizedYear)) {
    throw new Error('Data, anno o riferimento temporale di acquisizione non valido.');
  }
  const startYear = Number(normalizedYear.slice(0, 4));
  if (cutoff < `${startYear}-09-01` || cutoff > `${startYear + 1}-08-31`
    || cutoff > sessionDate || cutoff > clock.captureLocalDate) {
    throw new Error('La data limite non può superare la seduta, la cattura o l’anno scolastico.');
  }
}

function findClass(data: AppData, classId: string): ClassData {
  const matches = data.classes.filter(item => item.id === classId);
  if (matches.length !== 1) throw new Error('Classe non trovata o identità ambigua.');
  return matches[0];
}

function findSession(klass: ClassData, schoolYear: string, sessionId: string): CouncilSession {
  const matches = (klass.councilSessions ?? []).filter(
    s => s.id === sessionId && normalizeSchoolYear(s.schoolYear) === schoolYear
  );
  if (matches.length !== 1 || !isCouncilSessionDateValid(matches[0].date, schoolYear)) {
    throw new Error('Seduta non presente o non coerente con la classe e l’anno.');
  }
  return matches[0];
}

async function sourceFingerprints(
  klass: ClassData, year: string, cutoff: string
): Promise<{ rosterFingerprint: string; sourceFingerprint: string }> {
  const ids = klass.students.map(s => nfc(s.id));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Identità degli alunni duplicata o assente.');
  }
  const sortedIds = [...ids].sort(stringOrder);
  const allowed = new Set(klass.students.map(s => s.id));
  const start = `${Number(year.slice(0, 4))}-09-01`;
  const records = klass.grades
    .filter(g => allowed.has(g.studentId) && typeof g.date === 'string'
      && ISO_DATE.test(g.date) && g.date >= start && g.date <= cutoff)
    .map(g => [
      nfc(g.id), nfc(g.studentId), g.date, g.type, g.period,
      nfc(g.title), nfc(g.value), g.delayed ?? null, g.udaId ? nfc(g.udaId) : null
    ]);
  const judgments = (klass.councilAssessments ?? [])
    .filter(v => allowed.has(v.studentId) && normalizeSchoolYear(v.schoolYear) === year
      && v.moment === 'ingresso')
    .map(v => [nfc(v.studentId), year, v.moment, nfc(v.value), v.updatedAt]);
  // JSON byte/codepoint ordering is independent of locale and input collection order.
  const ordered = (rows: unknown[][]) =>
    rows.sort((a, b) => stringOrder(JSON.stringify(a), JSON.stringify(b)));
  return {
    rosterFingerprint: await digest(['CDC-02/S2B/roster-v1', sortedIds]),
    sourceFingerprint: await digest(['CDC-02/S2B/source-v1', year, cutoff,
      ordered(records), ordered(judgments)])
  };
}

const snapshotKeys = [
  'schemaVersion', 'id', 'classId', 'schoolYear', 'sessionId', 'sessionDate',
  'sessionKind', 'revision', 'supersedesSnapshotId', 'capturedAt',
  'captureLocalDate', 'captureUtcOffsetMinutes', 'confirmedByTeacher',
  'requestedCutoff', 'effectiveCutoff', 'cutoffClampedToSchoolYear',
  'calculationContract', 'aggregates', 'rosterFingerprint',
  'sourceFingerprint', 'contentDigest'
] as const;

function validRecordShape(value: unknown, klass: ClassData): value is CouncilEvidenceSnapshotV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<CouncilEvidenceSnapshotV1>;
  if (Object.keys(record).some(key => !snapshotKeys.includes(key as typeof snapshotKeys[number]))
    || record.schemaVersion !== 1
    || typeof record.id !== 'string' || !SNAPSHOT_ID.test(record.id)
    || record.classId !== klass.id
    || normalizeSchoolYear(record.schoolYear) !== record.schoolYear
    || typeof record.sessionId !== 'string' || !SNAPSHOT_ID.test(record.sessionId)
    || typeof record.revision !== 'number'
    || !Number.isSafeInteger(record.revision) || Number(record.revision) < 1
    || (record.supersedesSnapshotId !== undefined
      && (typeof record.supersedesSnapshotId !== 'string'
        || !SNAPSHOT_ID.test(record.supersedesSnapshotId)))
    || typeof record.requestedCutoff !== 'string'
    || record.effectiveCutoff !== record.requestedCutoff
    || record.cutoffClampedToSchoolYear !== false
    || record.confirmedByTeacher !== true
    || record.calculationContract !== SNAPSHOT_CONTRACT
    || !isCounts(record.aggregates)
    || typeof record.rosterFingerprint !== 'string' || !SHA256_HEX.test(record.rosterFingerprint)
    || typeof record.sourceFingerprint !== 'string' || !SHA256_HEX.test(record.sourceFingerprint)
    || typeof record.contentDigest !== 'string' || !SHA256_HEX.test(record.contentDigest)) return false;
  const session = (klass.councilSessions ?? []).filter(item => item.id === record.sessionId
    && normalizeSchoolYear(item.schoolYear) === record.schoolYear);
  if (session.length !== 1 || session[0].date !== record.sessionDate
    || session[0].kind !== record.sessionKind) return false;
  try {
    validateTemporal(record.schoolYear!, record.sessionDate!, record.requestedCutoff!, {
      capturedAt: record.capturedAt!,
      captureLocalDate: record.captureLocalDate!,
      captureUtcOffsetMinutes: record.captureUtcOffsetMinutes!
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates only the isolated S2b field, not all AppData.
 * P2 must integrate this into backupPayload / isCouncilAppDataValid and loss detection.
 */
export async function validateCouncilSnapshots(klass: ClassData): Promise<boolean> {
  const snapshots: unknown = klass.councilEvidenceSnapshots;
  if (snapshots === undefined) return true;
  if (!Array.isArray(snapshots)) return false;
  const ids = new Set<string>();
  const bySession = new Map<string, CouncilEvidenceSnapshotV1[]>();
  for (const raw of snapshots) {
    if (!validRecordShape(raw, klass)) return false;
    const s = raw as CouncilEvidenceSnapshotV1;
    if (ids.has(s.id)) return false;
    ids.add(s.id);
    const { contentDigest: _, ...unsigned } = s;
    if (await hashSnapshot(unsigned) !== s.contentDigest) return false;
    const list = bySession.get(s.sessionId) ?? [];
    list.push(s);
    bySession.set(s.sessionId, list);
  }
  for (const group of bySession.values()) {
    const ordered = [...group].sort((a, b) => a.revision - b.revision);
    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      if (item.revision !== i + 1
        || (i === 0 && item.supersedesSnapshotId !== undefined)
        || (i > 0 && item.supersedesSnapshotId !== ordered[i - 1].id)) return false;
    }
  }
  return true;
}

export function readCouncilSnapshots(
  klass: ClassData, schoolYear: string, sessionId: string
): CouncilEvidenceSnapshotV1[] {
  const year = normalizeSchoolYear(schoolYear);
  if (!year) return [];
  return (klass.councilEvidenceSnapshots ?? [])
    .filter(s => s.sessionId === sessionId && normalizeSchoolYear(s.schoolYear) === year)
    .slice()
    .sort((a, b) => a.revision - b.revision)
    .map(s => ({ ...s, aggregates: { ...s.aggregates } }));
}

/**
 * Pure preview; does not store a snapshot, does not attest teacher confirmation.
 * The caller supplies a clock snapshot. P3 must take this from a real Date at commit.
 */
export async function prepareCouncilSnapshot(
  data: AppData,
  context: CouncilSnapshotContextV1,
  settings: AppSettings,
  clock: CouncilCaptureClockV1
): Promise<CouncilSnapshotPreviewV1> {
  const year = normalizeSchoolYear(context.schoolYear);
  if (!year) throw new Error('Anno scolastico non valido.');
  const klass = findClass(data, context.classId);
  if (!(await validateCouncilSnapshots(klass))) {
    throw new Error('Le fotografie precedenti non sono coerenti.');
  }
  const session = findSession(klass, year, context.sessionId);
  validateTemporal(year, session.date, context.cutoff, clock);
  const overview = buildCouncilEvidenceOverview(klass, year, context.cutoff, settings, 'ingresso');
  if (!overview || overview.effectiveCutoff !== context.cutoff
    || overview.cutoffClampedToSchoolYear) {
    throw new Error('Quadro corrente non disponibile o dati incoerenti.');
  }
  const previous = readCouncilSnapshots(klass, year, session.id).at(-1);
  const fingerprints = await sourceFingerprints(klass, year, context.cutoff);
  return {
    schemaVersion: 1,
    classId: klass.id, schoolYear: year, sessionId: session.id,
    sessionDate: session.date, sessionKind: session.kind,
    revision: previous ? previous.revision + 1 : 1,
    ...(previous ? { supersedesSnapshotId: previous.id } : {}),
    capturedAt: clock.capturedAt,
    captureLocalDate: clock.captureLocalDate,
    captureUtcOffsetMinutes: clock.captureUtcOffsetMinutes,
    requestedCutoff: context.cutoff,
    effectiveCutoff: overview.effectiveCutoff,
    cutoffClampedToSchoolYear: overview.cutoffClampedToSchoolYear,
    calculationContract: SNAPSHOT_CONTRACT,
    aggregates: {
      totalStudents: overview.totalStudents,
      withNumericEvidence: overview.withNumericEvidence,
      withoutNumericEvidence: overview.withoutNumericEvidence,
      numericEvidenceCount: overview.numericEvidenceCount,
      withSavedTeacherProposal: overview.withSavedTeacherProposal,
      withoutSavedTeacherProposal: overview.withoutSavedTeacherProposal
    },
    ...fingerprints
  };
}

/**
 * Pure immutable AppData transform. No encrypted Vault write is performed here.
 * P3 must enqueue it against committed refs, persist atomically, then publish React.
 */
export async function appendConfirmedCouncilSnapshot(
  data: AppData,
  reviewed: CouncilSnapshotPreviewV1,
  settings: AppSettings,
  id: string,
  clock: CouncilCaptureClockV1
): Promise<AppData> {
  if (!SNAPSHOT_ID.test(id) || !isCaptureClockValid(clock)) {
    throw new Error('Identificatore o istante di conferma non valido.');
  }
  const klass = findClass(data, reviewed.classId);
  if (!(await validateCouncilSnapshots(klass))) throw new Error('Archivio fotografico incoerente.');
  const existing = (klass.councilEvidenceSnapshots ?? []).find(s => s.id === id);
  if (existing) {
    // A retry of exactly the same explicit command is idempotent. No new revision.
    const candidate: Omit<CouncilEvidenceSnapshotV1, 'contentDigest'> = {
      ...reviewed,
      capturedAt: clock.capturedAt,
      captureLocalDate: clock.captureLocalDate,
      captureUtcOffsetMinutes: clock.captureUtcOffsetMinutes,
      id, confirmedByTeacher: true
    };
    if (existing.contentDigest === await hashSnapshot(candidate)) return data;
    throw new Error('ID della fotografia già utilizzato con contenuto diverso.');
  }
  if (clock.captureLocalDate !== reviewed.captureLocalDate
    || clock.captureUtcOffsetMinutes !== reviewed.captureUtcOffsetMinutes) {
    throw new Error('Contesto temporale cambiato: riesamina la fotografia.');
  }
  const context = {
    classId: reviewed.classId, schoolYear: reviewed.schoolYear,
    sessionId: reviewed.sessionId, cutoff: reviewed.requestedCutoff
  };
  const fresh = await prepareCouncilSnapshot(data, context, settings, clock);
  const stableFields: (keyof CouncilSnapshotPreviewV1)[] = [
    'schemaVersion', 'classId', 'schoolYear', 'sessionId', 'sessionDate',
    'sessionKind', 'revision', 'supersedesSnapshotId', 'captureLocalDate',
    'captureUtcOffsetMinutes', 'requestedCutoff', 'effectiveCutoff',
    'cutoffClampedToSchoolYear', 'calculationContract', 'rosterFingerprint',
    'sourceFingerprint'
  ];
  if (stableFields.some(key => fresh[key] !== reviewed[key])
    || COUNTS.some(key => fresh.aggregates[key] !== reviewed.aggregates[key])) {
    throw new Error('I dati di origine o la seduta sono cambiati: riesamina la fotografia.');
  }
  const unsigned: Omit<CouncilEvidenceSnapshotV1, 'contentDigest'> = {
    ...fresh, id, confirmedByTeacher: true
  };
  const entry: CouncilEvidenceSnapshotV1 = {
    ...unsigned, contentDigest: await hashSnapshot(unsigned)
  };
  return {
    ...data,
    classes: data.classes.map(item => item.id !== klass.id ? item : {
      ...item,
      councilEvidenceSnapshots: [...(item.councilEvidenceSnapshots ?? []), entry]
    })
  };
}
