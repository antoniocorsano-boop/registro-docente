// DOC-01/D4c3e5 — actual IndexedDB2 V9 physical restore, synthetic school and documents only.
const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-db2.html';
async function start(page,scenario='actual-restore'){
 const response=await page.goto(url);
 expect(response?.ok()).toBe(true);
 await expect(page.locator('#status')).toContainText('Laboratorio DB2 pronto');
 return page.evaluate(mode=>window.__doc01D4c3e5Owner.seed(mode),scenario);
}
const op=(page,method,...args)=>page.evaluate(({method,args})=>
 window.__doc01D4c3e5Owner[method](...args),{method,args});
test('V9 physical CAS: preserved grades and immutable revisions, then fresh authenticated DB2 reopen',async({page})=>{
 const baseline=await start(page);
 expect(baseline.events).toBe(1);
 const physicalBefore=await op(page,'physicalDigest');
 const preview=await op(page,'prepare');
 expect(preview).toMatchObject({version:9,eventsBefore:1,eventsAfter:2,
  gradesPreserved:true,assessmentsPreserved:true,recoveryCopyVerified:true,
  replacementRequiresConfirmation:true});
 expect(await op(page,'phase')).toBe('prepared');
 expect(await op(page,'physicalDigest')).toEqual(physicalBefore);
 expect(await op(page,'oldOwnerRejected')).toBe(true);
 expect(await op(page,'confirm')).toBe('verification-required');
 expect(await op(page,'physicalDigest')).not.toEqual(physicalBefore);
 await expect(op(page,'confirm')).rejects.toThrow();
 expect(await op(page,'verify')).toBe(true);
 expect(await op(page,'phase')).toBe('completed');
 const opened=await op(page,'reopenSummary');
 expect(opened).toMatchObject({historyValid:true,events:2,grades:baseline.grades});
 await op(page,'close');
});
test('V9 cancelled picker: no consent, no physical replacement, old owner remains valid',async({page})=>{
 await start(page,'cancelled');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'phase')).toBe('cancelled');
 expect(await op(page,'physicalDigest')).toEqual(before);
 expect(await op(page,'oldOwnerRejected')).toBe(false);
 await op(page,'close');
});
test('V9 stale foreground generation: no physical restore or old-owner revocation',async({page})=>{
 await start(page,'stale-owner');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 expect(await op(page,'oldOwnerRejected')).toBe(false);
 await op(page,'close');
});
test('V9 wrong exact recovery checkpoint: reject replacement without rollback fiction',async({page})=>{
 await start(page,'wrong-recovery');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});
test('V9 wrong school scope cannot be approved by incoming encrypted file',async({page})=>{
 await start(page,'wrong-scope');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 await op(page,'close');
});
test('V9 wrong ciphertext password must not create a DB2 grant',async({page})=>{
 await start(page,'wrong-password');const before=await op(page,'physicalDigest');
 await expect(op(page,'prepare')).rejects.toThrow();
 expect(await op(page,'physicalDigest')).toEqual(before);
 await op(page,'close');
});
test('V9 same epoch after physical commit: no false success without fresh authentication',async({page})=>{
 await start(page,'same-epoch');const before=await op(page,'physicalDigest');
 await op(page,'prepare');
 expect(await op(page,'confirm')).toBe('verification-required');
 expect(await op(page,'physicalDigest')).not.toEqual(before);
 expect(await op(page,'verify')).toBe(false);
 expect(await op(page,'phase')).toBe('uncertain');
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});

test('V9 native epoch expires while the physical CAS is blocked: old inventory survives unchanged',async({page})=>{
 await start(page);
 const baseline=await op(page,'physicalDigest');
 await op(page,'prepare');
 await op(page,'holdCas');
 await op(page,'startCommit');
 // Do not accept a preflight denial as proof of cancellation inside physical
 // CAS: wait for the actual metadata+records readwrite transaction to exist.
 await expect.poll(()=>op(page,'casTransactionReached')).toBe(true);
 expect(await op(page,'phase')).toBe('committing');
 expect(await op(page,'commitResult')).toBe('pending');
 await op(page,'expireEpoch');
 await op(page,'releaseCas');
 await expect.poll(()=>op(page,'commitResult')).toBe('rejected');
 expect(await op(page,'physicalDigest')).toEqual(baseline);
 expect(await op(page,'phase')).toBe('uncertain');
 await expect(op(page,'confirm')).rejects.toThrow();
 await op(page,'close');
});
