import type { AssessmentProvenanceV1, OnlineTest } from '../types';
import type { LibraryStateV1 } from './types';
import { resolveAssessmentHandoff, type AssessmentHandoffRequest } from './assessmentHandoff';

/** Teacher-only source metadata; not a content snapshot or a permission grant. */
export function isAssessmentProvenanceV1(value: unknown): value is AssessmentProvenanceV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 4
    && Object.keys(candidate).every(key =>
      ['version', 'kind', 'sourceId', 'confirmedByTeacher'].includes(key))
    && candidate.version === 1
    && candidate.kind === 'library-source'
    && typeof candidate.sourceId === 'string'
    && candidate.sourceId.trim().length > 0
    && candidate.confirmedByTeacher === true;
}

/** Legacy assessments without provenance remain valid. Explicit malformed fields do not. */
export function areAssessmentProvenancesValid(tests: unknown): boolean {
  if (typeof tests !== 'object' || tests === null || Array.isArray(tests)) return false;
  return Object.values(tests).every(test => {
    if (typeof test !== 'object' || test === null || Array.isArray(test)) return false;
    const record = test as Record<string, unknown>;
    return !Object.prototype.hasOwnProperty.call(record, 'provenance')
      || isAssessmentProvenanceV1(record.provenance);
  });
}

interface PrepareAssessmentCommitInput {
  nextTest: OnlineTest;
  previousTest?: OnlineTest;
  request: AssessmentHandoffRequest | null;
  library: LibraryStateV1;
  classes: readonly { id: string; name: string }[];
  activeClassId: string | null | undefined;
}

/**
 * Must run inside the serialized canonical test mutation, not only on UI click.
 * Existing provenance is an immutable historical fact, not freshly certified:
 * source revocation must not erase an otherwise editable saved assessment.
 */
export function prepareAssessmentTestForCommit({
  nextTest, previousTest, request, library, classes, activeClassId
}: PrepareAssessmentCommitInput): OnlineTest {
  const proposed = nextTest.provenance;
  if (previousTest) {
    const previous = previousTest.provenance;
    if (previous !== undefined && !isAssessmentProvenanceV1(previous)) {
      throw new Error('Provenienza storica non valida: salvataggio sospeso.');
    }
    if (proposed !== undefined
      && (!isAssessmentProvenanceV1(proposed) || JSON.stringify(proposed) !== JSON.stringify(previous))) {
      throw new Error('La provenienza di una verifica esistente non può essere riassegnata.');
    }
    if (!previous) {
      if (proposed !== undefined) throw new Error('Associazione della fonte non autorizzata su una verifica esistente.');
      return nextTest;
    }
    // Prevent accidental metadata deletion in the editor.
    return { ...nextTest, provenance: previous };
  }

  if (proposed === undefined) return nextTest;
  if (!isAssessmentProvenanceV1(proposed) || !request
    || request.sourceId !== proposed.sourceId) {
    throw new Error('Conferma della fonte assente o non valida.');
  }
  const resolution = resolveAssessmentHandoff({ request, library, classes: [...classes], activeClassId });
  if (resolution.status !== 'ready') {
    throw new Error('Fonte o classe non più disponibili per la provenienza.');
  }
  return nextTest;
}

export type SavedAssessmentOrigin = 'unregistered' | 'available' | 'unavailable';

/** Do not reveal source contents, identifiers or previous professional status. */
export function resolveSavedAssessmentOrigin(test: OnlineTest, library: LibraryStateV1): SavedAssessmentOrigin {
  const provenance = test.provenance;
  if (!provenance) return 'unregistered';
  if (!isAssessmentProvenanceV1(provenance)) return 'unavailable';
  const matches = library.sources.filter(source => source.id === provenance.sourceId);
  return matches.length === 1 && matches[0].status === 'ready'
    && matches[0].privacy === 'teacher-professional' ? 'available' : 'unavailable';
}

/** Explicitly strip teacher-only provenance before handing tests to student UI. */
export function projectAssessmentsForStudent(tests: Record<string, OnlineTest>): Record<string, OnlineTest> {
  return Object.fromEntries(Object.entries(tests).map(([key, { provenance: _privateSource, ...test }]) => [key, test]));
}
