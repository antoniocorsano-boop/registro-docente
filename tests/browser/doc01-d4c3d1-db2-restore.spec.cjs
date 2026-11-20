// DOC-01/D4c3d1 — actual Chromium IndexedDB v2, synthetic archive only.
// Physical ciphertext + CAS + cold reopen are observed, not inferred by stubs.
const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-db2.html';
async function attach(page){
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 await expect(page.getByText('Laboratorio DB2 pronto')).toBeVisible();
}
async function call(page,name,...args){return page.evaluate(({name,args})=>globalThis.__doc01Db2Restore[name](...args),{name,args});}

test('V8 DB2: physical full replacement, rotated key, exact immutable revocation and cold reopen',async({page})=>{
 test.setTimeout(90000);await attach(page);
 const start=await call(page,'seed');expect(start).toEqual({events:1,changes:1,grades:['8'],assessmentRevisions:4});
 const before=await call(page,'physicalDigest');
 const result=await call(page,'restore','approve');
 expect(result).toMatchObject({prepared:true,committed:true,replayRejected:true,oldOwnerRejected:true,
  unchanged:false,rotated:true,exact:true,assessmentPreserved:true,historyValid:true,
  summary:{events:2,changes:2,grades:['8'],assessmentRevisions:4}});
 const after=await call(page,'physicalDigest');
 expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
 expect(Object.keys(after)).toHaveLength(10);
 expect(Object.keys(after).every(k=>after[k]!==before[k])).toBe(true);
 await call(page,'close');await page.reload();
 await expect(page.getByText('Laboratorio DB2 pronto')).toBeVisible();
 await call(page,'open');
 expect(await call(page,'summary')).toEqual(result.summary);
 expect(await call(page,'physicalDigest')).toEqual(after);
 await call(page,'close');
});
for (const mode of ['old','bad-recovery','wrong-scope','wrong-password']){
 test('V8 DB2: rejects invalid encrypted recovery or loss before physical write — '+mode,async({page})=>{
  test.setTimeout(90000);await attach(page);
  const start=await call(page,'seed'),before=await call(page,'physicalDigest');
  const result=await call(page,'restore',mode);
  expect(result).toMatchObject({prepared:false,committed:false,unchanged:true,rotated:false,
   historyValid:true,assessmentPreserved:true,summary:start});
  expect(await call(page,'physicalDigest')).toEqual(before);
  await call(page,'close');
 });
}
for(const mode of ['refuse','revoke','abort']){
 test('V8 DB2: refusal, consent revocation, transaction abort preserve physical records — '+mode,async({page})=>{
  test.setTimeout(90000);await attach(page);
  const start=await call(page,'seed'),before=await call(page,'physicalDigest');
  const result=await call(page,'restore',mode);
  expect(result).toMatchObject({prepared:true,committed:false,replayRejected:true,
   triggered:mode==='abort',unchanged:true,rotated:false,historyValid:true,assessmentPreserved:true,summary:start});
  expect(await call(page,'physicalDigest')).toEqual(before);
  await call(page,'close');
 });
}
test('V8 DB2: a concurrent physical owner change invalidates the prepared one-use consent',async({page})=>{
 test.setTimeout(90000);await attach(page);await call(page,'seed');
 const result=await call(page,'restore','race');
 expect(result).toMatchObject({prepared:true,committed:false,replayRejected:true,
  unchanged:true,rotated:false,historyValid:true,assessmentPreserved:true,
  summary:{events:1,changes:99,grades:['8'],assessmentRevisions:4}});
 await call(page,'close');
});
test('V8 DB2: a late revocation never rolls back an already committed historical revision',async({page})=>{
 test.setTimeout(90000);await attach(page);await call(page,'seed');
 const result=await call(page,'restore','after-commit');
 expect(result).toMatchObject({prepared:true,committed:false,replayRejected:true,oldOwnerRejected:true,
  triggered:true,unchanged:false,rotated:true,exact:true,historyValid:true,assessmentPreserved:true,
  summary:{events:2,changes:2,grades:['8'],assessmentRevisions:4}});
 await call(page,'close');
});
