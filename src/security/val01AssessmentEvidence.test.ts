// VAL-01/D1a.1: pure contract; synthetic data only.
// RED deliberately imports the as-yet absent domain API; no runtime entrypoint changes.
import { describe, expect, test } from 'bun:test';
import { validateAssessmentEvidenceV1 } from '../assessment/assessmentEvidence';

const scope = { classId: 'class-synthetic', schoolYear: '2026/2027', subjectCode: 'TECH', studentIds: ['s1', 's2'] };
const stamp = '2026-11-16T09:00:00.000Z';
const day = '2026-11-16';
const revision = { confirmedByTeacher: true, confirmedAt: stamp };
const local = { kind: 'local', sourceVersion: '1' };

function fixture(): any {
  return {
    version: 1, classId: scope.classId, schoolYear: scope.schoolYear, subjectCode: scope.subjectCode,
    references: [
      { ...revision, referenceId: 'o1', revisionId: 'or1', kind: 'specific-objective', text: 'Rappresentare una filiera', source: local },
      { ...revision, referenceId: 'o2', revisionId: 'or2', kind: 'competence', text: 'Motivare una scelta', source: local },
      { ...revision, referenceId: 'n1', revisionId: 'nr1', kind: 'foundational-core', text: 'Sistemi produttivi', source: local },
    ],
    criteria: [
      { ...revision, criterionId: 'c1', revisionId: 'cr1', description: 'Rappresentazione delle relazioni', targetReferenceRevisionIds: ['or1'], contextualReferenceRevisionIds: ['nr1'] },
      { ...revision, criterionId: 'c2', revisionId: 'cr2', description: 'Motivazione della scelta', targetReferenceRevisionIds: ['or2'], contextualReferenceRevisionIds: [] },
    ],
    rubrics: [
      { ...revision, rubricId: 'r1', revisionId: 'rr1', source: local, criteria: [
        { criterionRevisionId: 'cr1', levels: [
          { levelId: 'l1', label: 'Da integrare', description: 'Rappresenta alcuni passaggi' },
          { levelId: 'l2', label: 'Relazioni principali', description: 'Rappresenta le relazioni principali' },
        ] }
      ] },
    ],
    assessments: [
      { ...revision, assessmentId: 'a1', revisionId: 'ar1', date: day, period: 'Q1', title: 'Filiera sintetica', purpose: 'formative', status: 'completed', completedOn: day, source: { kind: 'explicit-activity', activityId: 'activity1' }, criteria: [
        { criterionRevisionId: 'cr1', rubricRevisionId: 'rr1', expected: { kind: 'product', description: 'Schema delle fasi', method: 'elaborato' } },
        { criterionRevisionId: 'cr2', expected: { kind: 'argumentation', description: 'Scelta motivata', method: 'spiegazione' } },
      ] }
    ],
    evidence: [
      { ...revision, evidenceId: 'e1', revisionId: 'er1', observationEventId: 'event1', assessmentRevisionId: 'ar1', studentId: 's1', criterionRevisionId: 'cr1', observedOn: day, recordedAt: stamp, state: 'observed',
        fact: { kind: 'product', description: 'Ha collegato le tre fasi', method: 'elaborato', productRef: 'product-local-1' }, interpretation: { kind: 'level', levelId: 'l2' } },
      { ...revision, evidenceId: 'e2', revisionId: 'er2', observationEventId: 'event1', assessmentRevisionId: 'ar1', studentId: 's2', criterionRevisionId: 'cr2', observedOn: day, recordedAt: stamp, state: 'observed',
        fact: { kind: 'argumentation', description: 'Ha motivato una scelta con un esempio', method: 'spiegazione' }, interpretation: { kind: 'pending' } },
    ],
  };
}
function valid(data: unknown, context: unknown = scope) {
  return validateAssessmentEvidenceV1(data, context).valid;
}
function bad(change: (data: any) => void) {
  const data = fixture(); change(data); const before = structuredClone(data);
  expect(valid(data)).toBe(false); expect(data).toEqual(before);
}

