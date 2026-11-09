import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { AppData, AppSettings, ClassData } from '../types';
import { assignCouncilValues, councilRows, isCouncilAppDataValid, normalizeSchoolYear, parseCouncilValue, readCouncilValues, summarizeCouncilValues, wouldLoseCouncilEntries } from '../council/councilModel';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createBackupPayload, normalizeBackupPayload } from './backupPayload';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

const settings: AppSettings = {
  school: 'Istituto di prova', year: '2026/27', teacher: 'Docente', subject: 'Tecnologia', theme: 'cyan'
};
function classFixture(): ClassData {
  return {
    id: 'C', name: '2C',
    students: [{ id: 'a', name: 'Alunno Alfa' }, { id: 'b', name: 'Alunno Beta' }, { id: 'c', name: 'Alunno Gamma' }],
    grades: [
      { id: 'prior', studentId: 'a', type: 'test', date: '2025-11-02', period: 'Q1', title: 'Anno precedente', value: '1' },
      { id: 'g1', studentId: 'a', type: 'test', date: '2026-10-04', period: 'Q1', title: 'Test', value: '8' },
      { id: 'g2', studentId: 'a', type: 'verifica', date: '2026-11-05', period: 'Q1', title: 'Prova', value: '9' },
      { id: 'g3', studentId: 'b', type: 'orale', date: '2026-10-18', period: 'Q1', title: 'Orale', value: 'A' },
      { id: 'g4', studentId: 'b', type: 'test', date: '2026-12-01', period: 'Q1', title: 'Prova futura', value: '10' },
      { id: 'g5', studentId: 'a', type: 'test', date: '2025-11-03', period: 'Q1', title: 'Anno precedente', value: '3' }
    ],
    behaviors: []
  };
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
const now = '2026-11-09T08:15:00.000Z';

describe('CDC-01 — Consigli di classe', () => {
  test('student removal also removes assigned council entries without affecting others', () => {
    const code = readFileSync('src/App.tsx', 'utf8');
    const handler = code.split('const handleRemoveStudent = ')[1]?.split('// Bulk add students')[0] ?? '';
    expect(handler).toContain('councilAssessments:');
    expect(handler).toContain('.filter(entry => entry.studentId !== studentId)');
    expect(handler).toContain('targetClass.grades');
  });

  test('legacy source grades remain unchanged, excluded non-numeric and future grades', () => {
    const c = classFixture();
    const rows = councilRows(c, settings.year, '2026-11-09', settings);
    expect(rows[0].count).toBe(2);
    expect(rows[0].average).toBe(8.5);
    expect(rows[1].count).toBe(0);
    expect(rows[1].average).toBeNull();
    expect(rows[2].average).toBeNull();
    expect(councilRows(c, 'anno non riconosciuto', '2026-11-09', settings)[0].count).toBe(0);
    // A school-year mismatch cannot silently mix evidence from other years.
    expect(councilRows(c, 'anno non riconosciuto', '2026-11-09', settings)[0].count).toBe(0);
  });

  test('historical year cannot include following-year grades beyond August 31', () => {
    const c = classFixture();
    const previousYear = councilRows(c, '2025/26', '2026-11-09', settings);
    expect(previousYear[0].count).toBe(2);
    expect(previousYear[0].average).toBe(2);
    expect(councilRows(c, '2025/2026', '2026-11-09', settings)[0].count).toBe(2);
    expect(councilRows(c, '2025-2026', '2026-11-09', settings)[0].average).toBe(2);
    // A cutoff preceding the selected school year must never borrow other years' evidence.
    expect(councilRows(c, '2025/26', '2025-08-31', settings)[0].count).toBe(0);
  });

  test('equivalent school year labels share one durable council assessment identity', () => {
    expect(normalizeSchoolYear('2026/27')).toBe('2026/2027');
    expect(normalizeSchoolYear('2026/2027')).toBe('2026/2027');
    expect(normalizeSchoolYear('2026-2027')).toBe('2026/2027');
    expect(normalizeSchoolYear('2026/2028')).toBeNull();
    const c = classFixture();
    c.councilAssessments = [
      { studentId: 'a', schoolYear: '2026/27', moment: 'ingresso', value: '7', updatedAt: now },
      { studentId: 'a', schoolYear: '2026/27', moment: 'intermedia', value: '8', updatedAt: now }
    ];
    const source: AppData = { classes: [c], currentClassId: null };
    expect(readCouncilValues(c, '2026/2027')).toEqual({ a: '7' });
    expect(isCouncilAppDataValid(source)).toBe(true);
    const renamed = assignCouncilValues(source, 'C', '2026/2027', 'ingresso', { a: '9' }, now);
    expect(readCouncilValues(renamed.classes[0], '2026/27')).toEqual({ a: '9' });
    expect(renamed.classes[0].councilAssessments).toHaveLength(2);
    expect(renamed.classes[0].councilAssessments?.find(e => e.moment === 'ingresso')?.schoolYear).toBe('2026/2027');
    expect(renamed.classes[0].councilAssessments?.find(e => e.moment === 'intermedia')?.value).toBe('8');
    const labelOnly = structuredClone(source);
    labelOnly.classes[0].councilAssessments![0].schoolYear = '2026/2027';
    expect(wouldLoseCouncilEntries(source, labelOnly)).toBe(false);
    const duplicate = structuredClone(source);
    duplicate.classes[0].councilAssessments!.push({
      studentId: 'a', schoolYear: '2026/2027', moment: 'ingresso', value: '6', updatedAt: now
    });
    expect(isCouncilAppDataValid(duplicate)).toBe(false);
    expect(() => normalizeBackupPayload(createBackupPayload(snapshot(duplicate)), snapshot(source))).toThrow();
    expect(() => assignCouncilValues(source, 'C', '2026/2028', 'ingresso', { a: '7' }, now)).toThrow();
  });

  test('teacher can override average, and score never enters evidence grades', () => {
    const source: AppData = { classes: [classFixture(), classFixture().id === 'C'
      ? { ...classFixture(), id: 'D', name: '2D', students: [{ id: 'd', name: 'Alunno Delta' }], grades: [] } : classFixture()
    ], currentClassId: null };
    const saved = assignCouncilValues(source, 'C', settings.year, 'ingresso', { a: '7,5', b: '6', c: '' }, now);
    expect(saved.classes[0].grades).toEqual(source.classes[0].grades);
    expect(saved.classes[1]).toEqual(source.classes[1]);
    expect(readCouncilValues(saved.classes[0], settings.year)).toEqual({ a: '7.5', b: '6' });
    expect(summarizeCouncilValues(saved.classes[0].students, readCouncilValues(saved.classes[0], settings.year)))
      .toEqual({ counts: { AV: 0, IN: 1, BA: 1, PA: 0 }, assigned: 2, missing: 1, total: 3 });
    const changed = assignCouncilValues(saved, 'C', settings.year, 'ingresso', { a: '8,5', b: '', c: '5.5' }, now);
    expect(readCouncilValues(changed.classes[0], settings.year)).toEqual({ a: '8.5', c: '5.5' });
    expect(changed.classes[0].grades).toEqual(source.classes[0].grades);
  });

  test('historical council moments are preserved during entrance updates', () => {
    const c = classFixture();
    c.councilAssessments = [{ studentId: 'a', schoolYear: '2025/26', moment: 'finale', value: '8', updatedAt: now }];
    const data = assignCouncilValues({ classes: [c], currentClassId: null }, 'C', settings.year, 'ingresso', { a: '6' }, now);
    expect(data.classes[0].councilAssessments).toHaveLength(2);
    expect(data.classes[0].councilAssessments?.[0].schoolYear).toBe('2025/26');
  });

  test('rejects invalid grades, orphan students, duplicated council keys and corrupted v6 payload', () => {
    expect(parseCouncilValue('NC')).toBeNull();
    expect(parseCouncilValue('7+')).toBeNull();
    expect(parseCouncilValue('0')).toBeNull();
    expect(parseCouncilValue('11')).toBeNull();
    const source: AppData = { classes: [classFixture()], currentClassId: null };
    expect(() => assignCouncilValues(source, 'C', settings.year, 'ingresso', { wrong: '7' }, now)).toThrow();
    expect(() => assignCouncilValues(source, 'C', settings.year, 'ingresso', { a: '11' }, now)).toThrow();
    const valid = assignCouncilValues(source, 'C', settings.year, 'ingresso', { a: '7' }, now);
    expect(isCouncilAppDataValid(valid)).toBe(true);
    const duplicate = structuredClone(valid);
    duplicate.classes[0].councilAssessments!.push({ ...duplicate.classes[0].councilAssessments![0] });
    expect(isCouncilAppDataValid(duplicate)).toBe(false);
    expect(() => normalizeBackupPayload(createBackupPayload(snapshot(duplicate)), snapshot(source))).toThrow();
  });

  test('legacy import -> council save -> v6 export and restore retains all grades and council entries', () => {
    const old = classFixture();
    const initial = snapshot({ classes: [], currentClassId: null });
    const legacy = { app: 'registro-docente', classes: [old], settings, version: 2 };
    const imported = normalizeBackupPayload(legacy, initial);
    expect(imported.appData.classes[0].grades).toEqual(old.grades);
    const withCouncil = assignCouncilValues(imported.appData, 'C', settings.year, 'ingresso', { a: '9', b: '5', c: '' }, now);
    const newBackup = createBackupPayload({ ...imported, appData: withCouncil }, now);
    expect(newBackup.backupDataVersion).toBe(6);
    const restored = normalizeBackupPayload(JSON.parse(JSON.stringify(newBackup)), initial);
    expect(restored.appData).toEqual(withCouncil);
    expect(restored.appData.classes[0].grades).toEqual(old.grades);
    expect(wouldLoseCouncilEntries(withCouncil, imported.appData)).toBe(true);
    expect(wouldLoseCouncilEntries(withCouncil, restored.appData)).toBe(false);
  });
});
