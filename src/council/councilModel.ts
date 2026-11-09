import type { AppData, AppSettings, ClassData, CouncilAssessment, CouncilMoment, CouncilSession, CouncilSessionKind, Student } from '../types';
import { calcAvg, calcWeightedAvg, getCompetenceLevel, parseGrade, sortStudents } from '../utils';

// Presentational only: session identity and Vault values remain ISO YYYY-MM-DD.
// Explicit Italian month names avoid browser-native MM/DD/YYYY ambiguity.
const ITALIAN_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
] as const;

export function formatCouncilDate(isoDate: string, abbreviated = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) return isoDate;
  const monthLabel = ITALIAN_MONTHS[month - 1];
  return `${day} ${abbreviated ? monthLabel.slice(0, 3) : monthLabel} ${year}`;
}

const MOMENTS: readonly CouncilMoment[] = ['ingresso', 'intermedia', 'finale'];
const SESSION_KINDS: readonly CouncilSessionKind[] = ['ingresso', 'intermedia', 'monitoraggio', 'finale', 'altro'];

// One identity for 2026/27, 2026/2027 and 2026-2027.
// Legacy labels remain readable; newly assigned values use the extended canonical form.
export function normalizeSchoolYear(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = /^(20\d{2})\s*[/-]\s*(20\d{2}|\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2].length === 2 ? Number(match[1].slice(0, 2) + match[2]) : Number(match[2]);
  return end === start + 1 ? `${start}/${end}` : null;
}

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
  const year = normalizeSchoolYear(schoolYear);
  if (year === null) return result;
  for (const entry of classData.councilAssessments ?? []) {
    if (normalizeSchoolYear(entry.schoolYear) === year && entry.moment === moment) {
      result[entry.studentId] = entry.value;
    }
  }
  return result;
}

