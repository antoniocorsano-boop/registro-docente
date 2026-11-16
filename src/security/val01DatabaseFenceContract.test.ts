import {describe,expect,test} from 'bun:test';
import {execFileSync} from 'node:child_process';
const read=(p:string)=>Bun.file(new URL('../../'+p,import.meta.url)).text();
describe('VAL-01/D1b.3a database fence browser wiring (not native acceptance)',()=>{
  test('exact historical checkouts and isolated fixture are executed for all three versions',async()=>{
    const w=await read('.github/workflows/val01-database-fence.yml');
    for(const sha of ['37c61d4c64993c986a3edcd2b421310adf20de92','b726f4a6dc0eb90a066113bee7cceabf29c629a5','ddbf60781514b866b09e1fa1e014e6a6fc3989d3'])expect(w).toContain(sha);
    expect(w).toContain('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
    expect(w).toContain('test "$(git -C "$GITHUB_WORKSPACE/.historical-exact" rev-parse HEAD)" = "$HISTORICAL_SHA"');
    expect(w.split('playwright test')[1]).toContain('val01-database-fence.spec.cjs');
    const fixture=await read('tests/browser/fixtures/val01-fence-historical.fixture.ts');
    expect(fixture).toContain('new IndexedDbVaultStore()');
    expect(fixture).toContain('vault.clearAll()');
    expect(fixture).toContain('store.deleteRecord(');
    expect(fixture).not.toContain('versionFencedVaultStore');
  });
  test('new gate owns one mapped browser spec without duplicates',()=>{
    const r=JSON.parse(execFileSync(process.execPath,['scripts/qualification/check-reference-browser-coverage.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
    expect(r.status).toBe('REFERENCE_BROWSER_COVERAGE_PASS');
    expect(r.coverage.filter((e:any)=>e.workflow==='.github/workflows/val01-database-fence.yml')).toEqual([{workflow:'.github/workflows/val01-database-fence.yml',count:1}]);
  });
});
