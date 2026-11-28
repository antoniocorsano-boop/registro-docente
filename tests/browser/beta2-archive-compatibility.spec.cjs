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


/** M1-B4/2: immutable ciphertext digest using a read-only IndexedDB
 * transaction. The version is discovered before opening to avoid upgrades. */
async function inspectExactPhysical(page){
 return page.evaluate(async()=>{
  const name='registro-docente-secure-vault';
  const databases=await indexedDB.databases();
  const match=databases.find(x=>x.name===name);
  if(!match||![1,2].includes(match.version))throw Error('Expected synthetic DB1/DB2');
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,match.version);
   request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Readonly open must never upgrade'));};
   request.onerror=()=>reject(request.error);
   request.onblocked=()=>reject(Error('Readonly open blocked'));
   request.onsuccess=()=>resolve(request.result);
  });
  try{
   const result=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['metadata','records'],'readonly');
    const metadata=tx.objectStore('metadata').get('current');
    const records=tx.objectStore('records').getAll();
    tx.oncomplete=()=>resolve({meta:metadata.result,rows:records.result});
    tx.onerror=tx.onabort=()=>reject(tx.error||Error('Read aborted'));
   });
   const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)))
     .map(x=>x.toString(16).padStart(2,'0')).join('');
   const meta=result.meta;
   const records=await Promise.all(result.rows.map(async r=>({
    key:r.recordKey,version:r.schemaVersion,iv:await digest(r.iv),ciphertext:await digest(r.ciphertext)
   })));
   records.sort((a,b)=>a.key.localeCompare(b.key));
   return {version:match.version,metadata:{state:meta.state,kdf:meta.kdf,salt:await digest(meta.salt),
     wrapIv:await digest(meta.wrapIv),wrappedDek:await digest(meta.wrappedDek),createdAt:meta.createdAt,updatedAt:meta.updatedAt},
     records};
  }finally{db.close();}
 });
}

/** Synthetic version fence: no record or metadata rewrites. The production
 * DB1-to-DB2 authorization and migration is qualified by a separate suite. */
async function advanceSyntheticFenceOnly(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('registro-docente-secure-vault',2);
  request.onblocked=()=>reject(Error('Historical connection not retired'));
  request.onupgradeneeded=event=>{
   const db=request.result;
   if(event.oldVersion!==1||db.objectStoreNames.length!==2||
      !db.objectStoreNames.contains('metadata')||!db.objectStoreNames.contains('records')){
    request.transaction?.abort();
   }
  };
  request.onerror=()=>reject(request.error||Error('Synthetic fence failed'));
  request.onsuccess=()=>{const version=request.result.version;request.result.close();resolve(version);};
 }));
}

test('M1-B4/2 exact predecessor V1 refuses seven operations after synthetic no-rewrite DB2 version fence',async({page})=>{
  await load(page,oldBundle);
  const seeded=await invoke(page,'seed',false);
  expect(seeded.physical.records).toHaveLength(10);
  // Navigation closes the predecessor connection before the synthetic fence.
  await page.goto(baseURL);
  const before=await inspectExactPhysical(page);
  expect(before.version).toBe(1);
  expect(before.records).toHaveLength(10);
  expect(await advanceSyntheticFenceOnly(page)).toBe(2);
  const migrated=await inspectExactPhysical(page);
  expect(migrated.version).toBe(2);
  expect({...migrated,version:1}).toEqual(before);
  for(const action of ['read','list','write','delete','clear','unlock','initialize']){
    await load(page,oldBundle);
    expect(await invoke(page,'probeHistoricalV1',action),action).toBe('VersionError');
    expect(await inspectExactPhysical(page)).toEqual(migrated);
  }
});

test('M1-B4/2 exact predecessor refuses encrypted future-version canary without altering DB1',async({page})=>{
  await load(page,oldBundle);
  const seed=await invoke(page,'seed',false);
  await load(page,oldBundle);
  expect((await invoke(page,'open')).snapshot).toEqual(seed.snapshot);
  const before=await inspectExactPhysical(page);
  const future=await invoke(page,'makeFutureV7Canary');
  expect(JSON.parse(future).version).toBe(2);
  expect(future).not.toContain('Alunno sintetico');
  await expect(invoke(page,'restoreOldBackup',future)).rejects.toThrow(/Versione dati backup non supportata: 7/);
  expect(await inspectExactPhysical(page)).toEqual(before);
  await load(page,oldBundle);
  expect((await invoke(page,'open')).snapshot).toEqual(seed.snapshot);
  expect(await inspectExactPhysical(page)).toEqual(before);
});