export function councilRows(classData: ClassData, schoolYear: string, cutoff: string, settings: AppSettings) {
  const saved = readCouncilValues(classData, schoolYear);
  // Clamp by BOTH academic-year boundaries; a later cutoff cannot include the next year.
  const year = normalizeSchoolYear(schoolYear);
  const startYear = year === null ? null : Number(year.slice(0, 4));
  const from = startYear === null ? null : `${startYear}-09-01`;
  const through = startYear === null ? null : `${startYear + 1}-08-31`;
  return sortStudents(classData.students).map(student => {
    const valid = from === null ? [] : classData.grades.filter(grade =>
      grade.studentId === student.id
      && typeof grade.date === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(grade.date)
      && grade.date <= cutoff
      && grade.date >= from
      && grade.date <= through!
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
  const canonicalYear = normalizeSchoolYear(schoolYear);
  if (!canonicalYear || !MOMENTS.includes(moment) || !Number.isFinite(Date.parse(now))) {
    throw new Error('Anno scolastico o contesto del Consiglio non valido.');
  }
  const prior = selected.councilAssessments ?? [];
  const previousByStudent = new Map(prior
    .filter(e => normalizeSchoolYear(e.schoolYear) === canonicalYear && e.moment === moment)
    .map(e => [e.studentId, e]));
  const entries: CouncilAssessment[] = selected.students.flatMap(student => {
    const raw = values[student.id]?.trim() ?? '';
    if (!raw) return [];
    const value = normalizeCouncilValue(raw);
    const old = previousByStudent.get(student.id);
    return [old?.value === value ? old : {
      studentId: student.id, schoolYear: canonicalYear, moment, value, updatedAt: now
    }];
  });
  const kept = prior.filter(e => normalizeSchoolYear(e.schoolYear) !== canonicalYear || e.moment !== moment);
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

// Council session identity is independent of assessment moments. A teacher can record
// several sessions of the same kind within one period without losing any earlier one.
export function isCouncilSessionDateValid(date: string, schoolYear: string): boolean {
  const year = normalizeSchoolYear(schoolYear);
  if (!year || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const start = Number(year.slice(0, 4));
  return date >= `${start}-09-01` && date <= `${start + 1}-08-31`;
}

export function readCouncilSessions(classData: ClassData, schoolYear: string): CouncilSession[] {
  const year = normalizeSchoolYear(schoolYear);
  if (!year) return [];
  return (classData.councilSessions ?? [])
    .filter(session => normalizeSchoolYear(session.schoolYear) === year)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function appendCouncilSession(
  data: AppData,
  classId: string,
  schoolYear: string,
  kind: CouncilSessionKind,
  date: string,
  sessionId: string,
  now: string
): AppData {
  const selected = data.classes.find(item => item.id === classId);
  const year = normalizeSchoolYear(schoolYear);
  if (!selected || !year || !SESSION_KINDS.includes(kind)
    || !isCouncilSessionDateValid(date, year)
    || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)
    || !Number.isFinite(Date.parse(now))) {
    throw new Error('Dati della seduta non validi: ricontrolla classe, anno e data.');
  }
  if ((selected.councilSessions ?? []).some(session => session.id === sessionId)) {
    throw new Error('Seduta già presente: non è stata aggiunta una copia.');
  }
  const record: CouncilSession = { id: sessionId, schoolYear: year, kind, date, createdAt: now, updatedAt: now };
  return {
    ...data,
    classes: data.classes.map(item => item.id === classId ? {
      ...item, councilSessions: [...(item.councilSessions ?? []), record]
    } : item)
  };
}

// New optional ClassData fields preserve legacy backups and the existing encrypted Vault record.
export function isCouncilAppDataValid(data: unknown): boolean {
  if (!data || typeof data !== 'object' || !Array.isArray((data as AppData).classes)) return false;
  for (const item of (data as AppData).classes) {
    if (!item || typeof item !== 'object') return false;
    if (item.councilAssessments !== undefined) {
      if (!Array.isArray(item.councilAssessments) || !Array.isArray(item.students)) return false;
      const ids = new Set(item.students.map(student => student.id));
      const seen = new Set<string>();
      for (const entry of item.councilAssessments as CouncilAssessment[]) {
        if (!entry || typeof entry !== 'object' || !ids.has(entry.studentId)
          || normalizeSchoolYear(entry.schoolYear) === null
          || !MOMENTS.includes(entry.moment)
          || parseCouncilValue(entry.value) === null
          || typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))) return false;
        const key = JSON.stringify([entry.studentId, normalizeSchoolYear(entry.schoolYear), entry.moment]);
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
    if (item.councilSessions !== undefined) {
      if (!Array.isArray(item.councilSessions)) return false;
      const seen = new Set<string>();
      for (const session of item.councilSessions as CouncilSession[]) {
        if (!session || typeof session !== 'object'
          || typeof session.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(session.id)
          || typeof session.schoolYear !== 'string'
          || typeof session.date !== 'string'
          || !isCouncilSessionDateValid(session.date, session.schoolYear)
          || !SESSION_KINDS.includes(session.kind)
          || typeof session.createdAt !== 'string' || !Number.isFinite(Date.parse(session.createdAt))
          || typeof session.updatedAt !== 'string' || !Number.isFinite(Date.parse(session.updatedAt))
          || seen.has(session.id)) return false;
        seen.add(session.id);
      }
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
        && normalizeSchoolYear(entry.schoolYear) === normalizeSchoolYear(previousEntry.schoolYear)
        && entry.moment === previousEntry.moment
        && entry.value === previousEntry.value
      )) return true;
    }
    for (const previousSession of priorClass.councilSessions ?? []) {
      if (!nextClass?.councilSessions?.some(session =>
        session.id === previousSession.id
        && normalizeSchoolYear(session.schoolYear) === normalizeSchoolYear(previousSession.schoolYear)
        && session.date === previousSession.date
        && session.kind === previousSession.kind
        && session.createdAt === previousSession.createdAt
        && session.updatedAt === previousSession.updatedAt
      )) return true;
    }
  }
  return false;
}
