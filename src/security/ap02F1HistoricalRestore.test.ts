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
  test('Q5-APP-01 rejects a current-authorized V7 that would orphan history after persistence', async () => {
    const current = historicalSnapshot();
    const scopes = checkHistory(current);
    const target = await createAssessmentBackupPayloadV7(current, scopes, targetAt);
    const recovery = await createAssessmentBackupPayloadV7(current, scopes, recoveryAt);
    const orphaning = {
      ...target,
      snapshot: { ...target.snapshot, settings: { ...target.snapshot.settings, year: '2027/2028' } }
    };
    expect(validateAssessmentArchiveV1(orphaning.snapshot.appData, scopes).valid).toBe(true);
    const vault = new SyntheticAtomicVault(current);
    const restore = async () => {
      const proposal = await projectAssessmentRestoreV7(
        current, orphaning, recovery, scopes, scopes, { requireCandidateScopeContinuity: true }
      );
      await storage(vault).restoreSnapshotVerified(proposal, current);
    };
    await expect(restore()).rejects.toThrow();
    expect(vault.writes).toBe(0);
    expect(await storage(vault).loadExactBackupSnapshot()).toEqual(current);
  });

  test('Q5-APP-01 preserves V7 consultation and export after restoration with an adopted historical program', async () => {
    const current = historicalSnapshot();
    const secondClass = { id: 'other-class', name: 'Seconda classe sintetica', students: [], grades: [], behaviors: [] };
    current.appData.classes.push(secondClass);
    const scopes = resolveApprovedAssessmentScopes(current.appData, current.planning, current.settings);
    const target = await createAssessmentBackupPayloadV7(current, scopes, targetAt);
    const recovery = await createAssessmentBackupPayloadV7(current, scopes, recoveryAt);
    const vault = new SyntheticAtomicVault(current);
    const year = '2027-2028';
    const profile = { id: 'profile-history', schoolYear: '2026/27', subjectCode: scope.subjectCode };
    const master = { id: 'master-history', profileId: profile.id, status: 'approved', currentVersionId: 'version-history' };
    const adoption = { id: 'adoption-history', classId: scope.classId, masterProgramId: master.id, adoptedVersionId: 'version-history' };
    const planning = {
      ...target.snapshot.planning, profiles: [profile], masterPrograms: [master], classInstances: [adoption]
    };
    const restore = async (candidatePlanning: unknown) => {
      const incoming = {
        ...target, snapshot: {
          ...target.snapshot, settings: { ...target.snapshot.settings, year }, planning: candidatePlanning
        }
      };
      const projected = await projectAssessmentRestoreV7(
        current, incoming, recovery, scopes, scopes, { requireCandidateScopeContinuity: true }
      );
      return storage(vault).restoreSnapshotVerified(projected, current);
    };
    for (const invalid of [
      { ...planning, profiles: [{ ...profile, subjectCode: 'MATH' }] },
      { ...planning, masterPrograms: [{ ...master, status: 'draft' }] },
      { ...planning, classInstances: [{ ...adoption, adoptedVersionId: 'wrong-version' }] },
      { ...planning, classInstances: [{ ...adoption, classId: secondClass.id }] },
      { ...planning, classInstances: [] },
    ]) {
      await expect(restore(invalid)).rejects.toThrow();
      expect(vault.writes).toBe(0);
    }
    expect(await storage(vault).loadExactBackupSnapshot()).toEqual(current);
    const restored = await restore(planning);
    const approved = resolveApprovedAssessmentScopes(restored.appData, restored.planning, restored.settings);
    expect(vault.writes).toBe(1);
    expect(approved).toContainEqual(scope);
    expect(approved).toContainEqual({ ...scope, classId: secondClass.id, schoolYear: '2027/2028' });
    expect(evidenceGraph(restored)).toEqual(evidenceGraph(current));
    expect(validateAssessmentArchiveV1(restored.appData, approved)).toEqual({ valid: true, state: 'present' });
    const exported = await createAssessmentBackupPayloadV7(restored, approved, targetAt);
    expect(evidenceGraph(exported.snapshot)).toEqual(evidenceGraph(current));
  });

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
      exact!, target.decoded, recovery.decoded, scopes, incomingScopes, { requireCandidateScopeContinuity: true }
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
    // Both revisions of one event must retain one grade identity. Changing
    // only one link is rejected by the codec itself; changing both leaves a
    // structurally valid but historically rewritten document, which the
    // conservative restoration policy must independently refuse.
    relinked.appData.classes[0].assessmentEvidenceV1.documents[0].bindings[2].link.individual.gradeId = 'grade-f1-forged';
    expect(validateAssessmentArchiveV1(relinked.appData, scopes).valid).toBe(true);
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
