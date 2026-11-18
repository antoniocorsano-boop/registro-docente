import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S6d.2c.2 — native evidence laboratory wiring',()=>{
 test('only synthetic debug package and qualified DB2 fixture are built, for API 32 and 36',()=>{
  const w=read('.github/workflows/val01-native-evidence.yml');
  expect(w).toContain('api: [32, 36]');
  expect(w).toContain('needs: preflight');
  expect(w).toContain('bun build tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  expect(w).toContain('it.trama.registrodocente.lab.val01');
  expect(w).toContain('assembleDebug');
  expect(w).toContain('node --test scripts/diagnostics/native-process-probe.test.mjs');
  expect(w).toContain('productionRelease==false');
  expect(w).not.toContain('assembleRelease');
 });
 test('native runner checks process absence and authenticated reopen without clearing the archive',()=>{
  const s=read('scripts/diagnostics/val01-native-evidence.mjs');
  expect(s).toContain('verifiedProcessStop({probe');
  expect(s).toContain("assert.deepEqual(identity(),expectedIdentity)");
  expect(s).toContain("await assert.rejects(call('summary')");
  expect(s).toContain("await call('open')");
  expect(s.match(/=await forceRestart\(installation\)/g)?.length).toBe(3);
  expect(s).not.toContain("'pm','clear'");
  expect(s).not.toContain("'uninstall'");
  expect(s).toContain('productionRelease:false');
 });
});
