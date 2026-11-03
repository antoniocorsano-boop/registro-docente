import type { ConductContextResolution } from '../conduct/conductSession';
import type { ActiveTab } from '../types';

export type RecordEvidenceKind =
  | 'evaluation'
  | 'behaviour'
  | 'online-outcomes'
  | 'lesson-log';

export interface RecordContextSnapshot {
  classId: string;
  className: string;
  udaId?: string;
  udaTitle?: string;
  lessonId?: string;
  activityLabel?: string;
}

export interface RecordSessionDraft {
  context: RecordContextSnapshot;
  stagedNote?: string;
  evidenceKind?: RecordEvidenceKind;
  status: 'choose' | 'editing' | 'saved';
}

export type RecordRoute = {
  kind: 'tab';
  tab: ActiveTab;
};

export interface BuildRecordSessionInput {
  classId: string;
  className: string;
  conductContext?: ConductContextResolution | null;
  stagedNote?: string;
}

const normalizeOptionalText = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

export const buildRecordSession = ({
  classId,
  className,
  conductContext,
  stagedNote
}: BuildRecordSessionInput): RecordSessionDraft => {
  const normalizedClassId = classId.trim();
  const normalizedClassName = className.trim();

  if (!normalizedClassId || !normalizedClassName) {
    throw new Error('RECORD_CLASS_REQUIRED');
  }

  if (conductContext && conductContext.className.trim() !== normalizedClassName) {
    throw new Error('RECORD_CLASS_MISMATCH');
  }

  const context: RecordContextSnapshot = {
    classId: normalizedClassId,
    className: normalizedClassName
  };

  if (conductContext?.status === 'resolved') {
    context.udaId = conductContext.udaId;
    context.udaTitle = conductContext.udaTitle;

    const lessonId = normalizeOptionalText(conductContext.lessonId);
    if (lessonId) context.lessonId = lessonId;

    const activityLabel = normalizeOptionalText(conductContext.activityLabel);
    if (activityLabel) context.activityLabel = activityLabel;
  }

  const normalizedNote = normalizeOptionalText(stagedNote);
  return {
    context,
    ...(normalizedNote ? { stagedNote: normalizedNote } : {}),
    status: 'choose'
  };
};

export const setRecordEvidenceKind = (
  session: RecordSessionDraft,
  evidenceKind: RecordEvidenceKind
): RecordSessionDraft => ({
  ...session,
  evidenceKind,
  status: 'editing'
});

export const updateRecordStagedNote = (
  session: RecordSessionDraft,
  stagedNote: string
): RecordSessionDraft => {
  if (stagedNote.length > 0) {
    return {
      ...session,
      stagedNote
    };
  }

  const { stagedNote: _stagedNote, ...rest } = session;
  return rest;
};

export const markRecordSessionSaved = (
  session: RecordSessionDraft
): RecordSessionDraft => {
  if (!session.evidenceKind) {
    throw new Error('RECORD_EVIDENCE_REQUIRED');
  }

  return {
    ...session,
    status: 'saved'
  };
};

export const routeForRecordEvidence = (evidenceKind: RecordEvidenceKind): RecordRoute => {
  switch (evidenceKind) {
    case 'evaluation':
      return { kind: 'tab', tab: 'voti' };
    case 'behaviour':
      return { kind: 'tab', tab: 'comportamenti' };
    case 'online-outcomes':
      return { kind: 'tab', tab: 'verifiche-online' };
    case 'lesson-log':
      return { kind: 'tab', tab: 'uda-gantt' };
  }
};
