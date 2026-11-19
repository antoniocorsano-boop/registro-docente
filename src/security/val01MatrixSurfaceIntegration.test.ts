import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
describe('VAL-01/S6d.1 — isolated matrix integration boundary',()=>{
 test('production uses shared two-mode selector and existing guarded transition only',()=>{
  const app=read('src/App.tsx');
  expect(app).toContain("<MatrixSurfaceSelector mode={dailyMatrixMode?'daily':'historical'} onChange={mode=>switchDailyMatrixMode(mode==='daily')}/>");
  expect(app).not.toContain('SyntheticEvidenceBoard');
  expect(app).not.toContain('val01-s6d-fixture');
  expect(app).not.toContain('laboratory mode=');
 });
 test('third surface is opt-in, and fixture uses only explicit synthetic local data',()=>{
  const selector=read('src/components/MatrixSurfaceSelector.tsx');
  expect(selector).toContain("props.laboratory===true");
  const host=read('tests/browser/fixtures/val01-s6d-fixture.tsx');
  expect(host).toContain('onSaveGrade={noWrite} onSaveObservation={noWrite}');
  expect(host).toContain('isPrivacyShieldActive={true}');
  expect(host).toContain('projectIndividualAssessmentEvidence(evidence,boardScope,report)');
  expect(host).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(/);
 });
});
