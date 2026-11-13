import { describe, expect, test } from 'bun:test';
import type { ClassData, Grade, UdaRecord } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_EVALUATION_WEIGHTS, calcWeightedAvg } from '../utils';
import { buildFormativeRestitution, checkedRestitutionDraft, emptyRestitutionDraft } from '../report/formativeRestitution';

const grade = (id: string, studentId: string, value: string, period: Grade['period'], type: Grade['type'], title: string, date: string, udaId?: string): Grade =>
  ({id, studentId, value, period, type, title, date, udaId});
const cls: ClassData = {
  id: 'synthetic-class', name: 'Classe sintetica', students: [{id:'a',name:'Persona Fittizia Uno'},{id:'b',name:'Persona Fittizia Due'}],
  grades: [
    grade('3','a','NC','Q2','orale','Attività senza voto','2027-02-03'),
    grade('1','a','7+','Q1','verifica','Prova Uno','2026-10-03','local'),
    grade('2','a','9','Q2','disegno','Disegno Persona Fittizia Due','2027-02-01','foreign'),
    grade('4','b','3','Q1','verifica','MARCATORE ALTRO ALUNNO','2026-10-03'),
    grade('5','a','A','Q1','test','Assenza','2026-11-02'),
    grade('6','a','G','Q2','test','Giustificato','2027-02-04')
  ],
  behaviors: [{id:'private',studentId:'a',date:'2026-10-03',status:'Distratto ⚠️',note:'NOTA PRIVATA'}]
};
const udas: UdaRecord[] = [
  {id:'local',title:'UDA locale',className:cls.name,hours:2,period:'Q1',startMonth:1,durationMonths:1},
  {id:'foreign',title:'UDA ALTRA CLASSE',className:'Altra classe',hours:2,period:'Q2',startMonth:5,durationMonths:1}
];
describe('MOBILE-DENSITY-04/S2 protected restitution', () => {
  test('complete chronological single-student projection, no private or peer data', () => {
    const result = buildFormativeRestitution(cls,'a','all',DEFAULT_SETTINGS,udas)!;
    expect(result.rows.map(r=>r.date)).toEqual(['2026-10-03','2026-11-02','2027-02-01','2027-02-03','2027-02-04']);
    expect(result.summary).toEqual({count:5,numericCount:2,includedCount:2,mean:8.125});
    expect(result.rows[0].uda).toBe('UDA locale');
    expect(result.rows[2].uda).toBe('Collegamento UDA non verificato');
    expect(result.rows[1].value).toBe('Assente (A)');
    expect(result.rows[3].value).toBe('Non classificato (NC)');
    expect(result.rows[4].value).toBe('Giustificato (G)');
    const encoded=JSON.stringify(result);
    for (const privateValue of ['MARCATORE ALTRO ALUNNO','NOTA PRIVATA','Persona Fittizia Uno','Persona Fittizia Due','UDA ALTRA CLASSE','synthetic-class']) expect(encoded).not.toContain(privateValue);
    expect(result.rows[2].title).toContain('[nominativo protetto]');
    expect(buildFormativeRestitution(cls,'unknown','all',DEFAULT_SETTINGS,udas)).toBeNull();
    expect(buildFormativeRestitution(cls,'a','Q1',DEFAULT_SETTINGS,udas)?.summary).toEqual({count:2,numericCount:1,includedCount:1,mean:7.25});
  });
  test('uses authoritative weighted calculation and exposes zero-weight exclusion', () => {
    const weights={...DEFAULT_EVALUATION_WEIGHTS,disegno:0};
    const result=buildFormativeRestitution(cls,'a','all',{...DEFAULT_SETTINGS,useWeightedAverage:true,evaluationWeights:weights},udas)!;
    expect(result.summary.mean).toBe(calcWeightedAvg(cls.grades.filter(g=>g.studentId==='a'),weights));
    expect(result.summary.includedCount).toBe(1);
    expect(result.rows[2].included).toBe(false);
    expect(result.byType.find(t=>t.type==='disegno')?.weight).toBe(0);
  });
  test('no records are not a judgment, draft contains only teacher text and rejects known names', () => {
    expect(buildFormativeRestitution({...cls,grades:[]},'a','all',DEFAULT_SETTINGS,udas)?.summary).toEqual({count:0,numericCount:0,includedCount:0,mean:null});
    expect(checkedRestitutionDraft({...emptyRestitutionDraft(),strength:'  Sintesi del docente  '},[] )?.strength).toBe('Sintesi del docente');
    expect(checkedRestitutionDraft({...emptyRestitutionDraft(),strength:'Persona Fittizia Due'},cls.students.map(s=>s.name))).toBeNull();
    expect(checkedRestitutionDraft({...emptyRestitutionDraft(),goal1:'x'.repeat(1201)},[])).toBeNull();
  });
});

test('protected recipient ordinal is distinct and independent of roster display ordering',()=>{
  const reversed={...cls,students:[...cls.students].reverse()};
  expect(buildFormativeRestitution(cls,'a','all',DEFAULT_SETTINGS,udas)?.recipientLabel).toBe('Destinatario protetto · Alunno 01');
  expect(buildFormativeRestitution(reversed,'a','all',DEFAULT_SETTINGS,udas)?.recipientLabel).toBe('Destinatario protetto · Alunno 01');
  expect(buildFormativeRestitution(reversed,'b','all',DEFAULT_SETTINGS,udas)?.recipientLabel).toBe('Destinatario protetto · Alunno 02');
});
