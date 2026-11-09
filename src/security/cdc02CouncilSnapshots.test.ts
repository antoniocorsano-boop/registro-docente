// CDC-02/S2b-P1 RED: import dell'API ancora assente intenzionalmente.
// Il primo gate deve fallire per modulo non presente; solo il modello successivo lo risolve.
import { describe, expect, test } from 'bun:test';
import type { AppData, AppSettings, ClassData } from '../types';
import {
  appendConfirmedCouncilSnapshot,
  createCaptureClock,
  prepareCouncilSnapshot,
  readCouncilSnapshots,
  validateCouncilSnapshots,
  type CouncilCaptureClockV1
} from '../council/councilEvidenceSnapshots';

const settings: AppSettings = {
  school: 'Istituto sintetico', year: '2026/27', teacher: 'Docente',
  subject: 'Tecnologia', theme: 'cyan'
};
const clock: CouncilCaptureClockV1 = {
  capturedAt: '2026-11-10T09:00:00.000Z',
  captureLocalDate: '2026-11-10', captureUtcOffsetMinutes: 0
};
const rome: CouncilCaptureClockV1 = {
  capturedAt: '2026-11-09T23:30:00.000Z',
  captureLocalDate: '2026-11-10', captureUtcOffsetMinutes: -60
};
const context = {
  classId: 'C', schoolYear: '2026/27', sessionId: 'S1', cutoff: '2026-11-09'
};

function fixture(): AppData {
  const klass: ClassData = {
    id: 'C', name: '2C sintetica',
    students: [
      { id: 'A', name: 'Alfa sintetico' },
      { id: 'B', name: 'Beta sintetico' }
    ],
    grades: [
      { id: 'g1', studentId: 'A', date: '2026-10-10', type: 'test',
        period: 'Q1', title: 'Prova', value: '8' },
      { id: 'g2', studentId: 'B', date: '2026-10-15', type: 'orale',
        period: 'Q1', title: 'Non classificato', value: 'NC' },
      { id: 'g3', studentId: 'B', date: '2026-11-20', type: 'test',
        period: 'Q1', title: 'Futuro', value: '9' }
    ],
    behaviors: [],
    councilAssessments: [
      { studentId: 'A', schoolYear: '2026/2027', moment: 'ingresso',
        value: '7', updatedAt: '2026-11-09T12:00:00Z' }
    ],
    councilSessions: [
      { id: 'S1', schoolYear: '2026/2027', kind: 'monitoraggio', date: '2026-11-10',
        createdAt: '2026-11-09T09:00:00Z', updatedAt: '2026-11-09T09:00:00Z' },
      { id: 'S2', schoolYear: '2026/2027', kind: 'monitoraggio', date: '2026-11-10',
        createdAt: '2026-11-09T10:00:00Z', updatedAt: '2026-11-09T10:00:00Z' }
    ]
  };
  return { classes: [klass], currentClassId: 'C' };
}

