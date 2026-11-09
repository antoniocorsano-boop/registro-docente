import { describe, expect, test } from 'bun:test';
import type { AppData, AppSettings, ClassData } from '../types';
import {
  appendCouncilSession, assignCouncilValues, isCouncilAppDataValid,
  isCouncilSessionDateValid, readCouncilSessions, readCouncilValues,
  wouldLoseCouncilEntries
} from '../council/councilModel';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

const at = '2026-11-09T13:00:00.000Z';
const settings: AppSettings = {
  school: 'Scuola sintetica', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan'
};
function source(): AppData {
  const c: ClassData = {
    id: 'C', name: '2C sintetica',
    students: [{ id: 'A', name: 'Allievo sintetico' }],
    grades: [{ id: 'G', studentId: 'A', date: '2026-10-15', type: 'test', period: 'Q1', title: 'Verifica sintetica', value: '8' }],
    behaviors: []
  };
  return { classes: [c], currentClassId: null };
}
function snapshot(appData: AppData): CompleteSecureAppSnapshot {
  return {
    appData, settings, udas: [], customTests: {}, submissions: [],
    planning: { schemaVersion: 2, profiles: [], arenaContexts: [], resources: [], masterPrograms: [], classInstances: [], docenteOsProjections: [] },
    library: { schemaVersion: 1, sources: [] },
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: 0, lastBackup: null }
  };
}

describe('CDC-02/S1 — durable archive of council sessions', () => {
  test('two sessions with the same kind remain independent; ordering and other classes unchanged', () => {
    const initial = source();
    initial.classes.push({ id: 'D', name: '2D sintetica', students: [], grades: [], behaviors: [] });
    const first = appendCouncilSession(initial, 'C', '2026/27', 'monitoraggio', '2026-11-09', 'session-1', at);
    const second = appendCouncilSession(first, 'C', '2026/2027', 'monitoraggio', '2026-11-16', 'session-2', at);
    expect(readCouncilSessions(second.classes[0], '2026-27').map(x => x.id)).toEqual(['session-2', 'session-1']);
    expect(second.classes[0].grades).toEqual(initial.classes[0].grades);
    expect(second.classes[1]).toEqual(initial.classes[1]);
    expect(readCouncilSessions(second.classes[0], '2025/26')).toEqual([]);
    expect(isCouncilAppDataValid(second)).toBe(true);
    expect(wouldLoseCouncilEntries(second, first)).toBe(true);
    expect(wouldLoseCouncilEntries(second, structuredClone(second))).toBe(false);
  });

  test('independent council proposals survive creation and restore; legacy payloads still import', () => {
    const base = snapshot(source());
    const legacy = { app: 'registro-docente', classes: base.appData.classes, settings, version: 2 };
    const imported = normalizeBackupPayload(legacy, base);
    const evaluated = assignCouncilValues(imported.appData, 'C', '2026/27', 'ingresso', { A: '7' }, at);
    const withSession = appendCouncilSession(evaluated, 'C', '2026/27', 'ingresso', '2026-11-09', 'session-3', at);
    const exportPayload = createBackupPayload({ ...imported, appData: withSession }, at);
    expect(exportPayload.backupDataVersion).toBe(6);
    const restored = normalizeBackupPayload(JSON.parse(JSON.stringify(exportPayload)), base);
    expect(restored.appData).toEqual(withSession);
    expect(readCouncilValues(restored.appData.classes[0], '2026/2027')).toEqual({ A: '7' });
    expect(readCouncilSessions(restored.appData.classes[0], '2026/27')).toHaveLength(1);
    expect(wouldLoseCouncilEntries(withSession, evaluated)).toBe(true);
  });

  test('rejects invalid days, dates outside school year, missing class, duplicated sessions', () => {
    expect(isCouncilSessionDateValid('2027-02-29', '2026/27')).toBe(false);
    expect(isCouncilSessionDateValid('2027-08-31', '2026/27')).toBe(true);
    expect(isCouncilSessionDateValid('2027-09-01', '2026/27')).toBe(false);
    expect(() => appendCouncilSession(source(), 'wrong', '2026/27', 'ingresso', '2026-11-09', 's1', at)).toThrow();
    expect(() => appendCouncilSession(source(), 'C', '2026/28', 'ingresso', '2026-11-09', 's1', at)).toThrow();
    expect(() => appendCouncilSession(source(), 'C', '2026/27', 'ingresso', '2027-09-09', 's1', at)).toThrow();
    const valid = appendCouncilSession(source(), 'C', '2026/27', 'ingresso', '2026-11-09', 's1', at);
    expect(() => appendCouncilSession(valid, 'C', '2026/27', 'ingresso', '2026-11-09', 's1', at)).toThrow();
    const duplicated = structuredClone(valid);
    duplicated.classes[0].councilSessions!.push({ ...duplicated.classes[0].councilSessions![0] });
    expect(isCouncilAppDataValid(duplicated)).toBe(false);
    expect(() => normalizeBackupPayload(createBackupPayload(snapshot(duplicated)), snapshot(source()))).toThrow();
  });

  test('a previous session is never considered preserved if its identity, date or kind changed', () => {
    const valid = appendCouncilSession(source(), 'C', '2026/27', 'monitoraggio', '2026-11-09', 's1', at);
    const renamedYear = structuredClone(valid);
    renamedYear.classes[0].councilSessions![0].schoolYear = '2026/2027';
    expect(wouldLoseCouncilEntries(valid, renamedYear)).toBe(false);
    const altered = structuredClone(valid);
    altered.classes[0].councilSessions![0].date = '2026-11-10';
    expect(wouldLoseCouncilEntries(valid, altered)).toBe(true);
    const empty = structuredClone(valid);
    delete empty.classes[0].councilSessions;
    expect(isCouncilAppDataValid(empty)).toBe(true);
    expect(wouldLoseCouncilEntries(valid, empty)).toBe(true);
  });
});
