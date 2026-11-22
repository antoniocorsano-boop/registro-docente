import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ClassData,AppSettings} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {loadStudentFormativeReviewSource} from '../assessment/studentFormativeReviewSource';
import {readStudentFormativeSources} from '../assessment/studentFormativeSourceReadModel';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {projectFormativeRestitution} from '../assessment/formativeRestitutionProjection';
import {StudentFormativeBalanceDraft} from '../components/StudentFormativeBalanceDraft';
const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings;
const cls=():ClassData=>({id:boardScope.classId,name:'Sintetica',
  students:boardScope.studentIds.map(id=>({id,name:'Studente sintetico '+id})),
  grades:[],behaviors:[],assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}
} as ClassData);
const load=(c=cls(),id='s1',period:'Q1'|'Q2'='Q1',from='2026-09-01',to='2027-01-31')=>
  loadStudentFormativeReviewSource(c,settings,id,period,from,to);
describe('VAL-01/PRODUCT-05/S7 — teacher review integration contract',()=>{
 test('detached verified S7a source and exact scoped recipient; no mutation',async()=>{
  const c=cls(),before=JSON.stringify(c),r=load(c);
  expect(r.status).toBe('ready');if(r.status!=='ready')throw Error('fixture invalid');
  expect(r.scope).toEqual(boardScope);expect(r.document).not.toBe(c.assessmentEvidenceV1?.documents[0].document);
  const context={...boardScope,studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
  const review=await prepareFormativeBalance(r.document,r.scope,context,
   {evidenceRevisionIds:['r-1'],comparisons:[],teacherText:{learning:'Testo del docente',progress:'',nextStep:'Preparare la spiegazione'}});
  expect(review.valid).toBe(true);if(!review.valid)throw Error(review.issue);
  const view=projectFormativeRestitution(review.preview);
  expect(view.sources).toHaveLength(1);
  expect(view.teacherText.learning).toBe('Testo del docente');
  expect(JSON.stringify(view)).not.toContain('Collegamenti esplicitati');
  expect(JSON.stringify(view)).not.toContain('rubric-v1');
  expect(JSON.stringify(c)).toBe(before);
 });
 test('wrong scope, absent archive, incorrect recipient and future term fail closed',()=>{
  const c=cls();
  expect(load(c,'s5').status).toBe('ready');
  expect(load(c,'other').status).toBe('unverified');
  expect(load(c,'s1','Q1','2025-11-30').status).toBe('unverified');
  expect(load(c,'s1','Q2').status).toBe('ready');
  expect(loadStudentFormativeReviewSource(c,{...settings,subject:'OTHER'},'s1','Q1','2026-09-01','2027-01-31').status).toBe('unverified');
  delete c.assessmentEvidenceV1;
  expect(load(c).status).toBe('absent');
 });
 test('cannot fabricate progress on one observation, or confirm after a changed source',async()=>{
  const r=load();if(r.status!=='ready')throw Error('fixture invalid');
  const context={classId:r.scope.classId,schoolYear:r.scope.schoolYear,subjectCode:r.scope.subjectCode,studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
  const req={evidenceRevisionIds:['r-1'],comparisons:[],teacherText:{learning:'',progress:'Migliora',nextStep:''}};
  expect(await prepareFormativeBalance(r.document,r.scope,context,req)).toEqual({valid:false,issue:'INVALID_COMPARISON'});
  const valid=await prepareFormativeBalance(r.document,r.scope,context,{...req,teacherText:{...req.teacherText,progress:''}});
  expect(valid.valid).toBe(true);if(!valid.valid)throw Error(valid.issue);
  const wrong=await confirmFormativeBalance(r.document,r.scope,{...context,studentId:'s2'},valid.preview,{confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'});
  expect(wrong).toEqual({valid:false,issue:'STALE_PREVIEW'});
 });
 test('UI starts unselected and unconfirmed, no private fact or automatic export',()=>{
  const c=cls(),m=readStudentFormativeSources(c,settings,'s1','Q1','2026-09-01','2027-01-31');
  if(m.status!=='ready')throw Error('fixture invalid');
  const html=renderToStaticMarkup(React.createElement(StudentFormativeBalanceDraft,{
    currentClass:c,settings,studentId:'s1',period:'Q1',from:'2026-09-01',to:'2027-01-31',rows:m.rows}));
  expect(html).toContain('Rivedi bilancio');
  expect(html).toContain('0 fonti scelte esplicitamente');
  expect(html).not.toContain('Conferma riesame locale');
  expect(html).not.toContain('Collegamenti esplicitati');
  const source=readFileSync('src/components/StudentFormativeBalanceDraft.tsx','utf8');
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|window\.print|download|exportPdf|setAppData|saveFormativeBalance/i);
  const report=readFileSync('src/components/StudentReportView.tsx','utf8');
  expect(report).toContain('String(isPrivacyShieldActive)');
 });
});
