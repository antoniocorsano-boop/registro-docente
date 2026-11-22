/**
 * AUDIT-PRE-01 / AP-02 F1: complete synthetic historical V7 restoration.
 *
 * Unlike empty-archive smoke tests, this journey carries teacher-confirmed
 * assessment/rubric/evidence revision chains and frozen grade bindings through
 * the actual password-encrypted v7 codec, verified recovery copy and the
 * production SecureAppStorage atomic-write/readback boundary. No real students,
 * backend, Android package, production Vault or publication.
 */
import { describe, expect, test } from 'bun:test';
import { boardDocument, boardScope } from '../../tests/browser/fixtures/val01-s6c-data';
import { createInitialArchiveSnapshot } from './initialArchiveSetup';
import { createAssessmentBackupPayloadV7 } from './assessmentBackupPayload';
import { projectAssessmentRestoreV7, selectApprovedScopesForIncomingV7Backup } from './assessmentRestorePolicy';
import { resolveApprovedAssessmentScopes } from '../assessment/approvedAssessmentScopes';
import { validateAssessmentArchiveV1 } from '../assessment/assessmentArchive';
import { validateAssessmentEvidenceV1 } from '../assessment/assessmentEvidence';
import { createVersionedBackupReceiptAuthority } from '../persistence/versionedBackupReceipt';
import { decryptDataWithPassword, encryptDataWithPassword } from '../cryptoUtils';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from './secureAppStorage';
import type { SecureVault } from './secureVault';

const password = 'ap02-f1-synthetic-only';
const targetAt = '2026-11-22T11:00:00.000Z';
const recoveryAt = '2026-11-22T11:05:00.000Z';
const scope = { classId: boardScope.classId, schoolYear: boardScope.schoolYear, subjectCode: boardScope.subjectCode };
const proof = { batchId: 'ap02-f1-batch', date: '2026-11-19', period: 'Q1', type: 'disegno', title: 'Filiera sintetica' };

function historicalSnapshot(): CompleteSecureAppSnapshot {
  // The existing qualified fixture already contains a planned/completed
  // assessment chain, two frozen rubric revisions and four observed/not-
  // observed/applicability records; add a corrected student observation.
  const s = createInitialArchiveSnapshot({
    mode: 'professional',
    profile: { school: 'Istituto sintetico F1', teacher: 'Docente fittizio', year: '2026/2027', subject: 'TECH' }
  });
  const d: any = structuredClone(boardDocument);
  const first: any = d.evidence.find((e: any) => e.revisionId === 'r-1');
  if (!first || first.state !== 'observed') throw Error('F1 fixture missing original observation');
  d.evidence.push({
    ...first,
    revisionId: 'r-1-v2',
    supersedesRevisionId: 'r-1',
    confirmedAt: '2026-11-21T10:00:00.000Z',
    recordedAt: '2026-11-21T09:59:00.000Z',
    fact: { ...first.fact, description: 'Rappresentazione sintetica corretta' }
  });
  const link = { ...scope, proof: { ...proof }, confirmedByTeacher: true };
  const document = {
    document: d,
    bindings: [
      { kind: 'assessment', assessmentRevisionId: 'a2', link: structuredClone(link) },
      { kind: 'evidence', evidenceRevisionId: 'r-1', link: { ...structuredClone(link), individual: { studentId: 's1', gradeId: 'grade-f1' } } },
      { kind: 'evidence', evidenceRevisionId: 'r-1-v2', link: { ...structuredClone(link), individual: { studentId: 's1', gradeId: 'grade-f1' } } }
    ]
  };
  const cls: any = {
    id: boardScope.classId,
    name: 'Classe fittizia F1',
    students: boardScope.studentIds.map((id, i) => ({ id, name: 'Studente fittizio ' + (i + 1) })),
    grades: [{ id: 'grade-f1', studentId: 's1', ...proof, value: '8' }],
    behaviors: [{ id: 'behavior-f1', studentId: 's1', date: '2026-11-20', value: 'osservazione-sintetica' }],
    assessmentEvidenceV1: { version: 1, documents: [document] }
  };
  s.appData = { classes: [cls], currentClassId: cls.id };
  s.meta = { changes: 3, lastBackup: null };
  return s;
}
function withNewRevision(old: CompleteSecureAppSnapshot): CompleteSecureAppSnapshot {
  const s: any = structuredClone(old);
  const d = s.appData.classes[0].assessmentEvidenceV1.documents[0].document;
  const previous = d.evidence.find((x: any) => x.revisionId === 'r-1-v2');
  if (!previous) throw Error('F1 fixture missing second revision');
  d.evidence.push({
    ...structuredClone(previous),
    revisionId: 'r-1-v3',
    supersedesRevisionId: 'r-1-v2',
    confirmedAt: '2026-11-22T10:00:00.000Z',
    recordedAt: '2026-11-22T09:59:00.000Z',
    fact: { ...previous.fact, description: 'Ulteriore precisazione sintetica' }
  });
  s.appData.classes[0].grades.push({ id: 'grade-f1-new', studentId: 's2', ...proof, value: '7' });
  s.meta = { changes: 4, lastBackup: null };
  return s;
}
const evidenceGraph = (s: CompleteSecureAppSnapshot): any =>
  (s.appData.classes[0] as any).assessmentEvidenceV1.documents[0];
