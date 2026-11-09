import type { AppSettings, ClassData, CouncilMoment } from '../types';
import { councilRows, normalizeSchoolYear, parseCouncilValue, readCouncilValues } from './councilModel';

/** Derived, read-only view. It is NOT a saved historical snapshot of a council session. */
export interface CouncilEvidenceOverviewV1 {
  schoolYear: string;
  requestedCutoff: string;
  effectiveCutoff: string;
  cutoffClampedToSchoolYear: boolean;
  totalStudents: number;
  withNumericEvidence: number;
  withoutNumericEvidence: number;
  numericEvidenceCount: number;
  withSavedTeacherProposal: number;
  withoutSavedTeacherProposal: number;
}

/**
 * Build an aggregate overview from the current canonical grades and SAVED teacher proposals.
 * Never mutates grades, teacher proposals, the class or session records.
 * A future CDC-02/S2b increment will define explicit, frozen, dated evidence snapshots.
 */
export function buildCouncilEvidenceOverview(
  classData: ClassData,
  schoolYear: string,
  cutoff: string,
  settings: AppSettings,
  moment: CouncilMoment = 'ingresso'
): CouncilEvidenceOverviewV1 | null {
  const year = normalizeSchoolYear(schoolYear);
  if (!year || typeof cutoff !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return null;
  const parsedDate = new Date(cutoff + 'T12:00:00.000Z');
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== cutoff) return null;
  if (!['ingresso', 'intermedia', 'finale'].includes(moment)) return null;

  const endYear = Number(year.slice(0, 4)) + 1;
  const endOfSchoolYear = String(endYear) + '-08-31';
  const effectiveCutoff = cutoff > endOfSchoolYear ? endOfSchoolYear : cutoff;
  const rows = councilRows(classData, year, effectiveCutoff, settings);
  const uniqueIds = new Set(rows.map(row => row.student.id));
  if (uniqueIds.size !== rows.length) return null;

  const saved = readCouncilValues(classData, year, moment);
  const withNumericEvidence = rows.filter(row => row.count > 0).length;
  const withSavedTeacherProposal = rows.filter(row =>
    parseCouncilValue(saved[row.student.id]) !== null
  ).length;

  return {
    schoolYear: year,
    requestedCutoff: cutoff,
    effectiveCutoff,
    cutoffClampedToSchoolYear: cutoff !== effectiveCutoff,
    totalStudents: rows.length,
    withNumericEvidence,
    withoutNumericEvidence: rows.length - withNumericEvidence,
    numericEvidenceCount: rows.reduce((total, row) => total + row.count, 0),
    withSavedTeacherProposal,
    withoutSavedTeacherProposal: rows.length - withSavedTeacherProposal
  };
}
