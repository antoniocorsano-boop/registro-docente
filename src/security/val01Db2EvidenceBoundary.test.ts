import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S6d.2c.1 — protected laboratory boundary',()=>{
 test('the production App and Root do not activate the evidence storage fixture',()=>{
  for(const p of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=read(p);
   expect(s).not.toContain('__val01Db2Evidence');
   expect(s).not.toContain('deriveConfirmedEvidenceMutation');
   expect(s).not.toContain('val01-s6d-db2.fixture');
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
