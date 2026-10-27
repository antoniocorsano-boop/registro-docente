import type { UdaLesson, UdaRecord } from '../types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';
import {
  createInternalSourceFromTeachingProposal,
  type TeachingProposalContent,
  type TeachingProposalV1
} from './teachingProposal';
import type { LibrarySource } from './types';

const CONTEXT_CHANGED = 'AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED';
const ADOPTED_ACTIVITY_DELIMITER = '---\nAttività adottata dal Copilota';

export interface TeachingProposalUdaAdoptionInput {
  proposal: TeachingProposalV1;
  content: TeachingProposalContent;
  teachingContext: ResolvedLibraryTeachingContext;
  udas: UdaRecord[];
  sourceId: string;
  lessonId: string;
  capturedAt: string;
  lessonDate: string;
}

export interface TeachingProposalUdaAdoptionReceipt {
  sourceId: string;
  udaId: string;
  lessonId: string;
  mode: 'existing-lesson' | 'new-lesson';
}

export interface TeachingProposalUdaAdoptionResult {
  source: LibrarySource;
  udas: UdaRecord[];
  receipt: TeachingProposalUdaAdoptionReceipt;
}

function failContextChanged(): never {
  throw new Error(CONTEXT_CHANGED);
}

function sameOptionalId(left?: string, right?: string): boolean {
  return (left ?? '') === (right ?? '');
}

function adoptedNotes(existing: string | undefined, activity: string): string {
  const block = `${ADOPTED_ACTIVITY_DELIMITER}\n${activity}`;
  return existing?.trim() ? `${existing.trim()}\n\n${block}` : block;
}

export function buildTeachingProposalUdaAdoption(
  input: TeachingProposalUdaAdoptionInput
): TeachingProposalUdaAdoptionResult {
  const { proposal, content, teachingContext, udas } = input;

  if (
    proposal.context.udaId !== teachingContext.udaId ||
    !sameOptionalId(proposal.context.lessonId, teachingContext.lessonId)
  ) {
    failContextChanged();
  }

  const udaIndex = udas.findIndex(candidate => candidate.id === teachingContext.udaId);
  if (udaIndex < 0) failContextChanged();

  const currentUda = udas[udaIndex]!;
  if (
    currentUda.className !== teachingContext.className ||
    currentUda.period !== teachingContext.period
  ) {
    failContextChanged();
  }

  const baseSource = createInternalSourceFromTeachingProposal({
    id: input.sourceId,
    proposal,
    content,
    capturedAt: input.capturedAt
  });
  const activityText = baseSource.payload.text;
  if (!activityText) failContextChanged();

  let targetLessonId: string;
  let mode: TeachingProposalUdaAdoptionReceipt['mode'];
  let nextLessons: UdaLesson[];

  if (teachingContext.lessonId) {
    const lessonIndex = (currentUda.lessons ?? []).findIndex(
      lesson => lesson.id === teachingContext.lessonId
    );
    if (lessonIndex < 0) failContextChanged();

    const currentLessons = currentUda.lessons ?? [];
    const currentLesson = currentLessons[lessonIndex]!;
    const replacement: UdaLesson = {
      ...currentLesson,
      notes: adoptedNotes(currentLesson.notes, activityText)
    };
    nextLessons = [...currentLessons];
    nextLessons[lessonIndex] = replacement;
    targetLessonId = currentLesson.id;
    mode = 'existing-lesson';
  } else {
    if ((currentUda.lessons ?? []).some(lesson => lesson.id === input.lessonId)) {
      failContextChanged();
    }
    const lesson: UdaLesson = {
      id: input.lessonId,
      date: input.lessonDate,
      topic: content.title,
      hours: 1,
      notes: activityText
    };
    nextLessons = [...(currentUda.lessons ?? []), lesson];
    targetLessonId = lesson.id;
    mode = 'new-lesson';
  }

  const nextUda: UdaRecord = {
    ...currentUda,
    lessons: nextLessons
  };
  const nextUdas = [...udas];
  nextUdas[udaIndex] = nextUda;

  const source: LibrarySource = {
    ...baseSource,
    links: [
      { targetType: 'uda', targetId: currentUda.id },
      { targetType: 'lesson', targetId: targetLessonId }
    ]
  };

  return {
    source,
    udas: nextUdas,
    receipt: {
      sourceId: source.id,
      udaId: currentUda.id,
      lessonId: targetLessonId,
      mode
    }
  };
}
