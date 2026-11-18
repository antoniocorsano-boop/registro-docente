import {describe,expect,test} from 'bun:test';

const read=(path:string)=>Bun.file(new URL('../../'+path,import.meta.url)).text();

describe('VAL-01/STAB-06 qualification evidence scope',()=>{
  test('protected startup identifies its actual candidate, including pinned historical runs',async()=>{
    const workflow=await read('.github/workflows/val01-stab-bootstrap.yml');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain('github.event.pull_request.head.sha');
    expect(workflow).toContain('cacd34eae92cfc46f4d4bdb7462d1eb5e4fa8e44');
    expect(workflow).toContain('protectedBootstrap.test.ts');
    expect(workflow).toContain('val01MigrationSessionBoundary.test.ts');
    expect(workflow).toContain('val01MigrationRecoveryHandoff.test.ts');
  });

  test('native evidence is bound to candidate, predecessor and API and explicitly not release evidence',async()=>{
    const workflow=await read('.github/workflows/val01-product-native.yml');
    expect(workflow).toContain('permissions:\n  contents: read\n  actions: read');
    expect(workflow).toContain('Verify original historical artifact provenance');
    expect(workflow).toContain('Require complete product evidence for exact API and support scope');
    expect(workflow).toContain('.predecessor==$old and .candidate==$new and .api==$api and .productionRelease==false');
    expect(workflow).toContain('native-evidence/result.json');
    expect(workflow).toContain('github.event.pull_request.head.sha');
  });
});

describe('VAL-01 inherited evidence classification',()=>{
  test('driver and historical smoke retain exact-source, deterministic prerequisite and isolated native scope',async()=>{
    const driver=await read('.github/workflows/val01-stab03-driver.yml');
    const smoke=await read('.github/workflows/val01-stab04-native-smoke.yml');
    expect(driver).toContain('test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha }}"');
    expect(driver).toContain('node --test scripts/diagnostics/native-ui-driver.test.mjs');
    expect(smoke).toContain('needs: driver');
    expect(smoke).toContain('api: [32, 36]');
    expect(smoke).toContain('Verify provenance of exact original APK');
    expect(smoke).toContain('VAL01_HISTORICAL_SMOKE:');
    expect(smoke).toContain('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
  });

  test('preflight, protected session and DB2 lifecycle retain their owning browser evidence',async()=>{
    const browser=await read('tests/browser/val01-database-fence.spec.cjs');
    for(const title of [
      'D1b.4a read-only preflight refuses an absent DB without creating it',
      'D1b.4a full authenticated DB1 is classified without changing any byte or authorizing migration',
      'D1b.4b.2 existing-only DB2 reader cannot upgrade a complete DB1',
      'D1b.4b.2 retire actual DB1 owner before migration and authenticate fresh DB2 session',
      'D1b.4b.2b product Root/App/Privacy approved migration reopens only through new authentication',
      'D1b.5 actual UI restores DB2 only after approval and fresh authentication',
      'D1b.5 actual erasure closes other authenticated UI, persists DB2, and new setup requires new authentication'
    ])expect(browser).toContain(title);
  });
});
