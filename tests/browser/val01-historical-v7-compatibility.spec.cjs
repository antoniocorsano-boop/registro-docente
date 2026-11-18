const {test,expect}=require('@playwright/test');
const path=require('node:path');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173/';
const oldBundle=path.resolve(process.env.VAL01_HISTORICAL_BUNDLE);
const newBundle=path.resolve(process.env.VAL01_CANDIDATE_BUNDLE);
test.setTimeout(60000);
async function load(page,bundle,api){
  await page.goto(baseURL);
  await page.addScriptTag({path:bundle});
  await expect.poll(()=>page.evaluate(name=>typeof window[name],api)).toBe('object');
}
const call=(page,api,method,...args)=>page.evaluate(({api,method,args})=>window[api][method](...args),{api,method,args});
const old=(page,method,...args)=>call(page,'__beta2ArchiveCompatibility',method,...args);
test('exact predecessor decrypts v7, rejects its application version, and preserves all encrypted records and logical data',async({page})=>{
  await load(page,oldBundle,'__val01HistoricalReader');
  const seeded=await old(page,'seed',false);
  expect(seeded.physical.state).toBe('ACTIVE');
  expect(seeded.physical.keys).toHaveLength(10);
  expect(seeded.physical.records).toHaveLength(10);
  await load(page,newBundle,'__val01Candidate');
  const candidate=await call(page,'__val01Candidate','make',seeded.snapshot);
  expect(candidate.payloadVersion).toBe(7);
  expect(JSON.parse(candidate.backup).version).toBe(2);
  expect(candidate.backup).not.toContain('Alunno sintetico');
  expect(candidate.snapshot.appData.classes[0].grades[0].value).toBe('9');
  expect(candidate.snapshot.appData.classes[0].assessmentEvidenceV1).toEqual(candidate.evidence);
  await load(page,oldBundle,'__val01HistoricalReader');
  const opened=await old(page,'open');
  expect(opened).toEqual({snapshot:seeded.snapshot,physical:seeded.physical});
  const decrypted=await call(page,'__val01HistoricalReader','decrypt',candidate.backup);
  expect(decrypted).toEqual({readerVersion:6,payloadVersion:7,evidence:candidate.evidence,changedGrade:'9'});
  // Use the existing restore sequence: decrypt, actual historical normalizer, actual storage restore.
  await expect(old(page,'restoreOldBackup',candidate.backup)).rejects.toThrow(/Versione dati backup non supportata: 7\./);
  expect(await old(page,'raw')).toEqual(seeded.physical);
  await old(page,'lock');
  await load(page,oldBundle,'__val01HistoricalReader');
  expect(await old(page,'open')).toEqual({snapshot:seeded.snapshot,physical:seeded.physical});
});
test('positive control: same exact predecessor accepts legitimate v6 and restores a changed synthetic archive',async({page})=>{
  await load(page,oldBundle,'__val01HistoricalReader');
  const seeded=await old(page,'seed',false);
  await old(page,'open');
  const changed=await old(page,'mutate');
  expect(changed.snapshot.appData.classes[0].grades[0].value).toBe('9');
  expect(changed.physical).not.toEqual(seeded.physical);
  const restored=await old(page,'restoreOldBackup',seeded.backup);
  expect(restored.snapshot).toEqual(seeded.snapshot);
  expect(restored.physical.keys).toEqual(seeded.physical.keys);
  expect(restored.physical.wrappedDek).toBe(seeded.physical.wrappedDek);
  await load(page,oldBundle,'__val01HistoricalReader');
  expect((await old(page,'open')).snapshot).toEqual(seeded.snapshot);
});
