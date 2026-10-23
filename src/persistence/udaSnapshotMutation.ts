import type { UdaLesson, UdaRecord } from '../types';

type UdaPatch = Partial<UdaRecord> & Pick<UdaRecord, 'id'>;
type LessonPatch = Partial<UdaLesson> & Pick<UdaLesson, 'id'>;

interface StringArrayDelta {
  removed: Set<string>;
  added: string[];
  candidateDefined: boolean;
}

interface LessonArrayDelta {
  removedIds: Set<string>;
  additions: UdaLesson[];
  patches: LessonPatch[];
  candidateDefined: boolean;
}

interface UdaItemMutation {
  id: string;
  patch: UdaPatch;
  dependencies: StringArrayDelta | null;
  lessons: LessonArrayDelta | null;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildPatch(base: UdaRecord, candidate: UdaRecord): UdaPatch {
  const patch: UdaPatch = { id: candidate.id };
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(candidate)
  ] as Array<keyof UdaRecord>);

  keys.delete('id');
  keys.delete('dependencies');
  keys.delete('lessons');
  for (const key of keys) {
    if (!valuesEqual(base[key], candidate[key])) {
      (patch as Record<string, unknown>)[key as string] = candidate[key];
    }
  }
  return patch;
}

function buildStringArrayDelta(
  base: string[] | undefined,
  candidate: string[] | undefined
): StringArrayDelta | null {
  if (valuesEqual(base, candidate)) return null;

  const baseValues = base ?? [];
  const candidateValues = candidate ?? [];
  const candidateSet = new Set(candidateValues);
  const baseSet = new Set(baseValues);

  return {
    removed: new Set(baseValues.filter(value => !candidateSet.has(value))),
    added: candidateValues.filter(value => !baseSet.has(value)),
    candidateDefined: candidate !== undefined
  };
}

function applyStringArrayDelta(
  current: string[] | undefined,
  delta: StringArrayDelta
): string[] | undefined {
  const next = (current ?? []).filter(value => !delta.removed.has(value));
  const present = new Set(next);
  for (const value of delta.added) {
    if (!present.has(value)) {
      next.push(value);
      present.add(value);
    }
  }
  return next.length === 0 && !delta.candidateDefined ? undefined : next;
}

function buildLessonPatch(base: UdaLesson, candidate: UdaLesson): LessonPatch {
  const patch: LessonPatch = { id: candidate.id };
  const keys: Array<keyof UdaLesson> = ['date', 'topic', 'hours', 'notes', 'activityType'];
  for (const key of keys) {
    if (!valuesEqual(base[key], candidate[key])) {
      (patch as Record<string, unknown>)[key as string] = candidate[key];
    }
  }
  return patch;
}

function buildLessonArrayDelta(
  base: UdaLesson[] | undefined,
  candidate: UdaLesson[] | undefined
): LessonArrayDelta | null {
  if (valuesEqual(base, candidate)) return null;

  const baseValues = base ?? [];
  const candidateValues = candidate ?? [];
  const baseById = new Map(baseValues.map(lesson => [lesson.id, lesson]));
  const candidateById = new Map(candidateValues.map(lesson => [lesson.id, lesson]));

  return {
    removedIds: new Set(baseValues.filter(lesson => !candidateById.has(lesson.id)).map(lesson => lesson.id)),
    additions: candidateValues.filter(lesson => !baseById.has(lesson.id)),
    patches: candidateValues
      .filter(lesson => baseById.has(lesson.id))
      .map(lesson => buildLessonPatch(baseById.get(lesson.id)!, lesson))
      .filter(patch => Object.keys(patch).length > 1),
    candidateDefined: candidate !== undefined
  };
}

function applyLessonArrayDelta(
  current: UdaLesson[] | undefined,
  delta: LessonArrayDelta
): UdaLesson[] | undefined {
  const patchesById = new Map(delta.patches.map(patch => [patch.id, patch]));
  const next = (current ?? [])
    .filter(lesson => !delta.removedIds.has(lesson.id))
    .map(lesson => {
      const patch = patchesById.get(lesson.id);
      return patch ? { ...lesson, ...patch } : lesson;
    });

  const present = new Set(next.map(lesson => lesson.id));
  for (const addition of delta.additions) {
    if (!present.has(addition.id)) {
      next.push(addition);
      present.add(addition.id);
    }
  }

  return next.length === 0 && !delta.candidateDefined ? undefined : next;
}

export function createUdaSnapshotMutation(
  base: UdaRecord[],
  candidate: UdaRecord[]
): (current: UdaRecord[]) => UdaRecord[] {
  const baseById = new Map(base.map(item => [item.id, item]));
  const candidateById = new Map(candidate.map(item => [item.id, item]));
  const deletedIds = new Set(
    base.filter(item => !candidateById.has(item.id)).map(item => item.id)
  );
  const mutations: UdaItemMutation[] = candidate
    .filter(item => baseById.has(item.id))
    .map(item => {
      const baseItem = baseById.get(item.id)!;
      return {
        id: item.id,
        patch: buildPatch(baseItem, item),
        dependencies: buildStringArrayDelta(baseItem.dependencies, item.dependencies),
        lessons: buildLessonArrayDelta(baseItem.lessons, item.lessons)
      };
    })
    .filter(mutation =>
      Object.keys(mutation.patch).length > 1 || mutation.dependencies !== null || mutation.lessons !== null
    );
  const additions = candidate.filter(item => !baseById.has(item.id));

  return current => {
    const mutationsById = new Map(mutations.map(mutation => [mutation.id, mutation]));
    const rebased = current
      .filter(item => !deletedIds.has(item.id))
      .map(item => {
        const mutation = mutationsById.get(item.id);
        if (!mutation) return item;

        const next: UdaRecord = { ...item, ...mutation.patch };
        if (mutation.dependencies) {
          next.dependencies = applyStringArrayDelta(item.dependencies, mutation.dependencies);
        }
        if (mutation.lessons) {
          next.lessons = applyLessonArrayDelta(item.lessons, mutation.lessons);
        }
        return next;
      });
    const currentIds = new Set(rebased.map(item => item.id));
    for (const addition of additions) {
      if (!currentIds.has(addition.id)) {
        rebased.push(addition);
        currentIds.add(addition.id);
      }
    }
    return rebased;
  };
}