describe('CDC-02/S2b P1 — contratto puro (solo dati sintetici)', () => {
  test('preview senza mutazione e senza voto implicito: sei aggregati S2a', async () => {
    const data = fixture();
    const original = structuredClone(data);
    const preview = await prepareCouncilSnapshot(data, context, settings, clock);
    expect(data).toEqual(original);
    expect(preview.aggregates).toEqual({
      totalStudents: 2, withNumericEvidence: 1, withoutNumericEvidence: 1,
      numericEvidenceCount: 1, withSavedTeacherProposal: 1, withoutSavedTeacherProposal: 1
    });
    expect(preview.sessionId).toBe('S1');
    expect(preview.schoolYear).toBe('2026/2027');
    expect(preview.revision).toBe(1);
    expect(preview.captureLocalDate).toBe('2026-11-10');
    expect('confirmedByTeacher' in preview).toBe(false);
    expect('contentDigest' in preview).toBe(false);
  });

  test('conferma esplicita accoda una versione immutabile, senza modificare prove e voti', async () => {
    const data = fixture();
    const old = structuredClone(data);
    const preview = await prepareCouncilSnapshot(data, context, settings, clock);
    const saved = await appendConfirmedCouncilSnapshot(data, preview, settings, 'shot-1', clock);
    expect(data).toEqual(old);
    expect(saved.classes[0].grades).toEqual(old.classes[0].grades);
    expect(saved.classes[0].councilAssessments).toEqual(old.classes[0].councilAssessments);
    const snapshots = readCouncilSnapshots(saved.classes[0], '2026/27', 'S1');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].confirmedByTeacher).toBe(true);
    expect(snapshots[0].contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(await validateCouncilSnapshots(saved.classes[0])).toBe(true);
    const retry = await appendConfirmedCouncilSnapshot(saved, preview, settings, 'shot-1', clock);
    expect(retry).toEqual(saved); // Idempotenza per medesima azione e digest.
  });

  test('revisioni esplicite conservano la prima fotografia quando la fonte cambia', async () => {
    const data = fixture();
    const firstPreview = await prepareCouncilSnapshot(data, context, settings, clock);
    const first = await appendConfirmedCouncilSnapshot(data, firstPreview, settings, 'shot-1', clock);
    const changed = structuredClone(first);
    changed.classes[0].grades.push({
      id: 'g4', studentId: 'B', date: '2026-11-09', type: 'test',
      period: 'Q1', title: 'Nuova', value: '6'
    });
    const nextPreview = await prepareCouncilSnapshot(changed, context, settings, clock);
    expect(nextPreview.revision).toBe(2);
    expect(nextPreview.supersedesSnapshotId).toBe('shot-1');
    const second = await appendConfirmedCouncilSnapshot(changed, nextPreview, settings, 'shot-2', clock);
    const snapshots = readCouncilSnapshots(second.classes[0], '2026/27', 'S1');
    expect(snapshots.map(s => s.revision)).toEqual([1, 2]);
    expect(snapshots[0].aggregates.numericEvidenceCount).toBe(1);
    expect(snapshots[1].aggregates.numericEvidenceCount).toBe(2);
    expect(snapshots[0]).toEqual(first.classes[0].councilEvidenceSnapshots![0]);
    expect(await validateCouncilSnapshots(second.classes[0])).toBe(true);
  });

  test('due sedute stesso tipo/data hanno storico distinto per ID', async () => {
    const data = fixture();
    const p1 = await prepareCouncilSnapshot(data, context, settings, clock);
    const one = await appendConfirmedCouncilSnapshot(data, p1, settings, 'shot-1', clock);
    const p2 = await prepareCouncilSnapshot(one, { ...context, sessionId: 'S2' }, settings, clock);
    const two = await appendConfirmedCouncilSnapshot(one, p2, settings, 'shot-2', clock);
    expect(readCouncilSnapshots(two.classes[0], '2026/27', 'S1')).toHaveLength(1);
    expect(readCouncilSnapshots(two.classes[0], '2026/27', 'S2')).toHaveLength(1);
  });

  test('fonte cambiata dopo anteprima: nessuna scrittura, richiedere riesame', async () => {
    const data = fixture();
    const preview = await prepareCouncilSnapshot(data, context, settings, clock);
    data.classes[0].grades[0].value = '9';
    await expect(appendConfirmedCouncilSnapshot(data, preview, settings, 'shot-1', clock))
      .rejects.toThrow(/cambiat|riesamin|origine/i);
    expect(data.classes[0].councilEvidenceSnapshots).toBeUndefined();
  });

  test('limiti temporali, classe/anno e seduta assente: fallimento chiuso', async () => {
    const data = fixture();
    await expect(prepareCouncilSnapshot(data, { ...context, cutoff: '2026-11-11' }, settings, clock))
      .rejects.toThrow();
    await expect(prepareCouncilSnapshot(data, { ...context, cutoff: '2026-08-31' }, settings, clock))
      .rejects.toThrow();
    await expect(prepareCouncilSnapshot(data, { ...context, cutoff: '2026-02-29' }, settings, clock))
      .rejects.toThrow();
    await expect(prepareCouncilSnapshot(data, { ...context, sessionId: 'missing' }, settings, clock))
      .rejects.toThrow();
    await expect(prepareCouncilSnapshot(data, { ...context, classId: 'else' }, settings, clock))
      .rejects.toThrow();
  });

  test('data locale Roma 10 novembre resta coerente con UTC 9 novembre vicino a mezzanotte', async () => {
    expect(createCaptureClock(new Date('2026-11-10T09:00:00.000Z')).capturedAt)
      .toBe('2026-11-10T09:00:00.000Z');
    const data = fixture();
    const p = await prepareCouncilSnapshot(data, { ...context, cutoff: '2026-11-10' }, settings, rome);
    const stored = await appendConfirmedCouncilSnapshot(data, p, settings, 'shot-rome', rome);
    expect(stored.classes[0].councilEvidenceSnapshots![0].captureLocalDate).toBe('2026-11-10');
    expect(await validateCouncilSnapshots(stored.classes[0])).toBe(true);
    const bad = structuredClone(stored.classes[0]);
    bad.councilEvidenceSnapshots![0].captureLocalDate = '2026-11-09';
    expect(await validateCouncilSnapshots(bad)).toBe(false);
  });

  test('offset errato o cambiato durante conferma respinge; payload non valido respinge', async () => {
    const data = fixture();
    const p = await prepareCouncilSnapshot(data, context, settings, clock);
    const invalid: CouncilCaptureClockV1 = { ...clock, captureUtcOffsetMinutes: 2000 };
    await expect(prepareCouncilSnapshot(data, context, settings, invalid)).rejects.toThrow();
    const shifted = { ...clock, capturedAt: '2026-11-11T09:00:00.000Z',
      captureLocalDate: '2026-11-11' };
    await expect(appendConfirmedCouncilSnapshot(data, p, settings, 'shot-shift', shifted))
      .rejects.toThrow(/riesamin|cambiat|tempo/i);
    const saved = await appendConfirmedCouncilSnapshot(data, p, settings, 'shot-1', clock);
    const bad = structuredClone(saved.classes[0]);
    bad.councilEvidenceSnapshots![0].aggregates.withNumericEvidence = 100;
    expect(await validateCouncilSnapshots(bad)).toBe(false);
  });
});