const checkHistory = (s: CompleteSecureAppSnapshot) => {
  const approved = resolveApprovedAssessmentScopes(s.appData, s.planning, s.settings);
  expect(approved).toEqual([scope]); // derived solely from current teacher configuration
  expect(validateAssessmentArchiveV1(s.appData, approved)).toEqual({ valid: true, state: 'present' });
  expect(validateAssessmentEvidenceV1(evidenceGraph(s).document, boardScope).valid).toBe(true);
  expect(evidenceGraph(s).document.assessments.map((x: any) => x.revisionId)).toEqual(['a1', 'a2']);
  expect(evidenceGraph(s).document.rubrics.map((x: any) => x.revisionId)).toEqual(['rubric-v1', 'rubric-v2']);
  expect(evidenceGraph(s).document.evidence.filter((x: any) => x.evidenceId === 'e-1').length).toBeGreaterThanOrEqual(2);
  expect(evidenceGraph(s).bindings).toHaveLength(3);
  expect(s.appData.classes[0].grades.length).toBeGreaterThan(0);
  expect(s.appData.classes[0].behaviors.length).toBeGreaterThan(0);
  return approved;
};

class SyntheticAtomicVault {
  private values = new Map<string, unknown>();
  writes = 0;
  corruptReadbackOnce = false;
  private hasWritten = false;
  constructor(snapshot: CompleteSecureAppSnapshot) {
    for (const [key, value] of Object.entries(snapshot)) this.values.set(key, structuredClone(value));
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.values.get(key);
    if (raw === undefined) return null;
    const copy: any = structuredClone(raw);
    if (key === 'appData' && this.hasWritten && this.corruptReadbackOnce) {
      this.corruptReadbackOnce = false;
      copy.classes[0].name = 'ERRORE DI RILETTURA SINTETICO';
    }
    return copy as T;
  }
  async putMany(entries: readonly { key: string; value: unknown }[]): Promise<void> {
    const next = new Map(this.values);
    for (const entry of entries) next.set(entry.key, structuredClone(entry.value));
    this.values = next; // one physical-transaction simulation, never partial writes
    this.writes++;
    this.hasWritten = true;
  }
}
const storage = (vault: SyntheticAtomicVault) => new SecureAppStorage(vault as unknown as SecureVault);
const verifiedEncryptedCopy = async (s: CompleteSecureAppSnapshot, at: string) => {
  const approved = checkHistory(s);
  const authority = createVersionedBackupReceiptAuthority(7);
  const prepared = await authority.prepare(s, approved, password, at);
  const ciphertext = prepared.encryptedText;
  expect(ciphertext).not.toContain('Studente fittizio');
  expect(JSON.parse(ciphertext).version).toBe(2);
  expect(await authority.verifyWeb(prepared.receipt, new Blob([ciphertext]), () => true)).toBe('verified');
  const verifiedMeta = authority.consume(s.meta, prepared.receipt, 7);
  expect(verifiedMeta.verifiedBackupEvidence?.payloadVersion).toBe(7);
  const decoded = await decryptDataWithPassword(ciphertext, password);
  expect(decoded.backupDataVersion).toBe(7);
  expect(decoded.snapshot.appData).toEqual(s.appData);
  return { decoded, verifiedMeta, ciphertext };
};

