import type { UdaRecord } from '../types';

export interface ConductContextInput {
  className: string;
  udas: readonly UdaRecord[];
  todayIsoDate: string;
}

export type ConductContextResolution =
  | { status: 'class-only'; className: string }
  | {
      status: 'resolved';
      className: string;
      udaId: string;
      udaTitle: string;
      lessonId?: string;
      activityLabel: string;
      objective?: string;
    }
  | { status: 'ambiguous'; className: string };

function normalize(value: string): string {
  return value.trim();
}

export function resolveConductContext(input: ConductContextInput): ConductContextResolution {
  const className = normalize(input.className);
  const classUdas = input.udas.filter(uda => normalize(uda.className) === className);

  const datedLessons = classUdas.flatMap(uda =>
    (uda.lessons ?? [])
      .filter(lesson => lesson.date === input.todayIsoDate)
      .map(lesson => ({ uda, lesson }))
  );

  if (datedLessons.length > 1) {
    return { status: 'ambiguous', className };
  }

  if (datedLessons.length === 1) {
    const { uda, lesson } = datedLessons[0];
    const topic = normalize(lesson.topic);
    const notes = lesson.notes?.trim();

    return {
      status: 'resolved',
      className,
      udaId: uda.id,
      udaTitle: uda.title,
      lessonId: lesson.id,
      activityLabel: topic || uda.title,
      ...(notes ? { objective: notes } : {})
    };
  }

  if (classUdas.length === 0) {
    return { status: 'class-only', className };
  }

  if (classUdas.length === 1) {
    const uda = classUdas[0];
    return {
      status: 'resolved',
      className,
      udaId: uda.id,
      udaTitle: uda.title,
      activityLabel: uda.title
    };
  }

  return { status: 'ambiguous', className };
}
