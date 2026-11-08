import type { OnlineTest, Question } from '../types';

/**
 * INT-02/S3a — untrusted proposal received by the Copilot.
 *
 * This is not an OnlineTest: deliberately omits id, class ownership, UDA,
 * source identity, persistence authority and grading instructions. Generation,
 * teacher review and canonical saving are separate, later steps.
 */
export interface AssessmentDraftV1 {
  schemaVersion: 1;
  kind: 'assessment-draft';
  title: string;
  description: string;
  questions: Array<{
    type: 'multiple_choice' | 'true_false';
    q: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
}

export type AssessmentEditorPrefill = Pick<OnlineTest, 'title' | 'description' | 'questions'>;

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} non valido.`);
  }
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) {
    throw new TypeError(`${label}: campo non autorizzato.`);
  }
  return result;
}

function requiredText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TypeError(`${label} non valido.`);
  }
  return value.trim();
}

function optionalText(value: unknown, max: number, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new TypeError(`${label} non valido.`);
  }
  return value.trim();
}

/** Parse the entire generated output, failing closed on authorization-bearing fields. */
export function parseAssessmentDraftV1(value: unknown): AssessmentDraftV1 {
  const draft = record(value, ['schemaVersion', 'kind', 'title', 'description', 'questions'], 'Proposta');
  if (draft.schemaVersion !== 1 || draft.kind !== 'assessment-draft') {
    throw new TypeError('Formato della proposta non supportato.');
  }
  if (!Array.isArray(draft.questions) || draft.questions.length < 1 || draft.questions.length > 12) {
    throw new TypeError('Numero dei quesiti non valido.');
  }
  const questions: AssessmentDraftV1['questions'] = draft.questions.map((input, index) => {
    const entry = record(input, ['type', 'q', 'options', 'correct', 'explanation'], `Quesito ${index + 1}`);
    if (entry.type !== 'multiple_choice' && entry.type !== 'true_false') {
      throw new TypeError('Tipologia di quesito non supportata.');
    }
    if (!Array.isArray(entry.options)
      || entry.options.length < 2
      || entry.options.length > 6) {
      throw new TypeError('Opzioni non valide.');
    }
    const options = entry.options.map((option, optionIndex) =>
      requiredText(option, 160, `Opzione ${optionIndex + 1}`));
    if (new Set(options.map(option => option.toLocaleLowerCase('it'))).size !== options.length) {
      throw new TypeError('Le opzioni devono essere distinte.');
    }
    if (entry.type === 'true_false'
      && (options.length !== 2 || options[0] !== 'Vero' || options[1] !== 'Falso')) {
      throw new TypeError('Le opzioni vero/falso devono essere Vero e Falso.');
    }
    if (!Number.isInteger(entry.correct)
      || (entry.correct as number) < 0
      || (entry.correct as number) >= options.length) {
      throw new TypeError('Indice della risposta corretta non valido.');
    }
    return {
      type: entry.type,
      q: requiredText(entry.q, 500, 'Domanda'),
      options,
      correct: entry.correct as number,
      explanation: requiredText(entry.explanation, 500, 'Spiegazione')
    };
  });
  return {
    schemaVersion: 1,
    kind: 'assessment-draft',
    title: requiredText(draft.title, 160, 'Titolo'),
    description: optionalText(draft.description, 1000, 'Descrizione'),
    questions
  };
}

/**
 * A form-only projection. Neither a test ID nor a save operation is possible
 * through this return type. The editor still requires teacher review and an
 * explicit save via the existing canonical commit boundary.
 */
export function toAssessmentEditorPrefill(value: unknown): AssessmentEditorPrefill {
  const draft = parseAssessmentDraftV1(value);
  const questions: Question[] = draft.questions.map(question => ({
    type: question.type,
    q: question.q,
    options: [...question.options],
    correct: question.correct,
    explanation: question.explanation
  }));
  return {
    title: draft.title,
    description: draft.description,
    questions
  };
}
