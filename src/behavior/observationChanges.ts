import type { BehaviorRecord, ClassData } from '../types';
import { BEHAVIOR_OPTIONS, uid } from '../utils';

export type ObservationStatus = BehaviorRecord['status'];
export type ObservationDraft = ReadonlyMap<string, ObservationStatus>;

export function isObservationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}

export function recordedObservations(currentClass: ClassData, date: string): Map<string, BehaviorRecord> {
  const records = new Map<string, BehaviorRecord>();
  for (const record of currentClass.behaviors || []) {
    if (record.date === date) records.set(record.studentId, record);
  }
  return records;
}

export function buildObservationChanges(currentClass: ClassData, date: string, draft: ObservationDraft): BehaviorRecord[] {
  if (!isObservationDate(date)) return [];
  const existing = recordedObservations(currentClass, date);
  return currentClass.students.flatMap(student => {
    const status = draft.get(student.id);
    const previous = existing.get(student.id);
    if (!status || status === previous?.status) return [];
    return [{ ...(previous || { id: uid(), studentId: student.id, date }), status }];
  });
}

/** Called inside the durable mutation against the latest committed class.
 * Replace only the latest matching row; earlier legacy duplicates, notes,
 * unrelated students and other dates remain untouched. Reject stale targets.
 */
export function applyObservationChanges(currentClass: ClassData, changes: readonly BehaviorRecord[]): ClassData {
  if (!changes.length) throw new Error('Nessuna osservazione da salvare.');
  const studentIds = new Set(currentClass.students.map(student => student.id));
  const seen = new Set<string>();
  const records = [...(currentClass.behaviors || [])];
  const date = changes[0].date;
  for (const change of changes) {
    if (change.date !== date || !isObservationDate(date) || !studentIds.has(change.studentId)
      || !BEHAVIOR_OPTIONS.some(option => option.label === change.status) || seen.has(change.studentId)) {
      throw new Error('Contesto delle osservazioni non valido.');
    }
    seen.add(change.studentId);
    let index = -1;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].date === date && records[i].studentId === change.studentId) { index = i; break; }
    }
    if (index >= 0) {
      const previous = records[index];
      if (previous.id !== change.id) throw new Error('Osservazione aggiornata: riapri la giornata.');
      if (previous.status !== change.status) records[index] = { ...previous, status: change.status };
    } else {
      if (records.some(record => record.id === change.id)) throw new Error('Identificativo osservazione duplicato.');
      records.push({ id: change.id, date, studentId: change.studentId, status: change.status });
    }
  }
  return { ...currentClass, behaviors: records };
}
