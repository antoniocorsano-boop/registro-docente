/** DOC-01/D4c3e1 — product-facing acceptance gates, synthetic UI only. */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
describe('DOC-01/D4c3e1 — guarded Privacy entry and human-readable review',()=>{
 test('Privacy exposes a separate optional V8 route, never passes V8 into legacy import',()=>{
  const p=read('src/components/PrivacyView.tsx');
  expect(p).toContain('documentRecoveryWorkflow?:DocumentRecoveryDriver');
  expect(p).toContain('documentRecoveryWorkflow &&');
  expect(p).toContain('<DocumentRecoveryReview');
  const app=read('src/App.tsx');
  expect(app).not.toContain('documentRecoveryWorkflow={');
  expect(app).not.toContain('prepareDocumentRestore(');
  expect(p).not.toContain('onImportEncryptedBackup(decryptedData as DocumentBackupPayloadV8)');
 });
 test('the separate UI requires explicit typed confirmation and reports an uncertain outcome neutrally',()=>{
  const component=read('src/components/documents/DocumentRecoveryReview.tsx');
  for(const label of ['Esamina il recupero','Conferma recupero','Annulla','RIPRISTINA',
   'Non è ancora una conferma di recupero riuscito','verifica dopo la riapertura',
   'Non ripetere il ripristino automaticamente'])expect(component).toContain(label);
  expect(component).toContain('createDocumentRecoveryDecision');
  expect(component).toContain('aria-live="polite"');
  expect(component).not.toContain('window.confirm(');
 });
 test('mobile 320/390 Chromium fixture runs teacher consent, cancellation, refusal and uncertain result',()=>{
  const workflow=read('.github/workflows/beta2-reference-qualification.yml');
  const specs=read('tests/browser/doc01-d4c3e1-recovery-review.spec.cjs');
  expect(workflow).toContain('cp tests/browser/doc01-d4c3e1-recovery-review.spec.cjs .nav-context-browser-tools/');
  expect(workflow).toContain('doc01-d4c3e1-recovery-review.spec.cjs \\');
  for(const scenario of ['320','390','uncertain','cancelled','verify-required'])
   expect(specs).toContain(scenario);
  expect(read('tests/browser/fixtures/doc01-d4c3e1.html')).toContain('doc01-d4c3e1-fixture.tsx');
 });
});
