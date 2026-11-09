import type { AppData, AppSettings, ClassData, CouncilAssessment, CouncilMoment, Student } from '../types';
import { calcAvg, calcWeightedAvg, getCompetenceLevel, parseGrade, sortStudents } from '../utils';

const MOMENTS: readonly CouncilMoment[] = ['ingresso', 'intermedia', 'finale'];

// These are *teacher-assigned* values, never raw marks. Do not silently coerce A/NC/G or 7+.
export function parseCouncilValue(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^(?:10(?:[.,]0{1,2})?|[1-9](?:[.,][0-9]{1,2})?)$/.test(raw.trim())) return null;
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 1 && value <= 10 ? value : null;
}

export function normalizeCouncilValue(raw: string): string {
  const value = parseCouncilValue(raw);
  if (value === null) throw new Error('Il voto deve essere un numero tra 1 e 10 (al massimo due decimali).');
  return String(value);
}

export function readCouncilValues(
  classData: ClassData,
  schoolYear: string,
  moment: CouncilMoment = 'ingresso'
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of classData.councilAssessments ?? []) {
    if (entry.schoolYear === schoolYear && entry.moment === moment) result[entry.studentId] = entry.value;
  }
  return result;
}

export function councilRows(classData: ClassData, schoolYear: string, cutoff: string, settings: AppSettings) {
  const saved = readCouncilValues(classData, schoolYear);
  // Ingresso refers to the current *school year*, not every historical grade in the archive.
  // An unrecognized year must not silently include grades from previous school years.
  const match = /\\b(20\\d{2})\\s*[/-]\\s*(?:20)?(\\d{2})\\b/.exec(schoolYear);
  const startYear = match && (Number(match[1]) + 1) % 100 === Number(match[2])
    ? Number(match[1]) : null;
  const from = startYear === null ? null : `${startYear}-09-01`;
  return sortStudents(classData.students).map(student => {
    const valid = from === null ? [] : classData.grades.filter(grade =>
      grade.studentId === student.id
      && typeof grade.date === 'string'
      && /^\\d{4}-\\d{2}-\\d{2}$/.test(grade.date)
      && grade.date <= cutoff
      && grade.date >= from
      && typeof grade.value === 'string'
      && parseGrade(grade.value) !== null
    );
    const avg = settings.useWeightedAverage
      ? calcWeightedAvg(valid, settings.evaluationWeights)
      : calcAvg(valid);
    return { student, count: valid.length, average: avg, saved: saved[student.id] ?? '' };
  });
}

export function assignCouncilValues(
  data: AppData,
  classId: string,
  schoolYear: string,
  moment: CouncilMoment,
  values: Record<string, string>,
  now: string
): AppData {
  const selected = data.classes.find(item => item.id === classId);
  if (!selected) throw new Error('Classe non disponibile: salvataggio annullato.');
  const studentIds = new Set(selected.students.map(student => student.id));
  if (Object.keys(values).some(id => !studentIds.has(id))) {
    throw new Error('Elenco degli alunni modificato: ricontrollare la classe prima di salvare.');
  }
  if (!schoolYear.trim() || !MOMENTS.includes(moment) || !Number.isFinite(Date.parse(now))) {
    throw new Error('Contesto del Consiglio non valido.');
  }
  const prior = selected.councilAssessments ?? [];
  const previousByStudent = new Map(prior
    .filter(e => e.schoolYear === schoolYear && e.moment === moment)
    .map(e => [e.studentId, e]));
  const entries: CouncilAssessment[] = selected.students.flatMap(student => {
    const raw = values[student.id]?.trim() ?? '';
    if (!raw) return [];
    const value = normalizeCouncilValue(raw);
    const old = previousByStudent.get(student.id);
    return [old?.value === value ? old : { studentId: student.id, schoolYear, moment, value, updatedAt: now }];
  });
  const kept = prior.filter(e => e.schoolYear !== schoolYear || e.moment !== moment);
  return {
    ...data,
    classes: data.classes.map(item => item.id !== classId ? item : {
      ...item, councilAssessments: [...kept, ...entries]
    })
  };
}

export function summarizeCouncilValues(students: Student[], values: Record<string, string>) {
  const counts = { AV: 0, IN: 0, BA: 0, PA: 0 };
  for (const student of students) {
    const number = parseCouncilValue(values[student.id]);
    if (number !== null) {
      const level = getCompetenceLevel(number);
      if (level) counts[level.id] += 1;
    }
  }
  const assigned = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, assigned, missing: students.length - assigned, total: students.length };
}

// A new optional ClassData field preserves legacy payloads and the existing Vault record shape.
export function isCouncilAppDataValid(data: unknown): boolean {
  if (!data || typeof data !== 'object' || !Array.isArray((data as AppData).classes)) return false;
  for (const item of (data as AppData).classes) {
    if (item.councilAssessments === undefined) continue;
    if (!Array.isArray(item.councilAssessments) || !Array.isArray(item.students)) return false;
    const ids = new Set(item.students.map(student => student.id));
    const seen = new Set<string>();
    for (const entry of item.councilAssessments as CouncilAssessment[]) {
      if (!entry || typeof entry !== 'object' || !ids.has(entry.studentId)
        || typeof entry.schoolYear !== 'string' || !entry.schoolYear.trim()
        || !MOMENTS.includes(entry.moment)
        || parseCouncilValue(entry.value) === null
        || typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))) return false;
      const key = JSON.stringify([entry.studentId, entry.schoolYear, entry.moment]);
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

export function wouldLoseCouncilEntries(previous: AppData, incoming: AppData): boolean {
  for (const priorClass of previous.classes) {
    const nextClass = incoming.classes.find(item => item.id === priorClass.id);
    for (const previousEntry of priorClass.councilAssessments ?? []) {
      if (!nextClass?.councilAssessments?.some(entry =>
        entry.studentId === previousEntry.studentId
        && entry.schoolYear === previousEntry.schoolYear
        && entry.moment === previousEntry.moment
        && entry.value === previousEntry.value
      )) return true;
    }
  }
  return false;
}
