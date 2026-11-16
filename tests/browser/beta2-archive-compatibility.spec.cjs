const {test,expect}=require('@playwright/test');
const path=require('node:path');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173/';
const oldBundle=path.resolve(process.env.BETA1_ARCHIVE_BUNDLE);
const newBundle=path.resolve(process.env.BETA2_ARCHIVE_BUNDLE);
test.setTimeout(60000);
async function load(page,bundle){
  await page.goto(baseURL);
  await page.addScriptTag({path:bundle});
  await expect.poll(()=>page.evaluate(()=>typeof window.__beta2ArchiveCompatibility?.open)).toBe('function');
}
const invoke=(page,method,...args)=>page.evaluate(({method,args})=>window.__beta2ArchiveCompatibility[method](...args),{method,args});
test('Beta1 exact RC2 encrypted archive opens in Beta2 without rewriting any of ten records; old backup restores exactly',async({page})=>{
  await load(page,oldBundle);
  const old=await invoke(page,'seed',false);
  expect(old.physical.state).toBe('ACTIVE');
  expect(old.physical.keys).toHaveLength(10);
  expect(old.physical.records.every(r=>r.version===1&&/^[0-9a-f]{64}$/.test(r.ciphertext))).toBe(true);
  expect(JSON.parse(old.backup).version).toBe(2);
  expect(old.backup).not.toContain('Alunno sintetico');
  // Navigate within the same origin and browser profile. No import/copy/reset.
  await load(page,newBundle);
  expect(await invoke(page,'rejectWrongPassword')).toBe(true);
  expect(await invoke(page,'raw')).toEqual(old.physical);
  const opened=await invoke(page,'open');
  expect(opened.snapshot).toEqual(old.snapshot);
  expect(opened.physical).toEqual(old.physical);
  const changed=await invoke(page,'mutate');
  expect(changed.snapshot.appData.classes[0].grades[0].value).toBe('9');
  expect(changed.snapshot.meta.changes).toBe(8);
  expect(changed.physical.wrappedDek).toBe(old.physical.wrappedDek);
  expect(changed.physical.records.filter(r=>!['appData','meta'].includes(r.key))).toEqual(old.physical.records.filter(r=>!['appData','meta'].includes(r.key)));
  await load(page,newBundle);
  const reopened=await invoke(page,'open');
  expect(reopened).toEqual(changed);
  const restored=await invoke(page,'restoreOldBackup',old.backup);
  expect(restored.snapshot).toEqual(old.snapshot);
  expect(restored.physical.keys).toEqual(old.physical.keys);
  expect(restored.physical.wrappedDek).toBe(old.physical.wrappedDek);
  await load(page,newBundle);
  expect((await invoke(page,'open')).snapshot).toEqual(old.snapshot);
});
test('an existing empty Beta1 vault is not reset or filled during storage-level upgrade',async({page})=>{
  await load(page,oldBundle);
  const old=await invoke(page,'seed',true);
  expect(old.snapshot.appData.classes).toEqual([]);
  expect(old.snapshot.udas).toEqual([]);
  await load(page,newBundle);
  const opened=await invoke(page,'open');
  expect(opened).toEqual({snapshot:old.snapshot,physical:old.physical});
  expect(opened.snapshot.appData.classes).toEqual([]);
  expect(opened.snapshot.settings.school).toBe('Istituto sintetico');
});
