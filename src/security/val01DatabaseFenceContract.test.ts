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

describe('VAL-01/D1b.3b authorized migration contract',()=>{
  test('actual browser gate covers the authorized path and no production entrypoint imports it',async()=>{
    const spec=await read('tests/browser/val01-database-fence.spec.cjs');
    for(const name of ['authenticated local copy plus explicit one-use approval','wrong passwords, corrupt copy','changed archive between verification and upgrade','blocked authorization cannot upgrade later'])expect(spec).toContain(name);
    const fixture=await read('tests/browser/fixtures/val01-fence-candidate.fixture.ts');
    expect(fixture).toContain('createAuthorizedVaultMigration()');
    const auth=await read('src/security/authorizedVaultMigration.ts');
    for(const required of ['decryptJsonRecord','decryptDataWithPassword','inspectAssessmentBackupPayload','pending=null','confirmed!==true','same(checked(m,r),physical)','tx.abort()'])expect(auth).toContain(required);
    const app=await read('src/App.tsx');
    expect(app).not.toContain('authorizedVaultMigration');
    expect(app).not.toContain('versionFencedVaultStore');
  });
});

describe('VAL-01/D1b.3c isolated Android laboratory contract',()=>{
  test('native gate builds two isolated APKs with exact historical source, actual SAF and downgrade',async()=>{
    const w=await read('.github/workflows/val01-native-migration.yml');
    for(const text of ['it.trama.registrodocente.lab.val01','37c61d4c64993c986a3edcd2b421310adf20de92','b726f4a6dc0eb90a066113bee7cceabf29c629a5','ddbf60781514b866b09e1fa1e014e6a6fc3989d3','assembleDebug','ReactiveCircus/android-emulator-runner@','api-level: 36','productionRelease==false'])expect(w).toContain(text);
    expect(w).not.toMatch(/assembleRelease|push:\s|secrets\./);
    const script=await read('scripts/diagnostics/val01-native-migration.mjs');
    for(const text of ['ro.kernel.qemu','/sdcard/Download/','native-picker-cancel-no-migration','native-wrong-copy-password-no-migration','native-explicit-refusal-no-migration','native-authorized-migration-and-replay-rejection','native-v2-cold-reopen',"['-r','-d']", "'VersionError'",'native-reupgrade-archive-intact'])expect(script).toContain(text);
    const fixture=await read('mobile/android-probe/val01-native-lab.fixture.ts');
    for(const text of ['readEncryptedBackupOnAndroid(active)','saveEncryptedBackupOnAndroid','migration.prepare(password,new Blob([text])','migration.migrate(grant,confirmed)'])expect(fixture).toContain(text);
    expect(await read('src/App.tsx')).not.toContain('val01-native-lab.fixture');
  });
});

describe('VAL-01/D1b.3c integral historical binaries',()=>{
  test('original APK provenance, isolated ephemeral signing and real legacy UI are mandatory',async()=>{
    const workflow=await read('.github/workflows/val01-integral-android.yml');
    for(const t of ['13938285055','13950428737','14200343425','actions/download-artifact@v4','original_unsigned_sha256','names(a)==names(b)','application-debuggable','debug.keystore','Destroy signed laboratory APKs and key','original-downgrade-ui-fail-closed','VAL01_INTEGRAL'])expect(workflow).toContain(t);
    expect(workflow).not.toMatch(/assembleRelease|push:\s|secrets\./);
    const script=await read('scripts/diagnostics/val01-native-migration.mjs');
    for(const t of ['seedOriginal(oldVersion)','inspectHistoricalArchive','Sicurezza non disponibile','Riprova controllo sicurezza','original-downgrade-ui-fail-closed','ro.kernel.qemu','Expected']) {
      if(t!=='Expected')expect(script).toContain(t);
    }
    const fixture=await read('mobile/android-probe/val01-native-lab.fixture.ts');
    for(const t of ['Expected existing DB1','vault.lock();await store.release()','Collaudo migrazione VAL01','withoutLocalBackupVerification'])expect(fixture).toContain(t);
  });
});

describe('VAL-01/D1b.3c support boundary approved 2026-11-17',()=>{
  test('retired RC2 is a mandatory negative case, not a skipped or successful migration',async()=>{
    const workflow=await read('.github/workflows/val01-integral-android.yml');
    for(const value of ['--argjson version "$OLD_VERSION"','$version==10002','.qualification=="negative-only"','unsupported-sparse-archive-refused-without-mutation','unsupported-sparse-original-reopen','$version==10003 or $version==10004','.qualification=="supported-migration"','else false end','all(.results[];.status=="PASS")'])expect(workflow).toContain(value);
    expect(workflow).not.toContain('continue-on-error:');
    const script=await read('scripts/diagnostics/val01-native-migration.mjs');
    for(const value of ["assert.deepEqual(inventory.present,['appData','meta'])","assert.deepEqual(await lab('rejectSparseFence'),{blocked:true,guardReached:false})","assert.equal(await lab('historicalFingerprint'),before)","assert.equal(await candidate('version'),1)","assert.deepEqual(await lab('probeHistoricalArchive'),inventory)","stage('unsupported-sparse-original-reopen'","Supported historical DB1 has missing physical records; no migration allowed"])expect(script).toContain(value);
    const fixture=await read('mobile/android-probe/val01-native-lab.fixture.ts');
    for(const value of ["db.transaction(['metadata','records'],'readonly')","metadata.getAllKeys()","records.getAllKeys()","request.onupgradeneeded=()=>request.transaction?.abort()","!guardReached)blocked=true","guardReached=true"])expect(fixture).toContain(value);
    const strict=await read('src/security/versionFencedVaultStore.ts');
    expect(strict).toContain('values.length===KEYS.length');
    expect(strict).toContain('!validRecords(encrypted.result)');
    const auth=await read('src/security/authorizedVaultMigration.ts');
    expect(auth).toContain('!validRecords(records)');
    // Exact RC2 source, historical backup and complete-storage downgrade coverage stay active.
    for(const path of ['.github/workflows/val01-database-fence.yml','.github/workflows/val01-native-migration.yml','.github/workflows/val01-historical-v7-compatibility.yml'])expect(await read(path)).toContain('37c61d4c64993c986a3edcd2b421310adf20de92');
  });
});
