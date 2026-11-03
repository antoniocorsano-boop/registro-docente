import type { RecordEvidenceKind } from '../recording/recordSession';
import type { ActiveTab } from '../types';

export type ReviewOrigin = 'today-review' | 'post-record';

export type ReviewSurface = Extract<
  ActiveTab,
  'tabellone' | 'analytics' | 'storico' | 'report' | 'uda-gantt' | 'comportamenti'
>;

export interface ReviewSessionContext {
  classId: string;
  className: string;
  origin: ReviewOrigin;
  evidenceKind?: RecordEvidenceKind;
  currentSurface?: ReviewSurface;
}

export interface BuildReviewSessionInput {
  classId: string;
  className: string;
  origin: ReviewOrigin;
  evidenceKind?: RecordEvidenceKind | null;
}

const REVIEW_SURFACES: readonly ReviewSurface[] = [
  'tabellone',
  'analytics',
  'storico',
  'report',
  'uda-gantt',
  'comportamenti'
];

export function buildReviewSession({
  classId,
  className,
  origin,
  evidenceKind
}: BuildReviewSessionInput): ReviewSessionContext {
  const normalizedClassId = classId.trim();
  const normalizedClassName = className.trim();

  if (!normalizedClassId || !normalizedClassName) {
    throw new Error('REVIEW_CLASS_REQUIRED');
  }

  return {
    classId: normalizedClassId,
    className: normalizedClassName,
    origin,
    ...(evidenceKind ? { evidenceKind } : {})
  };
}

export function isReviewSurface(tab: ActiveTab): tab is ReviewSurface {
  return (REVIEW_SURFACES as readonly ActiveTab[]).includes(tab);
}

export function enterReviewSurface(
  session: ReviewSessionContext,
  surface: ReviewSurface
): ReviewSessionContext {
  return {
    ...session,
    currentSurface: surface
  };
}

export function returnToReviewRouter(
  session: ReviewSessionContext
): ReviewSessionContext {
  const { currentSurface: _currentSurface, ...rest } = session;
  return rest;
}

export function keepReviewSessionForClass(
  session: ReviewSessionContext | null,
  classId: string | null | undefined
): ReviewSessionContext | null {
  if (!session) return null;

  const normalizedClassId = classId?.trim();
  if (!normalizedClassId || session.classId !== normalizedClassId) return null;

  return session;
}

export function transitionReviewSessionForTab(
  session: ReviewSessionContext | null,
  classId: string | null | undefined,
  tab: ActiveTab
): ReviewSessionContext | null {
  const activeSession = keepReviewSessionForClass(session, classId);
  if (!activeSession) return null;

  if (isReviewSurface(tab)) {
    return enterReviewSurface(activeSession, tab);
  }

  if (tab === 'dashboard') {
    return returnToReviewRouter(activeSession);
  }

  return null;
}
