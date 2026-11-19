import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S6d.3 — operational evidence laboratory boundary',()=>{
 test('production App and Root remain unactivated; existing two-mode surface preserved',()=>{
  for(const p of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=read(p);
   expect(s).not.toContain('commitAssessmentEvidence');
   expect(s).not.toContain('val01-s6d-operational.fixture');
   expect(s).not.toContain('__val01OperationalDiagnostics');
  }
 });
 test('operational host uses real DB2 owner, protects identity and guards navigation until confirmed',()=>{
  const host=read('tests/browser/fixtures/val01-s6d-operational.fixture.tsx');
  const board=read('tests/browser/fixtures/val01-s6c-board.tsx');
  const adapter=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  const service=read('src/persistence/assessmentEvidenceCommit.ts');
  expect(host).toContain('await commitOperationalEvidence(reviewed,confirmation)');
  expect(host).toContain('committedDocument={evidence}');
  expect(host).toContain('isPrivacyShieldActive={true}');
  expect(host).toContain('projectIndividualAssessmentEvidence(evidence,boardScope,report)');
  expect(host).toContain('onSaveGrade={noWrite} onSaveObservation={noWrite}');
  expect(board).toContain('disabled={saving||recoveryRequired}');
  expect(board).toContain('const receipt=await onCommit(request,confirmation)');
  expect(adapter).toContain('return commitAssessmentEvidence({');
  expect(adapter).toContain('await o.storage.saveAppDataAndMeta(appData,meta)');
  expect(service).toContain('await owner.coordinator.enqueue');
  expect(service).toContain('await owner.storage.saveAppDataAndMeta');
  expect(host).not.toMatch(/localStorage|sessionStorage|fetch\(/);
 });
});
