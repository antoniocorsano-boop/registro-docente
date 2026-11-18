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
