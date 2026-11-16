// VAL-01/D1a.2a: synthetic, read-only link resolution; RED API intentionally absent.
import { describe, expect, test } from 'bun:test';
import type { AppData, Grade } from '../types';
import { resolveAssessmentBatchLink } from '../assessment/assessmentBatchLink';

const batch = 'daily_12345678-1234-4123-8123-123456789abc';
const scope = { classId: 'class-a', schoolYear: '2026/2027', subjectCode: 'TECH' };
const proof = { batchId: batch, date: '2026-11-16', period: 'Q1', type: 'disegno', title: 'Schema sintetico' } as const;
const request = { ...scope, proof, confirmedByTeacher: true as const };
const individual = { ...request, individual: { studentId: 's1', gradeId: 'g1' } };

function fixture(): AppData {
  const grades: Grade[] = [
    { ...proof, id: 'g1', studentId: 's1', value: '8' },
    { ...proof, id: 'g2', studentId: 's2', value: '8' }
  ];
  return { currentClassId: 'class-a', classes: [
    { id: 'class-a', name: 'Classe sintetica A', students: [
      { id: 's1', name: 'Sintetico A' }, { id: 's2', name: 'Sintetico B' },
      { id: 's3', name: 'Sintetico C' }
    ], grades, behaviors: [] },
    { id: 'class-b', name: 'Classe sintetica B', students: [{id:'s9',name:'Sintetico Z'}], grades: [], behaviors: [] }
  ] };
}
function resolve(data: AppData, selection: unknown = request, context: unknown = scope) {
  return resolveAssessmentBatchLink(data, context, selection);
}
function bad(change: (data: AppData) => void, selection: unknown = request) {
  const d = fixture(); change(d); const before = structuredClone(d);
  expect(resolve(d,selection).valid).toBe(false);
  expect(d).toEqual(before);
}
describe('VAL-01/D1a.2a — collegamento esplicito alla prova', () => {
  test('risolve un batch giornaliero univoco senza leggere il valore come competenza', () => {
    const d = fixture(); const original = structuredClone(d);
    expect(resolve(d)).toEqual({valid:true, link:{ ...scope, proof, confirmedByTeacher:true }});
    expect(d).toEqual(original);
  });
  test('collega soltanto l’identità individuale esplicitamente scelta, non copia voti o nomi', () => {
    const d = fixture(); const original = structuredClone(d);
    const result = resolve(d,individual);
    expect(result).toEqual({valid:true,link:{...scope,proof,confirmedByTeacher:true,individual:{studentId:'s1',gradeId:'g1'}}});
    expect(d).toEqual(original);
  });
  test('assenza di conferma, campi extra e contesto discordante non producono link', () => {
    const d = fixture();
    expect(resolve(d,{...request,confirmedByTeacher:false}).valid).toBe(false);
    expect(resolve(d,{...request,generatedLevel:'A'}).valid).toBe(false);
    expect(resolve(d,request,{...scope,subjectCode:'MATH'}).valid).toBe(false);
    expect(resolve(d,request,{...scope,schoolYear:'2025/2026'}).valid).toBe(false);
    expect(resolve(d,{...request,classId:'class-b'}).valid).toBe(false);
  });
  test('classe non univoca e roster con identità duplicate sono rifiutati', () => {
    bad(d=>{d.classes.push(structuredClone(d.classes[0]));});
    bad(d=>{d.classes[0].students.push({...d.classes[0].students[0]});});
    bad(d=>{d.classes[0].grades[0].studentId='unknown';});
  });
  test('batch presente in altra classe è ambiguo anche con la stessa data', () => {
    bad(d=>{d.classes[1].grades.push({...d.classes[0].grades[0],id:'g9',studentId:'s9'});});
  });
  test('identità voto duplicata globalmente o più voti per alunno nel batch sono rifiutati', () => {
    bad(d=>{d.classes[1].grades.push({...d.classes[0].grades[0],batchId:'other',studentId:'s9'});});
    bad(d=>{d.classes[0].grades.push({...d.classes[0].grades[0],id:'g3'});});
  });
  test('metadati incoerenti nel batch impediscono il legame', () => {
    for(const field of ['date','type','period','title','udaId'] as const) {
      bad(d=>{Object.assign(d.classes[0].grades[1],{[field]:'different'});});
    }
  });
  test('metadati modificati dopo la selezione non sono riallineati silenziosamente', () => {
    bad(d=>{for(const g of d.classes[0].grades)g.title='Nuova prova';});
    bad(d=>{for(const g of d.classes[0].grades)g.udaId='uda-new';});
  });
  test('associazione UDA esatta: identità conservata, nessuna inferenza dal titolo', () => {
    const d=fixture(); for(const g of d.classes[0].grades)g.udaId='uda-synthetic';
    const explicit={...request,proof:{...proof,udaId:'uda-synthetic'}};
    expect(resolve(d,explicit)).toEqual({valid:true,link:{...scope,proof:explicit.proof,confirmedByTeacher:true}});
    expect(resolve(d).valid).toBe(false);
  });
  test('batch assente, rimosso o legacy senza identità non viene ricercato per somiglianza', () => {
    bad(d=>{d.classes[0].grades=[];});
    bad(d=>{for(const g of d.classes[0].grades)delete g.batchId;});
    bad(d=>{for(const g of d.classes[0].grades)g.batchId='different';});
  });
  test('prova storica con batch esplicito coerente è consultabile senza fusione', () => {
    const d=fixture(); for(const g of d.classes[0].grades)g.batchId='historic-1';
    const explicit={...request,proof:{...proof,batchId:'historic-1'}};
    expect(resolve(d,explicit)).toEqual({valid:true,link:{...scope,proof:explicit.proof,confirmedByTeacher:true}});
    expect(resolve(d).valid).toBe(false);
  });
  test('importazioni online e namespace giornaliero malformato non sono assimilati', () => {
    for(const key of ['online_submission1','daily_invalid']) {
      const d=fixture(); for(const g of d.classes[0].grades)g.batchId=key;
      expect(resolve(d,{...request,proof:{...proof,batchId:key}}).valid).toBe(false);
    }
  });
  test('un voto diverso non riassocia automaticamente una rilevazione storica', () => {
    bad(d=>{d.classes[0].grades[0].id='g-new';},individual);
    bad(d=>{d.classes[0].grades[0].studentId='s3';},individual);
    expect(resolve(fixture(),{...request,individual:{studentId:'s1',gradeId:'g2'}}).valid).toBe(false);
    expect(resolve(fixture(),{...request,individual:{studentId:'s3',gradeId:'g3'}}).valid).toBe(false);
  });
  test('cambio del valore, non dell’identità, non produce nuova interpretazione', () => {
    const d=fixture(); const initial=resolve(d,individual); d.classes[0].grades[0].value='6';
    expect(resolve(d,individual)).toEqual(initial);
  });
  test('assenza e non classificato restano riferimenti a voti, senza esito per criterio', () => {
    for(const value of ['A','NC','G']) {
      const d=fixture();d.classes[0].grades[0].value=value;
      expect(resolve(d,individual)).toEqual({valid:true,link:{...scope,proof,confirmedByTeacher:true,individual:{studentId:'s1',gradeId:'g1'}}});
    }
  });
  test('data e anno scolastico incoerenti e periodo non valido sono rifiutati', () => {
    for(const date of ['2026-02-30','2025-11-16','2027-10-01']) {
      const d=fixture();for(const g of d.classes[0].grades)g.date=date;
      expect(resolve(d,{...request,proof:{...proof,date}}).valid).toBe(false);
    }
    const d=fixture();for(const g of d.classes[0].grades)Object.assign(g,{period:'Q3'});
    expect(resolve(d,{...request,proof:{...proof,period:'Q3'}}).valid).toBe(false);
  });
  test('malformazioni del contratto: campi non previsti, stringhe vuote e proprietà accessor', () => {
    const d=fixture();let called=false;
    const tricky={...request, get proof(){called=true;return proof;}};
    expect(resolve(d,tricky).valid).toBe(false);expect(called).toBe(false);
    expect(resolve(d,{...request,proof:{...proof,value:'8'}}).valid).toBe(false);
    expect(resolve(d,{...request,individual:{studentId:'s1',gradeId:''}}).valid).toBe(false);
  });
  test('discipline diverse non richiedono una mappatura Tecnologia', () => {
    const context={...scope,subjectCode:'MATH'};
    expect(resolve(fixture(),{...request,...context},context).valid).toBe(true);
  });
});
