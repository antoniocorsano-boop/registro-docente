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