describe('AUDIT-PRE-01/AP-02 F1 — complete synthetic historical V7 restore', () => {
  test('encrypted V7 export, independently approved scopes, exact recovery and atomic readback retain every frozen revision', async () => {
    const current = historicalSnapshot();
    const future = withNewRevision(current);
    const scopes = checkHistory(current);
    checkHistory(future);
    const before = structuredClone(current);
    const target = await verifiedEncryptedCopy(future, targetAt);
    const recovery = await verifiedEncryptedCopy(current, recoveryAt);
    const committed = { ...current, meta: recovery.verifiedMeta };
    const frozenBefore = structuredClone(committed);
    const vault = new SyntheticAtomicVault(committed);
    const exact = await storage(vault).loadExactBackupSnapshot();
    expect(exact).toEqual(committed);
    const incomingScopes = selectApprovedScopesForIncomingV7Backup(target.decoded, scopes);
    expect(incomingScopes).toEqual(scopes);
    const proposal = await projectAssessmentRestoreV7(
      exact!, target.decoded, recovery.decoded, scopes, incomingScopes
    );
    const persisted = await storage(vault).restoreSnapshotVerified(proposal, exact!);
    const readback = await storage(vault).loadExactBackupSnapshot();
    expect(vault.writes).toBe(1);
    expect(readback).toEqual(persisted);
    expect(readback?.appData).toEqual(future.appData);
    expect(evidenceGraph(readback!).document.evidence.map((e: any) => e.revisionId))
      .toEqual([...evidenceGraph(before).document.evidence.map((e: any) => e.revisionId), 'r-1-v3']);
    expect(evidenceGraph(readback!).bindings).toEqual(evidenceGraph(before).bindings);
    expect(readback?.appData.classes[0].grades).toEqual(future.appData.classes[0].grades);
    expect(readback?.appData.classes[0].behaviors).toEqual(future.appData.classes[0].behaviors);
    expect(readback?.meta.verifiedBackupEvidence).toBeUndefined(); // local receipt never travels
    expect(current).toEqual(before);
    expect(committed).toEqual(frozenBefore);
  });

  test('a valid but older, rewritten or relinked historical candidate fails before any storage write', async () => {
    const current = withNewRevision(historicalSnapshot());
    const scopes = checkHistory(current);
    const recovery = await verifiedEncryptedCopy(current, recoveryAt);
    const committed = { ...current, meta: recovery.verifiedMeta };
    const vault = new SyntheticAtomicVault(committed);
    const before = await storage(vault).loadExactBackupSnapshot();
    const old = historicalSnapshot(); // valid archive, but loses revision r-1-v3
    const rewritten: any = structuredClone(current);
    rewritten.appData.classes[0].assessmentEvidenceV1.documents[0].document.evidence[0].fact.description = 'Fatto storico riscritto';
    const relinked: any = structuredClone(current);
    relinked.appData.classes[0].assessmentEvidenceV1.documents[0].bindings[1].link.individual.gradeId = 'grade-f1-forged';
    const tamperedRecovery: any = structuredClone(recovery.decoded);
    tamperedRecovery.snapshot.appData.classes[0].name = 'Copia non corrente';

    const candidates = [
      await createAssessmentBackupPayloadV7(old, scopes, targetAt),
      await createAssessmentBackupPayloadV7(rewritten, scopes, targetAt),
      await createAssessmentBackupPayloadV7(relinked, scopes, targetAt)
    ];
    for (const candidate of candidates) {
      await expect(projectAssessmentRestoreV7(committed, candidate, recovery.decoded, scopes, scopes))
        .rejects.toThrow();
    }
    const currentTarget = await createAssessmentBackupPayloadV7(current, scopes, targetAt);
    await expect(projectAssessmentRestoreV7(committed, currentTarget, tamperedRecovery, scopes, scopes))
      .rejects.toThrow();
    await expect(projectAssessmentRestoreV7(committed, currentTarget, null, scopes, scopes))
      .rejects.toThrow();
    expect(vault.writes).toBe(0);
    expect(await storage(vault).loadExactBackupSnapshot()).toEqual(before);
  });

  test('a failed verification readback rolls back the complete previous historical snapshot', async () => {
    const previous = historicalSnapshot();
    const next = withNewRevision(previous);
    const scopes = checkHistory(previous);
    const candidate = await createAssessmentBackupPayloadV7(next, scopes, targetAt);
    const recovery = await createAssessmentBackupPayloadV7(previous, scopes, recoveryAt);
    const proposal = await projectAssessmentRestoreV7(previous, candidate, recovery, scopes, scopes);
    const vault = new SyntheticAtomicVault(previous);
    vault.corruptReadbackOnce = true;
    await expect(storage(vault).restoreSnapshotVerified(proposal, previous))
      .rejects.toThrow(/rollback|ripristinato/i);
    expect(vault.writes).toBe(2);
    expect(await storage(vault).loadExactBackupSnapshot()).toEqual(previous);
    expect(evidenceGraph((await storage(vault).loadExactBackupSnapshot())!).bindings)
      .toEqual(evidenceGraph(previous).bindings);
  });
});
