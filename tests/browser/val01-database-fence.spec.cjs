const {test,expect}=require('@playwright/test');
const path=require('node:path');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173/';
const oldBundle=path.resolve(process.env.VAL01_FENCE_HISTORICAL_BUNDLE);
const newBundle=path.resolve(process.env.VAL01_FENCE_CANDIDATE_BUNDLE);
test.setTimeout(60000);
async function load(page,bundle,api){
  await page.goto(baseURL);
  await page.addScriptTag({path:bundle});
  await expect.poll(()=>page.evaluate(name=>typeof window[name],api)).toBe('object');
}
const call=(page,api,method,...args)=>page.evaluate(({api,method,args})=>window[api][method](...args),{api,method,args});
const old=(page,method,...args)=>call(page,'__beta2ArchiveCompatibility',method,...args);
const historic=(page,method,...args)=>call(page,'__val01FenceHistorical',method,...args);
const candidate=(page,method,...args)=>call(page,'__val01FenceCandidate',method,...args);
const loadOld=page=>load(page,oldBundle,'__val01FenceHistorical');
const loadNew=page=>load(page,newBundle,'__val01FenceCandidate');

test('D1b.3a same-origin upgrade preserves every encrypted record and rejects all historical store operations',async({page})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  expect(seed.physical.keys).toHaveLength(10);
  await loadNew(page);
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'upgrade')).toBe(2);
  expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
  const changed=await candidate(page,'mutate');
  expect(changed.snapshot.appData.classes[0].grades[0].value).toBe('9');
  expect(changed.snapshot.meta.changes).toBe(8);
  expect(changed.physical.records.filter(r=>!['appData','meta'].includes(r.key))).toEqual(seed.physical.records.filter(r=>!['appData','meta'].includes(r.key)));
  await loadOld(page);
  for(const operation of ['read','unlock','write','delete','clear','initialize']){
    expect(await historic(page,operation),operation).toBe('VersionError');
  }
  await loadNew(page);
  expect(await candidate(page,'version')).toBe(2);
  expect(await candidate(page,'open')).toEqual(changed);
});

test('D1b.3a concurrent historical connection blocks migration; rejected request cannot silently upgrade later',async({page,context})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  const next=await context.newPage();
  await loadNew(next);
  await expect(candidate(next,'upgrade')).rejects.toThrow(/bloccata/i);
  expect(await candidate(next,'version')).toBe(1);
  expect((await old(page,'open')).physical).toEqual(seed.physical);
  await page.close();
  // A queued v1 open is ordered after the blocked upgrade request. If that
  // abandoned request upgrades later, the real historical open fails.
  const retryOld=await context.newPage();
  await loadOld(retryOld);
  expect(await old(retryOld,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
  await retryOld.close();
  // A fresh candidate request in the same origin must now be able to upgrade.
  expect(await candidate(next,'upgrade')).toBe(2);
  expect(await candidate(next,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

test('D1b.3a missing archive is refused without creating an empty v2 database',async({page})=>{
  await loadNew(page);
  expect(await candidate(page,'version')).toBeNull();
  await expect(candidate(page,'upgrade')).rejects.toThrow();
  expect(await candidate(page,'version')).toBeNull();
});

test('D1b.3a incomplete historical archive aborts the upgrade transaction and remains v1',async({page})=>{
  await loadOld(page);
  await old(page,'seed',false);
  await historic(page,'removeFixtureRecord');
  await loadNew(page);
  await expect(candidate(page,'upgrade')).rejects.toThrow();
  expect(await candidate(page,'version')).toBe(1);
  await loadOld(page);
  expect(await historic(page,'read')).toBe('ACCEPTED');
});

test('D1b.3b authenticated local copy plus explicit one-use approval preserves all ten records',async({page})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  await loadNew(page);
  const grant=await candidate(page,'prepareMigration',seed.backup);
  expect(grant).toMatchObject({payloadVersion:6,sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(grant.bytes).toBe(Buffer.byteLength(seed.backup));
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'migrate')).toBe(2);
  await expect(candidate(page,'migrate')).rejects.toThrow();
  expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

test('D1b.3b wrong passwords, corrupt copy, cancellation and cloned grant cannot upgrade DB1',async({page})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  await loadNew(page);
  for(const args of [[seed.backup,true,false],[seed.backup,false,true],[seed.backup.slice(0,-10),false,false]]){
    await expect(candidate(page,'prepareMigration',...args)).rejects.toThrow();
    expect(await candidate(page,'version')).toBe(1);
  }
  await candidate(page,'prepareMigration',seed.backup);
  await expect(candidate(page,'migrate',false)).rejects.toThrow();
  await candidate(page,'prepareMigration',seed.backup);
  await expect(candidate(page,'migrate',true,true)).rejects.toThrow();
  await candidate(page,'prepareMigration',seed.backup);
  await candidate(page,'invalidateMigration');
  await expect(candidate(page,'migrate')).rejects.toThrow();
  expect(await candidate(page,'version')).toBe(1);
  await loadOld(page);
  expect(await old(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

test('D1b.3b changed archive between verification and upgrade cannot migrate on stale consent',async({page,context})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  await loadNew(page);
  await candidate(page,'prepareMigration',seed.backup);
  const writer=await context.newPage();
  await loadOld(writer);
  await old(writer,'open');
  const changed=await old(writer,'mutate');
  await writer.close();
  await expect(candidate(page,'migrate')).rejects.toThrow();
  expect(await candidate(page,'version')).toBe(1);
  await expect(candidate(page,'prepareMigration',seed.backup)).rejects.toThrow();
  await loadOld(page);
  expect(await old(page,'open')).toEqual(changed);
});

test('D1b.3b blocked authorization cannot upgrade later or be replayed',async({page,context})=>{
  await loadOld(page);
  const seed=await old(page,'seed',false);
  const next=await context.newPage();
  await loadNew(next);
  await candidate(next,'prepareMigration',seed.backup);
  await expect(candidate(next,'migrate')).rejects.toThrow(/bloccata/i);
  await page.close();
  const oldAgain=await context.newPage();
  await loadOld(oldAgain);
  expect(await old(oldAgain,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
  await oldAgain.close();
  await expect(candidate(next,'migrate')).rejects.toThrow();
  expect(await candidate(next,'version')).toBe(1);
  await candidate(next,'prepareMigration',seed.backup);
  expect(await candidate(next,'migrate')).toBe(2);
});
