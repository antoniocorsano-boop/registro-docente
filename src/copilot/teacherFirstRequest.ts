export type TeacherFirstGoalKind =
  | 'prepare'
  | 'review'
  | 'link'
  | 'material'
  | 'unknown';

export type TeacherFirstResolutionReason =
  | 'READY'
  | 'MULTIPLE_CLASS_MATCHES'
  | 'NO_CLASS_MATCH'
  | 'GOAL_CLARIFICATION_REQUIRED';

export interface TeacherFirstRequestResolution {
  goalKind: TeacherFirstGoalKind;
  normalizedGoal: string;
  classCandidates: string[];
  needsClassChoice: boolean;
  reason: TeacherFirstResolutionReason;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLocaleLowerCase('it')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClassName(value: string): string {
  return value.trim().toLocaleUpperCase('it').replace(/\s+/g, '');
}

function uniqueClassNames(classNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const className of classNames) {
    const normalized = normalizeClassName(className);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function resolveGoalKind(message: string): TeacherFirstGoalKind {
  if (/\b(attivita|prepara|preparare|scheda|lezione)\b/.test(message)) return 'prepare';
  if (/\b(rived\w*|revision\w*|controll\w*|valuta\w*)\b/.test(message)) return 'review';
  if (/\b(collega\w*|associa\w*)\b/.test(message)) return 'link';
  if (/\b(material\w*|fonte\w*)\b/.test(message)) return 'material';
  return 'unknown';
}

function explicitClassCandidates(message: string, classNames: string[]): string[] {
  return classNames.filter(className => {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Z])${escaped}([^0-9A-Z]|$)`, 'i').test(message.toLocaleUpperCase('it'));
  });
}

function gradeFromMessage(message: string): number | null {
  if (/\b(prima|prime|1a|1ª)\b/.test(message)) return 1;
  if (/\b(seconda|seconde|2a|2ª)\b/.test(message)) return 2;
  if (/\b(terza|terze|3a|3ª)\b/.test(message)) return 3;
  return null;
}

export function resolveTeacherFirstRequest(
  message: string,
  classNames: string[]
): TeacherFirstRequestResolution {
  const normalizedGoal = normalizeText(message);
  const knownClasses = uniqueClassNames(classNames);
  const goalKind = resolveGoalKind(normalizedGoal);

  if (goalKind === 'unknown') {
    return {
      goalKind,
      normalizedGoal,
      classCandidates: [],
      needsClassChoice: false,
      reason: 'GOAL_CLARIFICATION_REQUIRED'
    };
  }

  const explicit = explicitClassCandidates(normalizedGoal, knownClasses);
  if (explicit.length > 0) {
    return {
      goalKind,
      normalizedGoal,
      classCandidates: explicit,
      needsClassChoice: explicit.length > 1,
      reason: explicit.length > 1 ? 'MULTIPLE_CLASS_MATCHES' : 'READY'
    };
  }

  const grade = gradeFromMessage(normalizedGoal);
  if (grade !== null) {
    const gradeMatches = knownClasses.filter(className => className.startsWith(String(grade)));
    return {
      goalKind,
      normalizedGoal,
      classCandidates: gradeMatches,
      needsClassChoice: gradeMatches.length > 1,
      reason: gradeMatches.length === 0
        ? 'NO_CLASS_MATCH'
        : gradeMatches.length > 1
          ? 'MULTIPLE_CLASS_MATCHES'
          : 'READY'
    };
  }

  return {
    goalKind,
    normalizedGoal,
    classCandidates: [],
    needsClassChoice: false,
    reason: 'READY'
  };
}
