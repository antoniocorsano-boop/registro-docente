// DOC-01/D4c3e2 — real IndexedDB V2 physical owner and exact encrypted V8 copies.
const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-db2.html';
async function start(page,scenario='actual-restore'){
 const response=await page.goto(url);
 expect(response?.ok()).toBe(true);
 await expect(page.locator('#status')).toContainText('Laboratorio DB2 pronto');
 return page.evaluate(s=>window.__doc01D4c3e2Owner.seed(s),scenario);
}
const op=(page,method,...args)=>page.evaluate(({method,args})=>window.__doc01D4c3e2Owner[method](...args),{method,args});
test('actual-restore: sealed prior owner, physically guarded V8 commit and fresh authenticated reopen',async({page})=>{
 const baseline=await start(page,'actual-restore');
 expect(baseline.events).toBe(1);
 const before=await op(page,'physicalDigest');
 const preview=await op(page,'prepare');
 expect(preview).toMatchObject({version:8,eventsBefore:1,eventsAfter:2,recoveryCopyVerified:true,gradesPreserved:true,assessmentsPreserved:true});
 expect(await op(page,'phase')).toBe('prepared');
 expect(await op(page,'physicalDigest')).toEqual(before);
 expect(await op(page,'oldOwnerRejected')).toBe(true);
 expect(await op(page,'confirm')).toBe('verification-required');
 expect(await op(page,'physicalDigest')).not.toEqual(before);
 await expect(op(page,'confirm')).rejects.toThrow();
 expect(await op(page,'verify')).toBe(true);
 expect(await op(page,'phase')).toBe('completed');
 expect(await op(page,'reopenSummary')).toMatchObject({events:2,historyValid:true,assessmentRevisions:8,grades:['8']});
 await op(page,'close');
});
test('cancelled: selected-file cancellation leaves DB2 current and grant unused',async({page})=>{
 await start(page,'cancelled');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'phase')).toBe('cancelled');
 expect(await op(page,'physicalDigest')).toEqual(before);
 expect(await op(page,'oldOwnerRejected')).toBe(false);
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});
test('stale-owner: foreground generation change refuses operation without sealing old owner',async({page})=>{
 await start(page,'stale-owner');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 expect(await op(page,'oldOwnerRejected')).toBe(false);
 await op(page,'close');
});
test('wrong-recovery: exact current V8 checkpoint is mandatory before physical replacement',async({page})=>{
 await start(page,'wrong-recovery');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});
test('same-epoch: no success or second physical write without fresh authenticated owner',async({page})=>{
 await start(page,'same-epoch');const before=await op(page,'physicalDigest');
 await op(page,'prepare');await op(page,'confirm');
 expect(await op(page,'physicalDigest')).not.toEqual(before);
 expect(await op(page,'verify')).toBe(false);
 expect(await op(page,'phase')).toBe('uncertain');
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});
