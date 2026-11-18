const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-db2.html';
async function attach(page){
 const r=await page.goto(url);expect(r?.ok()).toBe(true);
 await expect(page.getByText('Laboratorio DB2 pronto')).toBeVisible();
}
async function call(page,name,...args){return page.evaluate(({name,args})=>globalThis.__val01Db2Evidence[name](...args),{name,args});}
test('DB2 evidence atomic commit, cold document reopen, correction and withdrawal',async({page,context})=>{
 test.setTimeout(60000);
 await attach(page);
 const start=await call(page,'seed');expect(start).toEqual({changes:0,states:[],active:[],grades:['8'],records:4});
 const initial=await call(page,'physicalDigest');
 const a=await call(page,'commit','new');
 expect(a.summary).toEqual({changes:1,states:['observed'],active:['observed'],grades:['8'],records:5});
 const after=await call(page,'physicalDigest');
 expect(Object.keys(after).sort()).toEqual(Object.keys(initial).sort());
 expect(Object.keys(after).filter(k=>after[k]!==initial[k]).sort()).toEqual(['appData','meta']);
 await call(page,'close');await page.close();
 const reopened=await context.newPage();await attach(reopened);
 await call(reopened,'open');expect(await call(reopened,'summary')).toEqual(a.summary);
 expect(await call(reopened,'physicalDigest')).toEqual(after);
 const correction=await call(reopened,'commit','correct');expect(correction.summary.states).toEqual(['observed','not_observed']);
 const withdrawal=await call(reopened,'commit','withdraw');expect(withdrawal.summary).toEqual({changes:3,states:['observed','not_observed','withdrawn'],active:[],grades:['8'],records:7});
 await call(reopened,'close');await reopened.reload();await expect(reopened.getByText('Laboratorio DB2 pronto')).toBeVisible();
 await call(reopened,'open');expect(await call(reopened,'summary')).toEqual(withdrawal.summary);
 expect(await call(reopened,'downgrade')).toEqual({rejected:true,version:2});
 await call(reopened,'close');
});
test('actual IndexedDB abort rolls back both encrypted records, requires fresh owner, permits retry',async({page})=>{
 test.setTimeout(60000);await attach(page);const start=await call(page,'seed');
 const before=await call(page,'physicalDigest');
 const failed=await call(page,'commit','new',true);
 expect(failed).toEqual({triggered:true,rejected:true,summary:start});
 expect(await call(page,'physicalDigest')).toEqual(before);
 await call(page,'close');await call(page,'open');
 expect(await call(page,'summary')).toEqual(start);
 const retry=await call(page,'commit','new');expect(retry.summary.changes).toBe(1);expect(retry.summary.active).toEqual(['observed']);
 await call(page,'close');
});
test('DB2 exact committed backup V7 passes readback, V6 export/restore refused without physical loss',async({page})=>{
 test.setTimeout(60000);await attach(page);await call(page,'seed');await call(page,'commit','new');
 const before=await call(page,'physicalDigest');
 const backup=await call(page,'backup');
 expect(backup).toMatchObject({version:7,verified:'verified',v6Rejected:true,exact:true,changes:1});
 expect(await call(page,'physicalDigest')).toEqual(before);
 expect(await call(page,'rejectLegacy')).toEqual({rejected:true,unchanged:true});
 expect(await call(page,'physicalDigest')).toEqual(before);
 await call(page,'close');
});

test('V7 restore with exact current recovery copy appends history, rotates key and invalidates stale owner',async({page})=>{
 test.setTimeout(60000);await attach(page);await call(page,'seed');
 const before=await call(page,'physicalDigest');
 const r=await call(page,'restoreAssessment','approve');
 expect(r).toMatchObject({prepared:true,committed:true,replayRejected:true,oldOwnerRejected:true,unchanged:false,rotated:true,exact:true,summary:{changes:1,states:['observed'],active:['observed'],grades:['8'],records:5}});
 const after=await call(page,'physicalDigest');
 expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
 expect(Object.keys(after).every(k=>after[k]!==before[k])).toBe(true);
 await call(page,'close');await page.reload();await expect(page.getByText('Laboratorio DB2 pronto')).toBeVisible();
 await call(page,'open');expect(await call(page,'summary')).toEqual(r.summary);
 expect(await call(page,'physicalDigest')).toEqual(after);
 await call(page,'close');
});
test('V7 restore rejects an older copy that would remove historical evidence even with exact recovery',async({page})=>{
 test.setTimeout(60000);await attach(page);await call(page,'seed');await call(page,'commit','new');await call(page,'commit','correct');await call(page,'commit','withdraw');
 const before=await call(page,'physicalDigest'),summary=await call(page,'summary');
 const r=await call(page,'restoreAssessment','old');
 expect(r).toMatchObject({prepared:false,committed:false,unchanged:true,rotated:false,summary});
 expect(await call(page,'physicalDigest')).toEqual(before);await call(page,'close');
});
for(const mode of ['bad-recovery','wrong-scope','wrong-password','refuse','revoke','abort']){
 test('V7 restore fails closed: '+mode,async({page})=>{
  test.setTimeout(60000);await attach(page);const start=await call(page,'seed'),before=await call(page,'physicalDigest');
  const r=await call(page,'restoreAssessment',mode);
  const prepared=['refuse','revoke','abort'].includes(mode);
  expect(r).toMatchObject({prepared,committed:false,replayRejected:prepared,triggered:mode==='abort',unchanged:true,rotated:false,summary:start});
  expect(await call(page,'physicalDigest')).toEqual(before);await call(page,'close');
 });
}
test('V7 restore rejects concurrent physical write after preparation without overwriting it',async({page})=>{
 test.setTimeout(60000);await attach(page);await call(page,'seed');
 const r=await call(page,'restoreAssessment','race');
 expect(r).toMatchObject({prepared:true,committed:false,replayRejected:true,unchanged:true,rotated:false,summary:{changes:99,states:[],active:[],grades:['8'],records:4}});
 await call(page,'close');
});
test('V7 restore revocation after commit reports uncertainty but does not undo committed history',async({page})=>{
 test.setTimeout(60000);await attach(page);await call(page,'seed');
 const r=await call(page,'restoreAssessment','after-commit');
 expect(r).toMatchObject({prepared:true,committed:false,replayRejected:true,oldOwnerRejected:true,triggered:true,unchanged:false,rotated:true,exact:true,summary:{changes:1,states:['observed'],active:['observed'],grades:['8'],records:5}});
 await call(page,'close');
});
