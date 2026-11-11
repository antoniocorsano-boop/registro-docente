import type { LibraryStateV1 } from './types';

export interface AssessmentHandoffRequest {
  sourceId: string;
  classId: string;
  /** Session-only teacher-written objective. Never source payload or generated questions. */
  objective?: string;
  guided?: true;
  nonce?: string;
}

export interface AssessmentHandoffInput {
  request: AssessmentHandoffRequest;
  library: LibraryStateV1;
  classes: readonly { id: string; name: string }[];
  activeClassId: string | null | undefined;
}

export interface ResolvedAssessmentHandoff {
  sourceId: string;
  classId: string;
  className: string;
  sourceTitle: string;
  objective?: string;
  guided?: true;
  nonce?: string;
}

export type AssessmentHandoffResolution =
  | { status: 'ready'; handoff: ResolvedAssessmentHandoff }
  | {
      status: 'unavailable';
      reason: 'CLASS_REQUIRED' | 'CLASS_CHANGED' | 'SOURCE_UNAVAILABLE'
        | 'SOURCE_NOT_PROFESSIONAL' | 'SOURCE_NOT_READY' | 'OBJECTIVE_INVALID';
    };

/**
 * INT-02/S1: resolve only references to an already committed source and to
 * the explicitly active class. No source payload, assessment, or UDA is
 * copied into this session-only descriptor. It never grants write authority.
 *
 * Re-run on both departure and arrival: changing the active class or
 * revoking/reclassifying a source invalidates a previously prepared route.
 */
export function resolveAssessmentHandoff({
  request,
  library,
  classes,
  activeClassId
}: AssessmentHandoffInput): AssessmentHandoffResolution {
  if (!request.sourceId.trim() || !request.classId.trim() || !activeClassId) {
    return { status: 'unavailable', reason: 'CLASS_REQUIRED' };
  }

  if (request.classId !== activeClassId) {
    return { status: 'unavailable', reason: 'CLASS_CHANGED' };
  }

  const matches = classes.filter(item =>
    item.id === request.classId && Boolean(item.name.trim())
  );
  if (matches.length !== 1) {
    return { status: 'unavailable', reason: 'CLASS_REQUIRED' };
  }

  const sources = library.sources.filter(source => source.id === request.sourceId);
  if (sources.length !== 1) {
    return { status: 'unavailable', reason: 'SOURCE_UNAVAILABLE' };
  }
  const source = sources[0];
  if (source.privacy !== 'teacher-professional') {
    return { status: 'unavailable', reason: 'SOURCE_NOT_PROFESSIONAL' };
  }
  if (source.status !== 'ready') {
    return { status: 'unavailable', reason: 'SOURCE_NOT_READY' };
  }

  // The guided offline route needs a meaningful teacher-written objective and
  // a one-use token. Old S1 handoffs remain untouched and do not prefill.
  if (request.guided === true && (
    !request.nonce?.trim()
    || !request.objective?.trim()
    || request.objective.trim().length > 400
    || !['text', 'note', 'concept', 'web', 'internal'].includes(source.kind)
    || !(source.extractedText?.trim() || source.payload.text?.trim())
  )) {
    return { status: 'unavailable', reason: 'OBJECTIVE_INVALID' };
  }

  return {
    status: 'ready',
    handoff: {
      sourceId: source.id,
      classId: matches[0].id,
      className: matches[0].name,
      sourceTitle: source.title,
      ...(request.guided === true
        ? { guided: true as const, nonce: request.nonce, objective: request.objective?.trim() }
        : {})
    }
  };
}
