import {
  buildAiBudgetActivityKey,
  normalizeAiBudgetProfile,
  type AiBudgetAuthorizationV1,
  type AiBudgetProfile
} from '../copilot/aiBudgetGovernor';
import type { LibrarySource } from './types';

export type AssessmentGenerationSourceKind = 'text' | 'note' | 'concept' | 'web' | 'internal';

export interface AssessmentGenerationRequestV1 {
  schemaVersion: 1;
  action: 'generate-assessment-draft';
  classification: 'TEACHER_PROFESSIONAL';
  explicitTeacherOptIn: true;
  source: {
    kind: AssessmentGenerationSourceKind;
    status: 'ready';
    privacy: 'teacher-professional';
    title: string;
    text: string;
  };
  context: {
    className: string;
    objective: string;
  };
  budget: {
    schemaVersion: 1;
    profile: AiBudgetProfile;
    activityKey: string;
    authorization?: AiBudgetAuthorizationV1;
  };
}

export function buildAiBudgetAssessmentKey(className: string): string {
  const canonicalClass = className.trim().toLocaleUpperCase('it');
  if (!canonicalClass) throw new Error('Classe esplicita obbligatoria.');
  // Distinct from existing UDA/lesson activity keys. This is not a UDA ID.
  return `assessment:class:${encodeURIComponent(canonicalClass)}`;
}

/**
 * Detect easily identifiable student information before any remote send.
 * This is a conservative secondary guard, not a claim that free text can
 * ever be automatically certified free of personal information.
 */
export function appearsStudentPersonal(value: string): boolean {
  return /\b(?:alunn[oa]|student[ea])\s+[\p{L}'’-]{2,40}\s+[\p{L}'’-]{2,40}\b/iu.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/i.test(value)
    || /\b(?:\+39\s*)?3\d{2}[\s.-]?\d{6,7}\b/.test(value)
    || /\b(?:pdp|pei|diagnosi|dislessia|discalculia|adhd)\b/i.test(value);
}

const TEXT_KINDS = new Set<AssessmentGenerationSourceKind>([
  'text', 'note', 'concept', 'web', 'internal'
]);

/**
 * The local client knows the Vault. Server cannot independently read encrypted
 * Library status. Recheck this function immediately before dispatch and again
 * against live state before presenting any result in S3c.
 */
export function buildAssessmentGenerationRequest(input: {
  source: LibrarySource;
  confirmedSourceId: string;
  activeClassName: string;
  confirmedClassName: string;
  objective: string;
  explicitTeacherOptIn: boolean;
  aiBudgetProfile?: AiBudgetProfile;
  budgetAuthorization?: AiBudgetAuthorizationV1;
}): AssessmentGenerationRequestV1 {
  const { source } = input;
  if (!input.explicitTeacherOptIn) throw new Error('Consenso remoto esplicito richiesto.');
  if (source.id !== input.confirmedSourceId || source.status !== 'ready'
    || source.privacy !== 'teacher-professional'
    || !TEXT_KINDS.has(source.kind as AssessmentGenerationSourceKind)) {
    throw new Error('Fonte professionale selezionata non disponibile.');
  }
  const className = input.activeClassName.trim();
  if (!className || className !== input.confirmedClassName.trim()) {
    throw new Error('Conferma della classe richiesta.');
  }
  const objective = input.objective.trim();
  const text = (source.extractedText?.trim() || source.payload.text?.trim() || '');
  const title = source.title.trim();
  if (!objective || objective.length > 400 || !title || !text) {
    throw new Error('Obiettivo o testo della fonte non disponibili.');
  }
  if ([title, text, objective].some(appearsStudentPersonal)) {
    throw new Error('Il materiale contiene possibili dati personali: invio remoto bloccato.');
  }
  const activityKey = buildAiBudgetAssessmentKey(className);
  return {
    schemaVersion: 1,
    action: 'generate-assessment-draft',
    classification: 'TEACHER_PROFESSIONAL',
    explicitTeacherOptIn: true,
    source: {
      kind: source.kind as AssessmentGenerationSourceKind,
      status: 'ready',
      privacy: 'teacher-professional',
      title,
      text
    },
    context: {className, objective},
    budget: {
      schemaVersion: 1,
      profile: normalizeAiBudgetProfile(input.aiBudgetProfile),
      activityKey,
      ...(input.budgetAuthorization ? { authorization: input.budgetAuthorization } : {})
    }
  };
}
