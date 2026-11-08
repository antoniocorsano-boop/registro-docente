import { describe, expect, test } from 'bun:test';

const MODULE = new URL('./assessmentDraft.ts', import.meta.url);
const candidate = {
  schemaVersion: 1,
  kind: 'assessment-draft',
  title: 'Verifica sintetica sull’energia',
  description: 'Controllo formativo senza dati degli alunni',
  questions: [{
    type: 'multiple_choice',
    q: 'Quale grandezza si misura in watt?',
    options: ['Energia', 'Potenza', 'Tensione'],
    correct: 1,
    explanation: 'Il watt misura la potenza.'
  }, {
    type: 'true_false',
    q: 'Una centrale eolica sfrutta l’energia del vento.',
    options: ['Vero', 'Falso'],
    correct: 0,
    explanation: 'Il vento mette in movimento il rotore.'
  }]
};

describe('INT-02/S3a — proposta di verifica soltanto sessionale', () => {
  test('materializza un parser specifico di verifiche, non la proposta di attività', async () => {
    expect(await Bun.file(MODULE).exists()).toBe(true);
    if (!await Bun.file(MODULE).exists()) return;
    const mod = await import('./assessmentDraft');
    expect(typeof mod.parseAssessmentDraftV1).toBe('function');
    expect(typeof mod.toAssessmentEditorPrefill).toBe('function');
  });

  test('accetta un questionario formativo strutturato e produce solo campi da editor', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { parseAssessmentDraftV1, toAssessmentEditorPrefill } = await import('./assessmentDraft');
    const parsed = parseAssessmentDraftV1(candidate);
    expect(parsed).toEqual(candidate);
    const prefill = toAssessmentEditorPrefill(parsed);
    expect(prefill).toEqual({
      title: candidate.title,
      description: candidate.description,
      questions: candidate.questions
    });
    for (const forbidden of ['id', 'udaId', 'sourceId', 'provenance', 'className', 'grades', 'saved']) {
      expect(Object.keys(prefill)).not.toContain(forbidden);
    }
    expect(prefill.questions).not.toBe(candidate.questions);
    expect(prefill.questions[0]).not.toBe(candidate.questions[0]);
  });

  test('rifiuta metadati di autorità o identità e non costruisce una verifica già salvata', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { parseAssessmentDraftV1 } = await import('./assessmentDraft');
    for (const extra of [
      { id: 'test-salvato' },
      { udaId: 'uda-arbitraria' },
      { className: '2C' },
      { sourceId: 'fonte-privata' },
      { provenance: { confirmedByTeacher: true } },
      { studentId: 'alunno' },
      { saved: true }
    ]) {
      expect(() => parseAssessmentDraftV1({ ...candidate, ...extra })).toThrow();
    }
    expect(() => parseAssessmentDraftV1({ ...candidate, kind: 'activity' })).toThrow();
    expect(() => parseAssessmentDraftV1({ ...candidate, schemaVersion: 2 })).toThrow();
  });

  test('rifiuta risposte corrette inesistenti, domande incomplete e spiegazioni mancanti', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { parseAssessmentDraftV1 } = await import('./assessmentDraft');
    const badQuestion = (patch: Record<string, unknown>) => ({
      ...candidate, questions: [{ ...candidate.questions[0], ...patch }]
    });
    for (const patch of [
      { q: ' ' },
      { options: [] },
      { options: ['Una sola risposta'] },
      { options: ['Ripetuta', 'Ripetuta'] },
      { correct: -1 },
      { correct: 3 },
      { correct: 1.5 },
      { explanation: '' },
      { type: 'open_short' },
      { udaId: 'non-ammesso' }
    ]) {
      expect(() => parseAssessmentDraftV1(badQuestion(patch))).toThrow();
    }
    expect(() => parseAssessmentDraftV1(badQuestion({
      type: 'true_false', options: ['Sì', 'No'], correct: 0
    }))).toThrow();
    expect(() => parseAssessmentDraftV1({ ...candidate, questions: [] })).toThrow();
    expect(() => parseAssessmentDraftV1({ ...candidate, questions: Array(13).fill(candidate.questions[0]) })).toThrow();
  });

  test('normalizza stringhe ma non modifica la proposta in ingresso', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { parseAssessmentDraftV1 } = await import('./assessmentDraft');
    const input = structuredClone(candidate);
    input.title = '  Verifica sintetica sull’energia  ';
    input.questions[0].q = '  Quale grandezza si misura in watt?  ';
    const output = parseAssessmentDraftV1(input);
    expect(output.title).toBe('Verifica sintetica sull’energia');
    expect(output.questions[0].q).toBe('Quale grandezza si misura in watt?');
    expect(input.title).toBe('  Verifica sintetica sull’energia  ');
    expect(input.questions[0].q).toBe('  Quale grandezza si misura in watt?  ');
  });
});
