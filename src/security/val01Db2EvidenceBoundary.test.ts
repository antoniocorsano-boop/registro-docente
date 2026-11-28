import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S6d.2c.1 — protected laboratory boundary',()=>{
 test('the production App uses only canonical confirmed evidence mutation and keeps synthetic DB2 fixture isolated',()=>{
  const app=read('src/App.tsx');
  const root=read('src/components/SecureRegistroRoot.tsx');
  expect(app).toContain('deriveConfirmedEvidenceMutation(current,scopes,scope,reviewed,confirmation).appData');
  expect(app).toContain('await commitAppDataMutation(current=>');
  expect(app).toContain('onSaveCriterionEvidence={handleSaveCriterionEvidence}');
  expect(root).not.toContain('deriveConfirmedEvidenceMutation');
  for(const text of [app,root]){
   expect(text).not.toContain('__val01Db2Evidence');
   expect(text).not.toContain('val01-s6d-db2.fixture');
  }
 });
 test('DB2 fixture admits only a fresh synthetic archive and existing authenticated DB2 owner',()=>{
  const s=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  expect(s).toContain('demand(await versions()===0)');
  expect(s).toContain('new ExistingSessionVaultStore(2)');
  expect(s).toContain('verifyAuthenticatedRecords(password)');
  expect(s).toContain('await migration.migrate(grant,true)');
  expect(s).toContain('await current.coordinator.sealAndDrain()');
  expect(s).toContain('authority.invalidate()');
 });
});
