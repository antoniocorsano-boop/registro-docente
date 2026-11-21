import {describe,test,expect} from 'bun:test';
import type {ClassData} from '../types';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {readFileSync} from 'node:fs';

const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const roster=boardScope.studentIds.map(id=>({id,name:'Alunno sintetico '+id}));
function schoolClass(document:unknown=boardDocument):ClassData{
  return {id:boardScope.classId,name:'Classe fittizia',students:roster,
    grades:[],behaviors:[],
    assessmentEvidenceV1:{version:1,documents:[{document,bindings:[]}]}
  } as ClassData;
}

describe('VAL-01/PRODUCT-01 — validated student criterion consultation',()=>{
  test('lists only the selected pupil, active teacher-confirmed records and exact frozen criteria',()=>{
    const source=schoolClass();
    const before=JSON.stringify(source);
    const s1=readStudentCriterionEvidence(source,settings,'s1');
    expect(s1.status).toBe('ready');
    if(s1.status!=='ready')throw Error('Test setup invalid');
    expect(s1.counts).toEqual({observed:1,notObserved:0,notApplicable:0});
    expect(s1.rows).toEqual([{revisionId:'r-1',observedOn:'2026-11-20',
      assessmentTitle:'Filiera sintetica',criterionDescription:'Relazioni tra fasi',state:'observed'}]);
    expect(JSON.stringify(source)).toBe(before);
    expect(JSON.stringify(s1)).not.toContain('s2');
    expect(JSON.stringify(s1)).not.toContain('Scelta motivata');
  });
  test('non osservato, non pertinente and missing observations remain distinct',()=>{
    const c=schoolClass();
    const s2=readStudentCriterionEvidence(c,settings,'s2');
    const s3=readStudentCriterionEvidence(c,settings,'s3');
    const s4=readStudentCriterionEvidence(c,settings,'s4');
    expect(s2.status).toBe('ready');expect(s3.status).toBe('ready');expect(s4.status).toBe('ready');
    if(s2.status!=='ready'||s3.status!=='ready'||s4.status!=='ready')throw Error('Invalid states');
    expect(s2.rows.map(r=>r.state)).toEqual(['not_observed']);
    expect(s3.rows.map(r=>r.state)).toEqual(['not_applicable']);
    expect(s4.rows).toEqual([]);
    expect(s4.counts).toEqual({observed:0,notObserved:0,notApplicable:0});
  });
  test('no archive means absent even when grades are high; no inferred evidence',()=>{
    const c=schoolClass();
    delete c.assessmentEvidenceV1;
    c.grades.push({id:'g1',studentId:'s1',date:'2026-11-20',
      type:'disegno',period:'Q1',title:'Schema',value:'10'});
    expect(readStudentCriterionEvidence(c,settings,'s1')).toEqual({status:'absent'});
  });
  test('different independently approved year or subject and foreign roster fail closed',()=>{
    const c=schoolClass();
    expect(readStudentCriterionEvidence(c,{...settings,subject:'ANOTHER'},'s1')).toEqual({status:'unverified'});
    expect(readStudentCriterionEvidence(c,{...settings,year:'2025/2026'},'s1')).toEqual({status:'unverified'});
    expect(readStudentCriterionEvidence(c,settings,'foreign')).toEqual({status:'unverified'});
    expect(readStudentCriterionEvidence(c,undefined,'s1')).toEqual({status:'unverified'});
  });
  test('corrupt or unconfirmed evidence cannot be shown, even with a matching scope',()=>{
    const c=schoolClass({...boardDocument,evidence:[{...boardDocument.evidence[0],confirmedByTeacher:false}]});
    expect(readStudentCriterionEvidence(c,settings,'s1')).toEqual({status:'unverified'});
    c.assessmentEvidenceV1={version:1,documents:[]} as any;
    expect(readStudentCriterionEvidence(c,settings,'s1')).toEqual({status:'unverified'});
  });
  test('withdrawn active revision is not revived or counted',()=>{
    const original=boardDocument.evidence[0];
    if(original.state!=='observed')throw Error('Bad fixture');
    const withdrawal={
      ...Object.fromEntries(Object.entries(original).filter(([k])=>k!=='fact'&&k!=='interpretation')),
      revisionId:'r-withdrawn',supersedesRevisionId:original.revisionId,
      recordedAt:'2026-11-21T09:00:00.000Z',confirmedAt:'2026-11-21T10:00:00.000Z',
      state:'withdrawn',reason:'Rilevazione ritirata'
    };
    const c=schoolClass({...boardDocument,evidence:[...boardDocument.evidence,withdrawal]});
    const result=readStudentCriterionEvidence(c,settings,'s1');
    expect(result.status).toBe('ready');
    if(result.status==='ready')expect(result.rows).toEqual([]);
  });
  test('UI remains read-only, respects privacy and uses the production dossier',()=>{
    const ui=readFileSync('src/components/StudentCriterionEvidencePanel.tsx','utf8');
    const report=readFileSync('src/components/StudentReportView.tsx','utf8');
    expect(ui).toContain('!isPrivacyShieldActive');
    expect(ui).toContain("model?.status==='unverified'");
    expect(ui).not.toContain('localStorage');
    expect(ui).not.toContain('fetch(');
    expect(ui).not.toContain('onSave');
    expect(report).toContain('<StudentCriterionEvidencePanel currentClass={currentClass} studentId={currentStudent.id}');
  });
});
