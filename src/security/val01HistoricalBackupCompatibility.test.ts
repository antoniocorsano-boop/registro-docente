import {describe,expect,test} from 'bun:test';
import {execFileSync} from 'node:child_process';
const read=(p:string)=>Bun.file(new URL('../../'+p,import.meta.url)).text();
describe('VAL-01/D1b.2b historical compatibility gate wiring (not dynamic browser evidence)',()=>{
  test('pins all three exact predecessors, verifies both checkouts, and runs separate browser gate',async()=>{
    const w=await read('.github/workflows/val01-historical-v7-compatibility.yml');
    expect(w).toContain('{ name: beta1-rc2, sha: 37c61d4c64993c986a3edcd2b421310adf20de92 }');
    expect(w).toContain('{ name: beta1-rc3, sha: b726f4a6dc0eb90a066113bee7cceabf29c629a5 }');
    expect(w).toContain('{ name: beta2-rc2, sha: ddbf60781514b866b09e1fa1e014e6a6fc3989d3 }');
    expect(w).toContain('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
    expect(w).toContain('test "$(git -C "$GITHUB_WORKSPACE/.historical-exact" rev-parse HEAD)" = "$HISTORICAL_SHA"');
    expect(w).toContain('val01-historical-v7-compatibility.spec.cjs');
    expect(w).not.toContain('beta2-archive-compatibility.spec.cjs');
    expect(w.split('playwright test')[1]).toContain('val01-historical-v7-compatibility.spec.cjs');
    expect(w).toContain('if-no-files-found: error');
  });
  test('historical fixture imports only historical crypto, storage and backup reader, never candidate codec',async()=>{
    const old=await read('tests/browser/fixtures/val01-historical-reader.fixture.ts');
    expect(old).toContain("from '../../../src/cryptoUtils'");
    expect(old).toContain("from '../../../src/security/backupPayload'");
    expect(old).toContain("import './beta2-archive-compatibility.fixture'");
    expect(old).not.toContain('assessmentBackupPayload');
    const spec=await read('tests/browser/val01-historical-v7-compatibility.spec.cjs');
    expect(spec).toContain('Versione dati backup non supportata: 7');
    expect(spec).toContain("old(page,'restoreOldBackup',candidate.backup)");
    expect(spec).toContain("old(page,'restoreOldBackup',seeded.backup)");
    expect(spec).toContain("old(page,'raw')).toEqual(seeded.physical)");
  });
  test('registered historical spec has exactly one explicit reference workflow owner',()=>{
    const result=JSON.parse(execFileSync(process.execPath,['scripts/qualification/check-reference-browser-coverage.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
    expect(result.status).toBe('REFERENCE_BROWSER_COVERAGE_PASS');
    expect(result.mapped).toBe(result.registered);
    expect(result.coverage.filter((entry:any)=>entry.workflow==='.github/workflows/val01-historical-v7-compatibility.yml')).toEqual([{workflow:'.github/workflows/val01-historical-v7-compatibility.yml',count:1}]);
  });

});
