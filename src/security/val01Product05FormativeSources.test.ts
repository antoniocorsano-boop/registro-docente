import {describe,test,expect} from 'bun:test';
import type {AppSettings,ClassData} from '../types';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {readStudentFormativeSources} from '../assessment/studentFormativeSourceReadModel';
import {StudentFormativeSourcesPanel} from '../components/StudentFormativeSourcesPanel';

const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const roster=boardScope.studentIds.map(id=>({id,name:'Alunno sintetico '+id}));
function schoolClass(document:unknown=boardDocument):ClassData{
  return {id:boardScope.classId,name:'Classe sintetica',students:roster,
    grades:[],behaviors:[],
    assessmentEvidenceV1:{version:1,documents:[{document,bindings:[]}]}
  } as ClassData;
}
const read=(c:ClassData,id='s1',period:'Q1'|'Q2'='Q1',from='2026-09-01',to='2027-01-31')=>
  readStudentFormativeSources(c,settings,id,period,from,to);

describe('VAL-01/PRODUCT-05 — eligible S7 sources in real dossier',()=>{
  test('exact recipient, date window and period: only active confirmed evidence, never raw facts',()=>{
    const c=schoolClass(),before=JSON.stringify(c);
    const result=read(c);
    expect(result.status).toBe('ready');
    if(result.status!=='ready')throw Error('Invalid fixture');
    expect(result.counts).toEqual({observed:1,notObserved:0,notApplicable:0});
    expect(result.rows).toEqual([{evidenceRevisionId:'r-1',observedOn:'2026-11-20',
      assessmentTitle:'Filiera sintetica',criterionDescription:'Relazioni tra fasi',state:'observed'}]);
    expect(result.coverage).toBe('undetermined');
    expect(JSON.stringify(result)).not.toContain('Collegamenti esplicitati');
    expect(JSON.stringify(result)).not.toContain('Scelta motivata');
    expect(JSON.stringify(c)).toBe(before);
  });
  test('absence, non-observation and not-applicable remain distinct, no grade inference',()=>{
    expect(read(schoolClass(),'s2')).toMatchObject({status:'ready',counts:{observed:0,notObserved:1,notApplicable:0}});
    expect(read(schoolClass(),'s3')).toMatchObject({status:'ready',counts:{observed:0,notObserved:0,notApplicable:1}});
    expect(read(schoolClass(),'s4')).toMatchObject({status:'ready',rows:[],counts:{observed:0,notObserved:0,notApplicable:0}});
    const c=schoolClass();delete c.assessmentEvidenceV1;
    c.grades.push({id:'g1',studentId:'s1',date:'2026-11-20',type:'verifica',period:'Q1',title:'Voto sintetico',value:'10'});
    expect(read(c)).toEqual({status:'absent'});
  });
  test('period and exact date bounds never default to institutional term dates',()=>{
    expect(read(schoolClass(),'s1','Q2')).toMatchObject({status:'ready',rows:[]});
    expect(read(schoolClass(),'s1','Q1','2026-12-01','2027-01-31')).toMatchObject({status:'ready',rows:[]});
    for(const [from,to] of [['2026-11-31','2027-01-31'],['2026-12-01','2026-11-20'],
      ['2025-09-01','2027-01-31'],['2026-09-01','2027-09-01']])
      expect(read(schoolClass(),'s1','Q1',from,to)).toEqual({status:'unverified'});
  });
  test('foreign class/subject/roster and modified records are never consulted',()=>{
    const c=schoolClass();
    expect(readStudentFormativeSources(c,{...settings,subject:'OTHER'},'s1','Q1','2026-09-01','2027-01-31')).toEqual({status:'unverified'});
    expect(readStudentFormativeSources(c,{...settings,year:'2025/2026'},'s1','Q1','2026-09-01','2027-01-31')).toEqual({status:'unverified'});
    expect(read(c,'other-student')).toEqual({status:'unverified'});
    const invalid=schoolClass({...boardDocument,evidence:[{...boardDocument.evidence[0],confirmedByTeacher:false}]});
    expect(read(invalid)).toEqual({status:'unverified'});
  });
  test('withdrawn evidence is excluded without reviving its predecessor',()=>{
    const original=boardDocument.evidence[0];
    if(original.state!=='observed')throw Error('Fixture');
    const {fact:_fact,interpretation:_interpretation,...common}=original;
    const withdrawal={...common,revisionId:'withdrawn-r',supersedesRevisionId:original.revisionId,
      recordedAt:'2026-11-21T09:00:00.000Z',confirmedAt:'2026-11-21T10:00:00.000Z',
      state:'withdrawn' as const,reason:'Ritiro sintetico'};
    expect(read(schoolClass({...boardDocument,evidence:[...boardDocument.evidence,withdrawal]})))
      .toMatchObject({status:'ready',rows:[]});
  });
  test('privacy shield prevents SSR disclosure; no hidden auto-confirmation or export',()=>{
    const props={currentClass:schoolClass(),settings:settings as AppSettings,studentId:'s1'};
    const unprotected=renderToStaticMarkup(React.createElement(StudentFormativeSourcesPanel,{...props,isPrivacyShieldActive:false}));
    expect(unprotected).toContain('Attiva la protezione dei nominativi');
    expect(unprotected).not.toContain('Filiera sintetica');
    const protectedHtml=renderToStaticMarkup(React.createElement(StudentFormativeSourcesPanel,{...props,isPrivacyShieldActive:true}));
    expect(protectedHtml).toContain('Seleziona entrambe le date');
    expect(protectedHtml).not.toContain('Filiera sintetica');
    expect(protectedHtml).toContain('Fonti per il bilancio formativo');
  });
});