describe('VAL-01/D1a.1 — contratto puro locale', () => {
  test('accetta grafo locale confermato e non muta input', () => {
    const data = fixture(); const before = structuredClone(data);
    expect(valid(data)).toBe(true); expect(data).toEqual(before);
  });
  test('ammette attività diagnostica senza voto e senza evidenza inventata', () => {
    const data = fixture(); data.assessments[0].purpose = 'diagnostic'; data.evidence = [];
    expect(valid(data)).toBe(true); expect(data.evidence).toEqual([]);
  });
  test('rifiuta versione ignota, dati malformati e campi estranei', () => {
    expect(valid(null)).toBe(false); expect(valid(undefined)).toBe(false);
    bad(d => { d.version = 2; }); bad(d => { d.evidence = null; });
    bad(d => { d.evidence[0].generatedLevel = 'l2'; });
    bad(d => { d.references[0].studentNote = 'synthetic'; });
  });
  test('rifiuta scope discordante e roster ambiguo', () => {
    expect(valid(fixture(), {...scope, classId: 'other'})).toBe(false);
    expect(valid(fixture(), {...scope, schoolYear: '2025/2026'})).toBe(false);
    expect(valid(fixture(), {...scope, subjectCode: 'OTHER'})).toBe(false);
    expect(valid(fixture(), {...scope, studentIds: ['s1','s1']})).toBe(false);
    bad(d => { d.schoolYear = '2026/26'; });
  });
  test('rifiuta ID canonico non qualificato e fonte senza conferma', () => {
    bad(d => { d.references[0].source = {kind: 'arena-point', sourceVersion: '1'}; });
    bad(d => { d.references[0].confirmedByTeacher = false; });
    bad(d => { d.references[0].text = ' '; });
  });
  test('rifiuta target inesistente, duplicato o solo contestuale', () => {
    bad(d => { d.criteria[0].targetReferenceRevisionIds = ['missing']; });
    bad(d => { d.criteria[0].targetReferenceRevisionIds = ['or1','or1']; });
    bad(d => { d.criteria[0].targetReferenceRevisionIds = ['nr1']; });
  });
  test('rubrica legata alla revisione esatta del criterio', () => {
    bad(d => { d.assessments[0].criteria[1].rubricRevisionId = 'rr1'; });
    bad(d => { d.rubrics[0].criteria[0].levels[1].levelId = 'l1'; });
    bad(d => { d.evidence[0].interpretation.levelId = 'missing'; });
    bad(d => { d.rubrics[0].source = { kind: 'institutional', sourceVersion: '1' }; });
  });
  test('rifiuta evidenza senza fatto anche con livello esplicito', () => {
    bad(d => { delete d.evidence[0].fact; });
    bad(d => { d.evidence[0].fact.description = ' '; });
    bad(d => { d.evidence[0].interpretation = {kind: 'level', levelId: 'l2', score: 8}; });
  });
  test('accetta osservazione confermata ancora senza interpretazione', () => {
    const data = fixture(); data.evidence[0].interpretation = { kind: 'pending' };
    expect(valid(data)).toBe(true);
  });
  test('stati non osservati e non pertinenti non ammettono livello o fatto inventati', () => {
    for (const state of ['not_observed','not_applicable']) {
      const data = fixture(); const e = data.evidence[0];
      delete e.fact; delete e.interpretation; e.state = state;
      expect(valid(data)).toBe(true);
      e.interpretation = {kind: 'level', levelId: 'l1'};
      expect(valid(data)).toBe(false);
    }
  });
  test('rifiuta studente estraneo, prova o criterio incoerente', () => {
    bad(d => { d.evidence[0].studentId = 'unknown'; });
    bad(d => { d.evidence[0].assessmentRevisionId = 'missing'; });
    bad(d => { d.evidence[0].criterionRevisionId = 'cr2'; });
    bad(d => { d.assessments[0].criteria.push(d.assessments[0].criteria[0]); });
  });
  test('prodotto comune non implica livello per altri; modalità equivalente ammessa', () => {
    const data = fixture(); const e = data.evidence[1];
    e.criterionRevisionId = 'cr1';
    e.fact = {kind:'product', description:'Ha spiegato personalmente le fasi', method:'orale', productRef:'product-local-1', support:'visual'};
    e.interpretation = {kind:'pending'};
    expect(valid(data)).toBe(true);
    delete e.fact.description; expect(valid(data)).toBe(false);
  });
  test('non accetta osservazioni da attività solo pianificata o annullata', () => {
    bad(d => { d.assessments[0].status = 'planned'; delete d.assessments[0].completedOn; });
    bad(d => { d.assessments[0].status = 'cancelled'; delete d.assessments[0].completedOn; });
  });
  test('rifiuta data invalida e registrazione anteriore all’osservazione', () => {
    bad(d => { d.evidence[0].observedOn = '2026-02-30'; });
    bad(d => { d.evidence[0].recordedAt = '2026-11-15T09:00:00.000Z'; });
  });
  test('nuova osservazione e correzione mantengono identità distinte', () => {
    const data = fixture(); const first = data.evidence[0];
    data.evidence.push({...structuredClone(first), revisionId:'er3', supersedesRevisionId:'er1', interpretation:{kind:'pending'}});
    data.evidence.push({...structuredClone(first), evidenceId:'e3', revisionId:'er4', observationEventId:'event2'});
    expect(valid(data)).toBe(true);
    data.evidence[3].observationEventId = 'event1'; expect(valid(data)).toBe(false);
  });
  test('rifiuta catene orfane, biforcate, cicliche o con identità cambiata', () => {
    bad(d => { d.evidence[0].supersedesRevisionId = 'missing'; });
    bad(d => { d.evidence[0].supersedesRevisionId = 'er1'; });
    bad(d => { d.evidence.push({...d.evidence[0], revisionId:'er3', supersedesRevisionId:'er1'}, {...d.evidence[0], revisionId:'er4', supersedesRevisionId:'er1'}); });
    bad(d => { d.evidence.push({...d.evidence[0], revisionId:'er3', supersedesRevisionId:'er1', studentId:'s2'}); });
  });
  test('ritiro richiede revisione precedente e motivo, nessun livello attivo', () => {
    const data = fixture(); const e = {...structuredClone(data.evidence[0]), revisionId:'er3', supersedesRevisionId:'er1', state:'withdrawn', reason:'Correzione della registrazione'};
    delete e.fact; delete e.interpretation; data.evidence.push(e);
    expect(valid(data)).toBe(true);
    delete e.reason; expect(valid(data)).toBe(false);
  });
  test('non accetta voto copiato o collegamenti a batch/online non ancora qualificati', () => {
    bad(d => { d.evidence[0].gradeValue = 8; });
    bad(d => { d.assessments[0].source = {kind:'daily-batch', batchId:'synthetic'}; });
    bad(d => { d.assessments[0].source = {kind:'future-online', testId:'synthetic'}; });
  });
});
