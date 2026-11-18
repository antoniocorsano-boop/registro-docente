import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance} from '../assessment/formativeBalance';
import {projectFormativeRestitution} from '../assessment/formativeRestitutionProjection';
const read=(p:string)=>readFileSync(p,'utf8');
const c={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
describe('VAL-01/S7b — restitution projection and isolation',()=>{
 test('recipient projection strictly allowlists source and teacher text; excludes internal metadata',async()=>{
  const d={...boardDocument,evidence:boardDocument.evidence.map(e=>e.state==='observed'&&e.studentId==='s1'?{...e,fact:{...e.fact,description:'Internal synthetic note',productRef:'private-product',support:'visual' as const,phase:'private-phase'}}:e)};
  const request={evidenceRevisionIds:['r-1'],comparisons:[],teacherText:{learning:'Testo esplicito del docente',progress:'',nextStep:'Passo successivo'}};
  const r=await prepareFormativeBalance(d,boardScope,c,request);if(!r.valid)throw Error(r.issue);
  const projected=projectFormativeRestitution(r.preview);
  expect(projected).toEqual({period:'Q1',from:c.from,to:c.to,sources:[{date:'2026-11-20',activity:'Filiera sintetica',criterion:'Relazioni tra fasi',objectives:['Rappresentare la filiera'],state:'observed'}],teacherText:request.teacherText});
  for(const privateText of ['Internal synthetic note','private-product','private-phase','visual','Elaborato','r-1','rubric-v1','basisDigest','Scelta motivata','studentId'])expect(JSON.stringify(projected)).not.toContain(privateText);
  expect(projected.teacherText).not.toBe(request.teacherText);
 });
 test('no production host activates the slot; existing legacy path and privacy gate retained',()=>{
  for(const p of ['src/App.tsx','src/components/SecureRegistroRoot.tsx'])expect(read(p)).not.toContain('laboratoryRestitution');
  const report=read('src/components/StudentReportView.tsx');
  expect(report).toContain('laboratoryRestitution && isPrivacyShieldActive ? laboratoryRestitution.content');
  expect(report).toContain('isPrivacyShieldActive ? <FormativeRestitutionView');
  const host=read('tests/browser/fixtures/val01-s6d-operational.fixture.tsx');
  expect(host).toContain('laboratoryRestitution={{requestChange:request');
  expect(host).toContain("reportView!=='restitution'");
  expect(host).toContain('getCurrent={operationalState}');
  expect(host).toContain('balanceDirty.current');
  const panel=read('tests/browser/fixtures/val01-s7b-balance.tsx');
  expect(panel).toContain('review.version===version?projectFormativeRestitution');
  expect(panel).toContain('await confirmFormativeBalance(current.document');
  // Explicit accessible name must not depend on the controlled textarea value.
  expect(panel).toContain('<textarea aria-label={label}');
  expect(panel).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|window\.print|download|exportPdf/i);
 });
});
