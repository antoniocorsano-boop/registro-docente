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

test('D1b.4a read-only preflight refuses an absent DB without creating it',async({page})=>{
  await loadNew(page);
  expect(await candidate(page,'version')).toBeNull();
  expect(await candidate(page,'preflight')).toBe('unverifiable');
  expect(await candidate(page,'version')).toBeNull();
});

test('D1b.4a full authenticated DB1 is classified without changing any byte or authorizing migration',async({page})=>{
  await loadOld(page);await old(page,'seed',false);
  await loadNew(page);
  const before=await candidate(page,'preflightInventory');
  expect(await candidate(page,'preflight')).toBe('complete');
  expect(await candidate(page,'preflight',true)).toBe('unverifiable');
  expect(await candidate(page,'preflight',false,true)).toBe('unverifiable');
  await expect(candidate(page,'migrate')).rejects.toThrow();
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'preflightInventory')).toBe(before);
});

test('D1b.4a authentic sparse DB1 is not complete and remains byte-identical',async({page})=>{
  await loadOld(page);await old(page,'seed',false);
  await loadNew(page);
  const before=await candidate(page,'preflightInventory','sparse');
  expect(await candidate(page,'preflight')).toBe('incomplete');
  expect(await candidate(page,'preflight',true)).toBe('unverifiable');
  expect(await candidate(page,'preflightInventory')).toBe(before);
  expect(await candidate(page,'version')).toBe(1);
});

for(const anomaly of ['unknown','tamper','metadata','record-shape']){
  test('D1b.4a '+anomaly+' is unverifiable and remains unchanged',async({page})=>{
    await loadOld(page);await old(page,'seed',false);
    await loadNew(page);
    const before=await candidate(page,'preflightInventory',anomaly);
    expect(await candidate(page,'preflight')).toBe('unverifiable');
    expect(await candidate(page,'preflightInventory')).toBe(before);
    expect(await candidate(page,'version')).toBe(1);
  });
}

test('D1b.4a already upgraded DB2 is not interpreted as an empty DB1',async({page})=>{
  await loadOld(page);const seed=await old(page,'seed',false);
  await loadNew(page);await candidate(page,'upgrade');
  expect(await candidate(page,'preflight')).toBe('unverifiable');
  expect(await candidate(page,'version')).toBe(2);
  expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

test('D1b.4b local session adapter uses the real fence and preserves all ciphertext',async({page})=>{
  await loadOld(page);const seed=await old(page,'seed',false);
  await loadNew(page);
  expect(await candidate(page,'runSessionMigration',seed.backup,'approve')).toEqual({result:'migrated-reopen-required',sealed:true,version:2});
  expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

for(const mode of ['refuse','revoke','wrong-copy']){
  test('D1b.4b '+mode+' leaves real DB1 byte-identical and admission sealed',async({page})=>{
    await loadOld(page);const seed=await old(page,'seed',false);
    await loadNew(page);
    const before=await candidate(page,'preflightInventory');
    expect(await candidate(page,'runSessionMigration',seed.backup,mode)).toEqual({
      result:mode==='wrong-copy'?'blocked-reopen-required':'cancelled-reopen-required',sealed:true,version:1
    });
    expect(await candidate(page,'preflightInventory')).toBe(before);
  });
}

test('D1b.4b.2 existing-only readers never create an absent archive, even if retired while opening',async({page})=>{
  await loadNew(page);
  for(const version of [1,2]){
    expect(await candidate(page,'verifyExisting',version)).toBe(false);
    expect(await candidate(page,'version')).toBeNull();
    expect(await candidate(page,'retireDuringOpen',version)).toMatchObject({rejected:true});
    await expect.poll(()=>candidate(page,'version')).toBeNull();
  }
});

test('D1b.4b.2 existing-only DB2 reader cannot upgrade a complete DB1',async({page})=>{
  await loadOld(page);await old(page,'seed',false);
  await loadNew(page);
  const before=await candidate(page,'preflightInventory');
  expect(await candidate(page,'verifyExisting',1)).toBe(true);
  expect(await candidate(page,'verifyExisting',2)).toBe(false);
  expect(await candidate(page,'retireDuringOpen',2)).toMatchObject({rejected:true});
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'preflightInventory')).toBe(before);
});

test('D1b.4b.2 retire actual DB1 owner before migration and authenticate fresh DB2 session',async({page})=>{
  await loadOld(page);const seed=await old(page,'seed',false);
  await loadNew(page);
  expect(await candidate(page,'migrateWithOwnedConnection',seed.backup)).toEqual({
    result:'migrated-reopen-required',retired:true,version:2,snapshot:seed.snapshot
  });
  expect(await candidate(page,'verifyExisting',1)).toBe(false);
  expect(await candidate(page,'verifyExisting',2,true)).toBe(false);
  expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
});

for(const anomaly of ['sparse','unknown','tamper','metadata','record-shape']){
  test('D1b.4b.2 '+anomaly+' DB2 is refused without reset or byte changes',async({page})=>{
    await loadOld(page);await old(page,'seed',false);
    await loadNew(page);
    await candidate(page,'upgrade');
    const before=await candidate(page,'preflightInventory',anomaly,2);
    expect(await candidate(page,'verifyExisting',2)).toBe(false);
    expect(await candidate(page,'version')).toBe(2);
    expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
  });
}

const productOrigin=process.env.VAL01_PRODUCT_ORIGIN;
const productSeed=()=>productOrigin+'/tests/browser/fixtures/val01-product-seed.html';
const productApp=()=>productOrigin+'/tests/browser/fixtures/val01-product-session.html';
async function seedProduct(page){
  if(!productOrigin)throw Error('Missing isolated product origin');
  await page.setViewportSize({width:390,height:844});
  await page.goto(productSeed());
  await page.addScriptTag({path:oldBundle});
  const seed=await old(page,'seed',false);
  await page.goto(productApp());
  return seed;
}
async function unlockProduct(page,password='synthetic-archive-compatibility-only'){
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  await page.getByLabel('Password locale',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sblocca Registro',exact:true}).click();
  await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:15000});
}
async function privacyProduct(page){
  await page.getByRole('button',{name:'Apri navigazione del Registro'}).click();
  await page.getByRole('button',{name:'Privacy',exact:true}).click();
}
async function selectProductCopy(page,backup){
  const panel=page.getByRole('region',{name:'Aggiornamento protetto archivio'});
  await expect(panel).toBeVisible();
  await panel.locator('input[type=file]').setInputFiles({name:'synthetic.enc.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await expect(panel.getByLabel('Password locale',{exact:true})).toBeVisible();
  return panel;
}
async function physicalAfterProduct(page,expectedVersion,seed){
  await page.goto(productSeed());
  await page.addScriptTag({path:newBundle});
  expect(await candidate(page,'version')).toBe(expectedVersion);
  if(expectedVersion===2)expect(await candidate(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
  else{
    await page.goto(productSeed());await page.addScriptTag({path:oldBundle});
    expect(await old(page,'open')).toEqual({snapshot:seed.snapshot,physical:seed.physical});
  }
}

test('D1b.4b.2b product Root/App/Privacy approved migration reopens only through new authentication',async({page})=>{
  test.setTimeout(120000);
  const seed=await seedProduct(page);
  await unlockProduct(page);await privacyProduct(page);
  const panel=await selectProductCopy(page,seed.backup);
  await panel.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await panel.getByLabel('Password della copia',{exact:true}).fill('synthetic-archive-backup-only');
  let confirmations=0;
  page.on('dialog',async dialog=>{if(dialog.message().includes('La copia è stata verificata')){confirmations++;await dialog.accept();}else await dialog.dismiss();});
  await panel.getByRole('button',{name:'Verifica e aggiorna archivio'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  expect(confirmations).toBe(1);
  await expect(page.getByText('Archivio aggiornato. Autenticati per verificarlo e riaprire il Registro.')).toBeVisible();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await unlockProduct(page);
  await privacyProduct(page);
  await expect(page.getByRole('region',{name:'Aggiornamento protetto archivio'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reset Totale Sicuro'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Ripristino protetto archivio'})).toBeVisible();
  await page.reload();await unlockProduct(page);
  await physicalAfterProduct(page,2,seed);
});

for(const mode of ['refuse','wrong-copy']){
  test('D1b.4b.2b actual application '+mode+' preserves original DB1 and requires a new session',async({page})=>{
    test.setTimeout(120000);
    const seed=await seedProduct(page);
    await unlockProduct(page);await privacyProduct(page);
    const panel=await selectProductCopy(page,seed.backup);
    await panel.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
    await panel.getByLabel('Password della copia',{exact:true}).fill(mode==='wrong-copy'?'wrong':'synthetic-archive-backup-only');
    let confirmations=0;
    page.on('dialog',async dialog=>{if(dialog.message().includes('La copia è stata verificata'))confirmations++;await dialog.dismiss();});
    await panel.getByRole('button',{name:'Verifica e aggiorna archivio'}).click();
    await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
    expect(confirmations).toBe(mode==='refuse'?1:0);
    await expect(page.getByText('Aggiornamento non completato. Autenticati per riaprire il Registro.')).toBeVisible();
    await unlockProduct(page);await physicalAfterProduct(page,1,seed);
  });
}

test('D1b.4b.2b manual lock invalidates selected copy and normal entrypoint does not enable candidate',async({page})=>{
  test.setTimeout(120000);
  const seed=await seedProduct(page);
  await unlockProduct(page);await privacyProduct(page);
  await selectProductCopy(page,seed.backup);
  await page.getByTestId('header01-lock').click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await unlockProduct(page);await privacyProduct(page);
  await expect(page.getByRole('region',{name:'Aggiornamento protetto archivio'}).getByLabel('Password locale',{exact:true})).toHaveCount(0);
  await physicalAfterProduct(page,1,seed);
  await page.goto(productOrigin+'/');await unlockProduct(page);await privacyProduct(page);
  await expect(page.getByRole('region',{name:'Aggiornamento protetto archivio'})).toHaveCount(0);
});

async function seedDb2(page){
  await loadOld(page);const seed=await old(page,'seed',false);
  await loadNew(page);await candidate(page,'upgrade');
  return seed;
}
test('D1b.5 lifecycle refuses absent DB and DB1 without creating or upgrading them',async({page})=>{
  await loadNew(page);
  expect(await candidate(page,'db2State')).toBe('unverifiable');
  expect(await candidate(page,'db2Lifecycle','setup')).toEqual({result:'prepare-rejected',state:'unverifiable'});
  expect(await candidate(page,'version')).toBeNull();
  await loadOld(page);await old(page,'seed',false);await loadNew(page);
  const before=await candidate(page,'preflightInventory');
  expect(await candidate(page,'db2Lifecycle','erase')).toEqual({result:'prepare-rejected',state:'unverifiable'});
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'preflightInventory')).toBe(before);
});

test('D1b.5 restore rotates the key and replaces all ten records; stale writer and replay are rejected',async({page})=>{
  await seedDb2(page);
  const before=await candidate(page,'open');
  const copy=await candidate(page,'db2ChangedCopy');
  expect(await candidate(page,'db2Lifecycle','restore',copy)).toEqual({result:'committed',state:'active',replay:true,staleRejected:true,version:2});
  await loadNew(page);
  const after=await candidate(page,'open');
  expect(after.physical.salt).not.toBe(before.physical.salt);
  expect(after.physical.wrappedDek).not.toBe(before.physical.wrappedDek);
  expect(after.physical.records.every(r=>r.ciphertext!==before.physical.records.find(p=>p.key===r.key).ciphertext)).toBe(true);
  expect(after.snapshot.appData.classes).toEqual([]);
  expect(after.snapshot.meta).toEqual({changes:19,lastBackup:null});
  expect(await candidate(page,'db2Read')).toEqual(after.snapshot);
  await loadOld(page);
  for(const operation of ['read','unlock','write','delete','clear','initialize'])expect(await historic(page,operation)).toBe('VersionError');
});

for(const [action,mode] of [['restore','wrong-copy'],['restore','wrong-vault'],['restore','refuse'],['restore','revoke'],['erase','wrong-vault'],['erase','refuse'],['erase','revoke']]){
  test('D1b.5 '+action+' '+mode+' preserves every original byte',async({page})=>{
    const seed=await seedDb2(page);
    const before=await candidate(page,'preflightInventory',null,2);
    expect(await candidate(page,'db2Lifecycle',action,seed.backup,mode)).toEqual({
      result:mode.startsWith('wrong')?'prepare-rejected':'commit-rejected',state:'active'
    });
    expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
    expect(await candidate(page,'db2Read')).toEqual(seed.snapshot);
  });
}

test('D1b.5 changed physical inventory invalidates previously prepared replacement',async({page})=>{
  const seed=await seedDb2(page);
  expect(await candidate(page,'db2Lifecycle','restore',seed.backup,'race')).toEqual({result:'commit-rejected',state:'active'});
  const after=await candidate(page,'db2Read');
  expect(after.meta.changes).toBe(999);
  expect(after.appData).toEqual(seed.snapshot.appData);
});

test('D1b.5 explicit erasure retains version fence and removes records/key; fresh setup needs new authorization',async({page})=>{
  await seedDb2(page);
  expect(await candidate(page,'db2Lifecycle','setup')).toEqual({result:'prepare-rejected',state:'active'});
  expect(await candidate(page,'db2Lifecycle','erase')).toEqual({result:'committed',state:'erased',replay:true,staleRejected:true,version:2});
  const erased=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('registro-docente-secure-vault',2);req.onupgradeneeded=()=>req.transaction.abort();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['metadata','records'],'readonly'),m=tx.objectStore('metadata').getAll(),r=tx.objectStore('records').getAll();
      tx.oncomplete=()=>resolve({metadata:m.result,records:r.result,version:db.version});tx.onabort=tx.onerror=()=>reject(tx.error);
    });}finally{db.close();}
  });
  expect(erased).toEqual({metadata:[{kind:'ERASED_DB2',nonce:expect.stringMatching(/^[a-f0-9]{32}$/)}],records:[],version:2});
  await loadOld(page);
  for(const operation of ['read','unlock','write','delete','clear','initialize'])expect(await historic(page,operation)).toBe('VersionError');
  await loadNew(page);
  expect(await candidate(page,'db2State')).toBe('erased');
  expect(await candidate(page,'verifyExisting',2)).toBe(false);
  expect(await candidate(page,'db2Lifecycle','setup',null,'refuse')).toEqual({result:'commit-rejected',state:'erased'});
  expect(await candidate(page,'db2Lifecycle','setup')).toMatchObject({result:'committed',state:'active',replay:true,version:2});
  expect(await candidate(page,'verifyExisting',2)).toBe(false);
  const fresh=await candidate(page,'db2Read',true);
  expect(fresh.appData.classes).toEqual([]);
  expect(fresh.settings.archiveMode).toBe('professional');
  expect(fresh.meta).toEqual({changes:0,lastBackup:null});
  await loadNew(page);
  expect(await candidate(page,'db2Read',true)).toEqual(fresh);
});

for(const action of ['restore','erase']){
  test('D1b.5 '+action+' interrupted during transaction rolls back the complete physical image',async({page})=>{
    const seed=await seedDb2(page);
    const before=await candidate(page,'preflightInventory',null,2);
    expect(await candidate(page,'db2Interrupt',action,seed.backup,'before-commit')).toEqual({triggered:true,rejected:true,state:'active',version:2});
    expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
    expect(await candidate(page,'db2Read')).toEqual(seed.snapshot);
  });
  test('D1b.5 '+action+' revoked after commit is inspected without rolling back or resurrecting data',async({page})=>{
    await seedDb2(page);
    const before=await candidate(page,'preflightInventory',null,2);
    const copy=await candidate(page,'db2ChangedCopy');
    expect(await candidate(page,'db2Interrupt',action,copy,'after-commit')).toEqual({triggered:true,rejected:true,state:action==='erase'?'erased':'active',version:2});
    await loadNew(page);
    if(action==='erase')expect(await candidate(page,'db2State')).toBe('erased');
    else{
      expect(await candidate(page,'preflightInventory',null,2)).not.toBe(before);
      expect((await candidate(page,'db2Read')).appData.classes).toEqual([]);
    }
  });
}

test('D1b.5 an authenticated second tab cannot reintroduce erased or restored data',async({page,context})=>{
  await seedDb2(page);
  const second=await context.newPage();
  await loadNew(second);
  expect(await candidate(second,'db2HoldWriter')).toBe(true);
  expect(await candidate(page,'db2Lifecycle','erase')).toMatchObject({result:'committed',state:'erased'});
  expect(await candidate(page,'db2Lifecycle','setup')).toMatchObject({result:'committed',state:'active'});
  expect(await candidate(second,'db2TryHeldWrite')).toBe('rejected');
  expect((await candidate(page,'db2Read',true)).meta).toEqual({changes:0,lastBackup:null});
  await second.close();
});

test('D1b.5 unsupported v7, legacy and incomplete v6 restore candidates remain unchanged',async({page})=>{
  await seedDb2(page);
  const before=await candidate(page,'preflightInventory',null,2);
  for(const format of ['v7','legacy','partial']){
    const copy=await candidate(page,'db2ChangedCopy',format);
    expect(await candidate(page,'db2Lifecycle','restore',copy)).toEqual({result:'prepare-rejected',state:'active'});
    expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
  }
});

async function productDb2(page){
  const seed=await seedProduct(page);
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  await candidate(page,'upgrade');
  const changedCopy=await candidate(page,'db2ChangedCopy');
  const before=await candidate(page,'preflightInventory',null,2);
  await page.goto(productApp());await unlockProduct(page);await privacyProduct(page);
  return {seed,changedCopy,before};
}
const restorePanel=page=>page.getByRole('region',{name:'Ripristino protetto archivio'});
async function submitProductRestore(page,copy,copyPassword){
  const panel=restorePanel(page);
  await panel.locator('input[type=file]').setInputFiles({name:'synthetic.enc.json',mimeType:'application/json',buffer:Buffer.from(copy)});
  await panel.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await panel.getByLabel('Password della copia',{exact:true}).fill(copyPassword);
  await panel.getByRole('button',{name:'Verifica e ripristina archivio'}).click();
}
async function submitProductErase(page){
  const panel=restorePanel(page);
  await panel.getByRole('button',{name:'Prepara cancellazione'}).click();
  await panel.getByLabel('Password locale per cancellazione').fill('synthetic-archive-compatibility-only');
  await expect(panel.getByRole('button',{name:'Verifica e cancella archivio locale'})).toBeDisabled();
  await panel.getByLabel('Scrivi CANCELLA per proseguire').fill('CANCELLA');
  await panel.getByRole('button',{name:'Verifica e cancella archivio locale'}).click();
}
async function readProductDb2(page,newPassword=false){
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  return candidate(page,'db2Read',newPassword);
}

test('D1b.5 actual UI restores DB2 only after approval and fresh authentication',async({page})=>{
  test.setTimeout(120000);
  const {changedCopy}=await productDb2(page);
  let confirmed=0;
  page.on('dialog',async d=>{if(d.message().includes('Sostituire tutti i dati attuali')){confirmed++;await d.accept();}else await d.dismiss();});
  await submitProductRestore(page,changedCopy,'synthetic-archive-backup-only');
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  expect(confirmed).toBe(1);
  await expect(page.getByText('Archivio ripristinato. Autenticati per riaprire il Registro.')).toBeVisible();
  await unlockProduct(page);
  await page.reload();await unlockProduct(page);
  const snapshot=await readProductDb2(page);
  expect(snapshot.appData.classes).toEqual([]);
  expect(snapshot.meta).toEqual({changes:19,lastBackup:null});
});

for(const mode of ['refuse','wrong-copy','erase-refuse']){
  test('D1b.5 actual UI '+mode+' preserves DB2 and returns to protected gate',async({page})=>{
    test.setTimeout(120000);
    const {changedCopy,before}=await productDb2(page);
    let confirmations=0;
    page.on('dialog',async d=>{confirmations++;await d.dismiss();});
    if(mode==='erase-refuse')await submitProductErase(page);
    else await submitProductRestore(page,changedCopy,mode==='wrong-copy'?'wrong':'synthetic-archive-backup-only');
    await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
    expect(confirmations).toBe(mode==='wrong-copy'?0:1);
    await unlockProduct(page);
    await page.goto(productSeed());await page.addScriptTag({path:newBundle});
    expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
  });
}

test('D1b.5 actual erasure closes other authenticated UI, persists DB2, and new setup requires new authentication',async({page,context})=>{
  test.setTimeout(120000);
  await productDb2(page);
  const other=await context.newPage();
  // A new Playwright page has its own viewport. The primary page was set to
  // 390px by seedProduct, but the second page defaults to desktop. Exercise
  // the same actual mobile authentication surface, without relaxing checks.
  await other.setViewportSize({width:390,height:844});
  await other.bringToFront();
  await other.goto(productApp());await unlockProduct(other);
  await expect(other.getByRole('heading',{name:'Oggi',exact:true})).toBeVisible();
  // The operation must be authorized by the foreground owner, not a hidden tab.
  await page.bringToFront();
  await expect.poll(()=>page.evaluate(()=>document.visibilityState)).toBe('visible');
  let confirmed=0;
  page.on('dialog',async d=>{if(d.message().includes('Cancellare tutti i dati e la chiave')){confirmed++;await d.accept();}else await d.dismiss();});
  await submitProductErase(page);
  await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible({timeout:30000});
  expect(confirmed).toBe(1);
  await expect(page.getByText('Archivio locale cancellato. Configura un nuovo archivio. Le copie esterne non sono state cancellate.')).toBeVisible();
  // On return to the second tab, a stale authenticated surface must not
  // remain available; verify the protected gate before closing the tab.
  await other.bringToFront();
  await expect(other.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible({timeout:30000});
  await expect(other.getByTestId('header01-topbar')).toHaveCount(0);
  await expect(other.getByRole('heading',{name:'Oggi',exact:true})).toHaveCount(0);
  await other.close();
  await page.bringToFront();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
  await page.getByRole('radio',{name:/Archivio professionale/}).check();
  await page.getByLabel('Istituto',{exact:true}).fill('Synthetic school');
  await page.getByLabel('Anno scolastico',{exact:true}).fill('2026/2027');
  await page.getByLabel('Docente',{exact:true}).fill('Synthetic teacher');
  await page.getByLabel('Disciplina',{exact:true}).fill('Tecnologia');
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-new-password');
  await page.getByRole('button',{name:'Crea il mio registro'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  await expect(page.getByText('Nuovo archivio creato. Autenticati con la nuova password.')).toBeVisible();
  await unlockProduct(page,'synthetic-new-password');
  const fresh=await readProductDb2(page,true);
  expect(fresh.appData.classes).toEqual([]);
  expect(fresh.settings.archiveMode).toBe('professional');
  expect(fresh.meta).toEqual({changes:0,lastBackup:null});
  expect(await candidate(page,'version')).toBe(2);
  await page.goto(productSeed());await page.addScriptTag({path:oldBundle});
  expect(await historic(page,'initialize')).toBe('VersionError');
});

for(const signal of ['broadcast','durable-polling']){
  test('D1b.5 locked observer '+signal+' recognizes erasure and later setup without reload',async({page,context})=>{
    test.setTimeout(120000);
    await productDb2(page);
    const other=await context.newPage();
    await other.setViewportSize({width:390,height:844});
    if(signal==='durable-polling')await other.addInitScript(()=>Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true}));
    await other.bringToFront();await other.goto(productApp());await unlockProduct(other);
    await other.getByTestId('header01-lock').click();
    await expect(other.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
    await other.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
    await page.bringToFront();
    await expect.poll(()=>page.evaluate(()=>document.visibilityState)).toBe('visible');
    page.on('dialog',async d=>{if(d.message().includes('Cancellare tutti i dati e la chiave'))await d.accept();else await d.dismiss();});
    await submitProductErase(page);
    await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible({timeout:30000});
    await other.bringToFront();
    await expect(other.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible({timeout:30000});
    await expect(other.getByRole('heading',{name:'Sblocca Registro'})).toHaveCount(0);
    await expect(other.getByLabel('Password locale',{exact:true})).toHaveCount(0);
    await expect(other.getByTestId('header01-topbar')).toHaveCount(0);
    // A fresh setup elsewhere must invalidate the stale erased form as well.
    await other.getByRole('radio',{name:/Ambiente dimostrativo/}).check();
    await other.getByLabel('Password locale',{exact:true}).fill('synthetic-unused-password');
    await page.bringToFront();
    await page.getByRole('radio',{name:/Archivio professionale/}).check();
    await page.getByLabel('Istituto',{exact:true}).fill('Synthetic school');
    await page.getByLabel('Anno scolastico',{exact:true}).fill('2026/2027');
    await page.getByLabel('Docente',{exact:true}).fill('Synthetic teacher');
    await page.getByLabel('Disciplina',{exact:true}).fill('Tecnologia');
    await page.getByLabel('Password locale',{exact:true}).fill('synthetic-new-password');
    await page.getByRole('button',{name:'Crea il mio registro'}).click();
    await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
    await other.bringToFront();
    await expect(other.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
    await expect(other.getByLabel('Password locale',{exact:true})).toHaveValue('');
    await expect(other.getByRole('heading',{name:'Configura archivio protetto'})).toHaveCount(0);
    await unlockProduct(other,'synthetic-new-password');
    await other.close();await page.bringToFront();
    const fresh=await readProductDb2(page,true);
    expect(fresh.appData.classes).toEqual([]);
    expect(fresh.settings.archiveMode).toBe('professional');
    expect(fresh.meta).toEqual({changes:0,lastBackup:null});
    expect(await candidate(page,'version')).toBe(2);
  });
}

/** Test-only observation of the real guarded versionchange transaction.
 * The authorization service registers its completion listener only after
 * checking the complete physical inventory and arming abort on revocation.
 * No application injection port, no fabricated migration result. */
async function armOriginalMigrationInterruption(page,cut){
  await page.evaluate(cut=>{
    const original=IDBTransaction.prototype.addEventListener;
    const trace={guardReached:0,aborted:0,completed:0,revoked:0};
    window.__val01MigrationCut=trace;
    IDBTransaction.prototype.addEventListener=function(type,listener,options){
      const result=original.call(this,type,listener,options);
      if(type==='complete'&&this.mode==='versionchange'&&this.db.name==='registro-docente-secure-vault'&&this.db.version===2&&!trace.guardReached){
        trace.guardReached++;
        // Observe the real transaction outcome before revoking.
        original.call(this,'abort',()=>{trace.aborted++;},{once:true});
        original.call(this,'complete',()=>{
          trace.completed++;
          if(cut==='after-commit'){trace.revoked++;window.dispatchEvent(new Event('pagehide'));}
        },{once:true});
        if(cut==='before-commit'){trace.revoked++;window.dispatchEvent(new Event('pagehide'));}
      }
      return result;
    };
  },cut);
}
async function confirmOriginalMigration(page,backup){
  const panel=await selectProductCopy(page,backup);
  await panel.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await panel.getByLabel('Password della copia',{exact:true}).fill('synthetic-archive-backup-only');
  await panel.getByRole('button',{name:'Verifica e aggiorna archivio'}).click();
}
for(const cut of ['before-commit','after-commit']){
  test('D1b.6 real migration '+cut+' interruption requires protected durable reinspection',async({page})=>{
    test.setTimeout(120000);
    const seed=await seedProduct(page);
    await unlockProduct(page);await privacyProduct(page);
    await armOriginalMigrationInterruption(page,cut);
    let confirmations=0;
    page.on('dialog',async d=>{if(d.message().includes('La copia è stata verificata')){confirmations++;await d.accept();}else await d.dismiss();});
    await confirmOriginalMigration(page,seed.backup);
    await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
    expect(confirmations).toBe(1);
    await expect(page.getByText('Operazione interrotta. Autenticati per verificare lo stato dell’archivio.')).toBeVisible();
    await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__val01MigrationCut)).toEqual({
      guardReached:1,aborted:cut==='before-commit'?1:0,completed:cut==='after-commit'?1:0,revoked:1
    });
    const expected=cut==='before-commit'?1:2;
    // Cold document restart must not use the former grant, key or snapshot.
    await page.reload();
    await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
    await unlockProduct(page);await privacyProduct(page);
    await expect(page.getByRole('region',{name:expected===1?'Aggiornamento protetto archivio':'Ripristino protetto archivio'})).toBeVisible();
    await physicalAfterProduct(page,expected,seed);
    await page.goto(productApp());await unlockProduct(page);await privacyProduct(page);
    if(expected===1){
      // The old authorization is gone. A fresh verified file and new explicit
      // confirmation are required to finish the same migration.
      await confirmOriginalMigration(page,seed.backup);
      await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
      await expect(page.getByText('Archivio aggiornato. Autenticati per verificarlo e riaprire il Registro.')).toBeVisible();
      expect(confirmations).toBe(2);
      await unlockProduct(page);
      await physicalAfterProduct(page,2,seed);
    }else{
      expect(confirmations).toBe(1);
      await expect(page.getByRole('region',{name:'Aggiornamento protetto archivio'})).toHaveCount(0);
    }
    await page.goto(productSeed());await page.addScriptTag({path:oldBundle});
    for(const operation of ['read','unlock','write','delete','clear','initialize'])expect(await historic(page,operation)).toBe('VersionError');
  });
}

const bootTrace=async page=>JSON.parse(await page.locator('[data-bootstrap-trace]').getAttribute('data-bootstrap-trace'));
async function noArchive(page){
  expect(await page.evaluate(async()=> (await indexedDB.databases()).filter(d=>d.name==='registro-docente-secure-vault'))).toEqual([]);
}
test('STAB-02 fresh candidate observes absence twice and does not create DB1 before explicit setup',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'classification',code:'confirm-absence'}]);
  await noArchive(page);
  await page.reload();await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
  await noArchive(page);
  await page.getByRole('radio',{name:/Ambiente dimostrativo/}).check();
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await noArchive(page);
  await page.getByRole('button',{name:'Avvia la prova'}).click();
  await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
  await page.reload();await unlockProduct(page);
  expect(await page.evaluate(async()=> (await indexedDB.databases()).find(d=>d.name==='registro-docente-secure-vault')?.version)).toBe(1);
  expect(await page.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBe('1');
});
test('STAB-02 established marker with missing DB refuses setup and manual retry never creates',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('registro_archive_established_v1','1'));
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible({timeout:20000});
  expect((await bootTrace(page)).map(t=>t.code)).toEqual(['missing-established','missing-established','missing-established']);
  await noArchive(page);
  await page.getByRole('button',{name:'Riprova controllo sicurezza'}).click();
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible({timeout:20000});
  await noArchive(page);
  await expect(page.getByRole('radio')).toHaveCount(0);
});
test('STAB-02 transient enumeration AbortError recovers existing DB1 without modifying it',async({page})=>{
  await page.addInitScript(()=>{
    if(!location.pathname.endsWith('val01-product-session.html'))return;
    const original=IDBFactory.prototype.databases;let calls=0;
    IDBFactory.prototype.databases=function(){
      if(++calls===1)return Promise.reject(new DOMException('synthetic read interrupted','AbortError'));
      return original.call(this);
    };
  });
  const seed=await seedProduct(page);
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:20000});
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'enumeration',code:'aborted-read'}]);
  await unlockProduct(page);await physicalAfterProduct(page,1,seed);
});
test('STAB-02 unclassified first read failure remains blocked; explicit readonly retry recovers',async({page})=>{
  await page.addInitScript(()=>{
    if(!location.pathname.endsWith('val01-product-session.html'))return;
    const original=IDBFactory.prototype.databases;let calls=0;
    IDBFactory.prototype.databases=function(){
      if(++calls===1)return Promise.reject(new DOMException('synthetic unknown','UnknownError'));
      return original.call(this);
    };
  });
  const seed=await seedProduct(page);
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'enumeration',code:'unknown'}]);
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await page.getByRole('button',{name:'Riprova controllo sicurezza'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await unlockProduct(page);await physicalAfterProduct(page,1,seed);
});
test('STAB-02 interrupted staging is never discarded by candidate Retry',async({page})=>{
  await seedProduct(page);
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  const before=await candidate(page,'preflightInventory','metadata');
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'classification',code:'staging'}]);
  await page.getByRole('button',{name:'Riprova controllo sicurezza'}).click();
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  expect(await candidate(page,'preflightInventory')).toBe(before);
  expect(await candidate(page,'version')).toBe(1);
});
test('STAB-02 sparse historical DB1 remains accessible and is not automatically upgraded',async({page})=>{
  await seedProduct(page);
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  const before=await candidate(page,'preflightInventory','sparse');
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await unlockProduct(page);
  // A sparse archive must never become a setup surface. The migration
  // preflight still rejects it; this proof is ordinary read access only.
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'preflightInventory')).toBe(before);
});
test('STAB-02 corrupt DB2 remains blocked and Retry cannot recreate it',async({page})=>{
  await seedProduct(page);
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  await candidate(page,'upgrade');
  const before=await candidate(page,'preflightInventory','sparse',2);
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'classification',code:'invalid-inventory'}]);
  await page.getByRole('button',{name:'Riprova controllo sicurezza'}).click();
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  expect(await candidate(page,'version')).toBe(2);
  expect(await candidate(page,'preflightInventory',null,2)).toBe(before);
});

test('STAB-02 legacy migration revocation during readonly probe preserves plaintext source and creates no archive',async({page})=>{
  const legacy={classes:[],currentClassId:null};
  await page.setViewportSize({width:390,height:844});
  await page.goto(productSeed());
  await page.evaluate(value=>localStorage.setItem('registro_docente_data_v35',JSON.stringify(value)),legacy);
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Proteggi i dati esistenti'})).toBeVisible();
  await noArchive(page);
  // Hold the next real enumeration, then revoke foreground while the
  // admission recheck is in progress. The synthetic visibility event and
  // override model a hidden WebView, not a fabricated migration result.
  await page.evaluate(()=>{
    const original=IDBFactory.prototype.databases;
    let intercepted=false;
    window.__legacyProbeStarted=false;
    IDBFactory.prototype.databases=function(){
      if(intercepted)return original.call(this);
      intercepted=true;
      window.__legacyProbeStarted=true;
      return new Promise((resolve,reject)=>{
        window.__releaseLegacyProbe=()=>original.call(this).then(resolve,reject);
      });
    };
  });
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Proteggi i dati esistenti',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__legacyProbeStarted)).toBe(true);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    window.__releaseLegacyProbe();
    // Return to foreground before the asynchronous probe finishes. The
    // revision, not just current visibility, must reject the stale request.
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('Sessione cambiata. Ripeti l’operazione in primo piano.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Proteggi i dati esistenti'})).toBeVisible();
  await noArchive(page);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('registro_docente_data_v35')))).toEqual(legacy);
  expect(await page.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBeNull();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  // A fresh explicit user action, not automatic continuation, may proceed.
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Proteggi i dati esistenti',exact:true}).click();
  await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  await page.reload();await unlockProduct(page);
});


// S-R01: real IndexedDB, synthetic data, two independent connections.
// Rendezvous before the durable claim: both initial reads saw absence.
// This exercises the same reservation port wired into the candidate Root.
test('S-R01 concurrent initial setup admits exactly one owner and preserves the full archive',async({page})=>{
  await page.goto(productSeed());
  const outcome=await page.evaluate(async()=>{
    const {IndexedDbVaultStore}=await import('/src/security/vaultStore.ts');
    const {SecureVault}=await import('/src/security/secureVault.ts');
    const {initializeNewArchive}=await import('/src/security/initialArchiveSetup.ts');
    const stores=[new IndexedDbVaultStore(),new IndexedDbVaultStore()];
    let arrivals=0,release;
    const rendezvous=new Promise(resolve=>{release=resolve;});
    const vaults=stores.map(store=>new SecureVault(store,async metadata=>{
      if(++arrivals===2)release();
      await rendezvous;
      return store.claimInitialMetadata(metadata);
    }));
    const credentials=['synthetic-initial-owner-one','synthetic-initial-owner-two'];
    const setups=[{mode:'demo'},{mode:'professional',profile:{school:'Istituto sintetico',year:'2026/2027',teacher:'Docente sintetico',subject:'Tecnologia'}}];
    const results=await Promise.allSettled(vaults.map((vault,i)=>initializeNewArchive(vault,credentials[i],setups[i])));
    const winner=results.findIndex(result=>result.status==='fulfilled');
    if(winner<0||results.filter(result=>result.status==='fulfilled').length!==1)
      return {arrivals,statuses:results.map(result=>result.status)};
    const loser=1-winner;
    const loserLocked=!vaults[loser].isUnlocked();
    vaults.forEach(vault=>vault.lock());
    await Promise.all(stores.map(store=>store.retireConnection()));
    const reopenedStore=new IndexedDbVaultStore(indexedDB,true);
    const reopened=new SecureVault(reopenedStore);
    try{
      let loserRejected=false;
      try{await reopened.unlock(credentials[loser]);}catch{loserRejected=true;}
      await reopened.unlock(credentials[winner]);
      const settings=await reopened.get('settings');
      const keys=await reopenedStore.listRecordKeys();
      const allAuthenticated=(await Promise.all(keys.map(key=>reopened.get(key)))).every(value=>value!==null);
      return {arrivals,statuses:results.map(result=>result.status),loserLocked,loserRejected,
        metadataState:(await reopenedStore.getMetadata()).state,
        modeMatches:settings.archiveMode===setups[winner].mode,keys,allAuthenticated};
    }finally{reopened.lock();await reopenedStore.retireConnection();}
  });
  expect(outcome.arrivals).toBe(2);
  expect(outcome.statuses.sort()).toEqual(['fulfilled','rejected']);
  expect(outcome.loserLocked).toBe(true);
  expect(outcome.loserRejected).toBe(true);
  expect(outcome.metadataState).toBe('ACTIVE');
  expect(outcome.modeMatches).toBe(true);
  expect(outcome.keys.sort()).toEqual(['appData','copilotState','customTests','library','meta','planning','professionalMemory','settings','submissions','udas']);
  expect(outcome.allAuthenticated).toBe(true);
});

test('S-R01 initial reservation refuses residual records without overwriting or deleting them',async({page})=>{
  await page.goto(productSeed());
  const outcome=await page.evaluate(async()=>{
    const {IndexedDbVaultStore}=await import('/src/security/vaultStore.ts');
    const {SecureVault}=await import('/src/security/secureVault.ts');
    const store=new IndexedDbVaultStore();
    const vault=new SecureVault(store,metadata=>store.claimInitialMetadata(metadata));
    const record={recordKey:'meta',schemaVersion:1,iv:new Uint8Array(12),ciphertext:new Uint8Array(24).fill(7).buffer};
    try{
      await store.putRecord(record);
      let rejected=false;
      try{await vault.createStaging('synthetic-reservation-only');}catch{rejected=true;}
      const preserved=await store.getRecord('meta');
      return {rejected,locked:!vault.isUnlocked(),metadata:await store.getMetadata(),
        keys:await store.listRecordKeys(),bytes:Array.from(new Uint8Array(preserved.ciphertext))};
    }finally{vault.lock();await store.retireConnection();}
  });
  expect(outcome).toEqual({rejected:true,locked:true,metadata:null,keys:['meta'],bytes:Array(24).fill(7)});
});


// S-R02: hold after a real vault operation, then revoke the live Root
// authorization through the same visibility signal as the WebView lifecycle.
async function holdLegacyVaultOperation(page, method) {
  await page.evaluate(async name=>{
    const {SecureVault}=await import('/src/security/secureVault.ts');
    const original=SecureVault.prototype[name];
    let intercepted=false;
    window.__sr02Reached=false;
    SecureVault.prototype[name]=async function(...args){
      const result=await original.apply(this,args);
      if(!intercepted){
        intercepted=true;
        window.__sr02Reached=true;
        await new Promise(resolve=>{window.__sr02Release=resolve;});
      }
      return result;
    };
  },method);
}
async function revokeHeldLegacyOperation(page) {
  await expect.poll(()=>page.evaluate(()=>window.__sr02Reached)).toBe(true);
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    window.__sr02Release();
  });
}
async function seedLegacyForRevocation(page) {
  const raw=JSON.stringify({classes:[],currentClassId:null});
  await page.setViewportSize({width:390,height:844});
  await page.goto(productSeed());
  await page.evaluate(value=>localStorage.setItem('registro_docente_data_v35',value),raw);
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Proteggi i dati esistenti'})).toBeVisible();
  return raw;
}
async function submitLegacyForRevocation(page) {
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Proteggi i dati esistenti',exact:true}).click();
}
test('S-R02 live Root revokes admitted legacy migration after first write, preserves source and requires fresh consent',async({page})=>{
  const raw=await seedLegacyForRevocation(page);
  await holdLegacyVaultOperation(page,'put');
  await submitLegacyForRevocation(page);
  await revokeHeldLegacyOperation(page);
  await expect(page.getByRole('heading',{name:'Proteggi i dati esistenti'})).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBe(raw);
  expect(await page.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBeNull();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await submitLegacyForRevocation(page);
  await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  await page.reload();await unlockProduct(page);
});
test('S-R02 live Root preserves committed ACTIVE and source on revocation, then requires fresh authorized cleanup',async({page})=>{
  const raw=await seedLegacyForRevocation(page);
  await holdLegacyVaultOperation(page,'activate');
  await submitLegacyForRevocation(page);
  await revokeHeldLegacyOperation(page);
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBe(raw);
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible({timeout:30000});
  await holdLegacyVaultOperation(page,'get');
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Sblocca Registro',exact:true}).click();
  await revokeHeldLegacyOperation(page);
  const revokedNotice=page.getByRole('status').filter({hasText:'Sessione cambiata. Autenticati nuovamente.'});
  await expect(revokedNotice).toBeVisible({timeout:30000});
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sblocca Registro',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBe(raw);
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  // Durable metadata is checked without opening a writable connection or
  // consuming the retained notice; the fresh authentication follows.
  const durable=await page.evaluate(async()=>{
    const {IndexedDbVaultStore}=await import('/src/security/vaultStore.ts');
    const store=new IndexedDbVaultStore(indexedDB,true);
    try{return {state:(await store.getMetadata())?.state,keys:await store.listRecordKeys()};}
    finally{await store.retireConnection();}
  });
  expect(durable.state).toBe('ACTIVE');
  expect(durable.keys).toContain('appData');
  await expect(revokedNotice).toBeVisible();
  await unlockProduct(page);
  await expect(revokedNotice).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  await page.reload();await unlockProduct(page);
});


// S-R03a: the only recovery bytes used below come from the real Privacy
// download. No fixture-generated copy is passed to the migration or restore.
async function downloadActualProductBackup(page) {
  const dialogs=[];
  const accept=async d=>{dialogs.push(d.message());await d.accept();};
  page.on('dialog',accept);
  try{
    await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill('synthetic-archive-backup-only');
    await page.getByPlaceholder('Ripeti la password').fill('synthetic-archive-backup-only');
    const [download]=await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button',{name:'Cifra e Scarica File'}).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/\.enc\.json$/);
    const fs=require('node:fs/promises');
    const bytes=await fs.readFile(await download.path());
    await expect(page.getByLabel('Verifica copia scaricata')).toBeVisible();
    await expect(page.getByRole('button',{name:'Cifra e Scarica File'})).toBeEnabled();
    expect(dialogs.some(message=>message.includes('Download avviato'))).toBe(true);
    const decoded=await page.evaluate(async text=>{
      const {decryptDataWithPassword}=await import('/src/cryptoUtils.ts');
      return decryptDataWithPassword(text,'synthetic-archive-backup-only');
    },bytes.toString('utf8'));
    expect(decoded.backupDataVersion).toBe(6);
    expect(decoded.app).toBe('registro-docente');
    expect(decoded.snapshot.meta).toEqual({changes:0,lastBackup:decoded.exportedAt});
    return {bytes,decoded};
  }finally{page.off('dialog',accept);}
}
for(const verified of [false,true]){
  test('S-R03a actual exported v6 '+(verified?'verified':'unverified')+' copy migrates DB1 and restores DB2 without substituting UI defaults',async({page})=>{
    test.setTimeout(120000);
    const seed=await seedProduct(page);
    await unlockProduct(page);await privacyProduct(page);
    const {bytes,decoded}=await downloadActualProductBackup(page);
    expect(decoded.snapshot).toEqual({...seed.snapshot,meta:decoded.snapshot.meta});
    if(verified){
      await page.getByLabel('Verifica copia scaricata').setInputFiles({name:'actual.enc.json',mimeType:'application/json',buffer:bytes});
      await expect(page.getByText('Copia verificata. Le registrazioni successive restano da includere.')).toBeVisible();
    }
    const panel=await selectProductCopy(page,bytes);
    await panel.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
    await panel.getByLabel('Password della copia',{exact:true}).fill('synthetic-archive-backup-only');
    let migrationConsent=0,restoreConsent=0;
    const unexpectedDialogs=[];
    page.on('dialog',async d=>{
      const message=d.message();
      if(d.type()==='confirm'&&message==='La copia è stata verificata. Aggiornare l’archivio locale? Dovrai autenticarti nuovamente.'){
        migrationConsent++;await d.accept();
      }else if(d.type()==='confirm'&&message==='La copia è stata verificata. Sostituire tutti i dati attuali con quelli della copia? Dovrai autenticarti nuovamente.'){
        restoreConsent++;await d.accept();
      }else{unexpectedDialogs.push({type:d.type(),message});await d.dismiss();}
    });
    await panel.getByRole('button',{name:'Verifica e aggiorna archivio'}).click();
    await expect(page.getByText('Archivio aggiornato. Autenticati per verificarlo e riaprire il Registro.')).toBeVisible({timeout:30000});
    expect(migrationConsent).toBe(1);
    expect(restoreConsent).toBe(0);
    expect(unexpectedDialogs).toEqual([]);
    await unlockProduct(page);
    const migrated=await readProductDb2(page);
    expect({...migrated,meta:seed.snapshot.meta}).toEqual(seed.snapshot);
    if(verified){
      expect(migrated.meta.changes).toBe(0);
      expect(migrated.meta.lastBackup).toBe(decoded.exportedAt);
      expect(migrated.meta.verifiedBackupEvidence).toMatchObject({payloadVersion:6,source:'web-readback',bytes:bytes.length,checkpointAt:decoded.exportedAt});
    }else expect(migrated.meta).toEqual(seed.snapshot.meta);
    // Change the destination using a separate synthetic, authorized restore
    // to prove the subsequent actual downloaded file replaces distinct data.
    const changed=await candidate(page,'db2ChangedCopy');
    expect(await candidate(page,'db2Lifecycle','restore',changed)).toMatchObject({result:'committed',state:'active'});
    expect((await candidate(page,'db2Read')).appData.classes).toEqual([]);
    await page.goto(productApp());await unlockProduct(page);await privacyProduct(page);
    await submitProductRestore(page,bytes,'synthetic-archive-backup-only');
    await expect(page.getByText('Archivio ripristinato. Autenticati per riaprire il Registro.')).toBeVisible({timeout:30000});
    expect(restoreConsent).toBe(1);
    expect(migrationConsent).toBe(1);
    expect(unexpectedDialogs).toEqual([]);
    await unlockProduct(page);await page.reload();await unlockProduct(page);
    expect(await readProductDb2(page)).toEqual(decoded.snapshot);
  });
}


// S-R04a: source and destination are different isolated browser contexts.
// Only the bytes produced by the actual Privacy export cross that boundary.
async function readRecoveryDb1(page,password){
  await page.goto(productSeed());
  return page.evaluate(async password=>{
    const {IndexedDbVaultStore}=await import('/src/security/vaultStore.ts');
    const {SecureVault}=await import('/src/security/secureVault.ts');
    const {SecureAppStorage}=await import('/src/security/secureAppStorage.ts');
    await import('/tests/browser/fixtures/val01-product-native-diagnostics.fixture.ts');
    const before=await window.__val01ProductInspection.raw();
    const store=new IndexedDbVaultStore(indexedDB,true);
    const vault=new SecureVault(store);
    try{
      await vault.unlock(password);
      const snapshot=await new SecureAppStorage(vault).loadExactBackupSnapshot();
      if(!snapshot)throw Error('Incomplete synthetic archive');
      return {...before,snapshot};
    }finally{vault.lock();await store.retireConnection();}
  },password);
}
async function submitFreshRecovery(page,bytes,password){
  await page.locator('#restore-backup-file').setInputFiles({name:'actual-recovery.enc.json',mimeType:'application/json',buffer:bytes});
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(password);
  const observed=page.waitForEvent('dialog').then(async d=>{
    const message=d.message();
    const type=d.type();
    await d.accept();
    return {message,type};
  });
  await page.getByRole('button',{name:'Decifra e Ripristina Registro'}).click();
  return observed;
}
test('S-R04a real exported copy recovers a fresh isolated DB1 with a different local password; wrong copy password preserves destination',async({page,browser})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
  await noArchive(page);
  await page.getByRole('radio',{name:/Ambiente dimostrativo/}).check();
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Avvia la prova'}).click();
  await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
  const source=await readRecoveryDb1(page,'synthetic-archive-compatibility-only');
  expect(source.version).toBe(1);
  expect(source.keys).toHaveLength(10);
  expect(source.snapshot.appData.classes.length).toBeGreaterThan(0);
  expect(source.snapshot.settings.archiveMode).toBe('demo');
  await page.goto(productApp());await unlockProduct(page);await privacyProduct(page);
  const {bytes,decoded}=await downloadActualProductBackup(page);
  expect(decoded.snapshot).toEqual({...source.snapshot,meta:decoded.snapshot.meta});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const fresh=await context.newPage();
    await fresh.goto(productApp());
    await expect(fresh.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
    await noArchive(fresh);
    expect(await fresh.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBeNull();
    await fresh.getByRole('radio',{name:/Archivio professionale/}).check();
    for(const [label,value] of Object.entries({'Istituto':'Synthetic recovery school','Anno scolastico':'2026/2027','Docente':'Synthetic recovery teacher','Disciplina':'Tecnologia'})){
      await fresh.getByLabel(label,{exact:true}).fill(value);
    }
    await fresh.getByLabel('Password locale',{exact:true}).fill('synthetic-new-password');
    await fresh.getByRole('button',{name:'Crea il mio registro'}).click();
    await expect(fresh.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
    const empty=await readRecoveryDb1(fresh,'synthetic-new-password');
    expect(empty.keys).toHaveLength(10);
    expect(empty.snapshot.appData.classes).toEqual([]);
    expect(empty.snapshot.settings.archiveMode).toBe('professional');
    await fresh.goto(productApp());await unlockProduct(fresh,'synthetic-new-password');await privacyProduct(fresh);
    const rejected=await submitFreshRecovery(fresh,bytes,'wrong-synthetic-copy-password');
    expect(rejected.type).toBe('alert');
    expect(rejected.message).not.toContain('ripristinato con successo');
    await expect(fresh.getByRole('button',{name:'Decifra e Ripristina Registro'})).toBeEnabled();
    expect(await readRecoveryDb1(fresh,'synthetic-new-password')).toEqual(empty);
    await fresh.goto(productApp());await unlockProduct(fresh,'synthetic-new-password');await privacyProduct(fresh);
    expect(await submitFreshRecovery(fresh,bytes,'synthetic-archive-backup-only')).toEqual({type:'alert',message:'Backup cifrato verificato e ripristinato con successo!'});
    await expect(fresh.getByTestId('header01-topbar')).toBeVisible();
    const restored=await readRecoveryDb1(fresh,'synthetic-new-password');
    expect(restored.version).toBe(1);
    expect(restored.keys).toHaveLength(10);
    expect(restored.digest).not.toBe(empty.digest);
    expect(restored.snapshot).toEqual(decoded.snapshot);
    await fresh.goto(productApp());
    await expect(fresh.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
    await expect(fresh.getByTestId('header01-topbar')).toHaveCount(0);
    await unlockProduct(fresh,'synthetic-new-password');
    expect(await readRecoveryDb1(fresh,'synthetic-new-password')).toEqual(restored);
    expect(await fresh.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBe('1');
    // A restore must not inherit a verification receipt from another installation.
    expect(restored.snapshot.meta.verifiedBackupAt).toBeUndefined();
    expect(restored.snapshot.meta.verifiedBackupEvidence).toBeUndefined();
  }finally{await context.close();}
});


// S-R01b: an actual first setup is interrupted after a durable staging
// reservation, after the encrypted batch, and after activation. The
// lifecycle owner is revoked even when visibility returns immediately.
async function submitInitialSetupForRevocation(page){
  await page.getByRole('radio',{name:/Archivio professionale/}).check();
  for(const [label,value] of Object.entries({'Istituto':'Synthetic setup school','Anno scolastico':'2026/2027','Docente':'Synthetic setup teacher','Disciplina':'Tecnologia'})){
    await page.getByLabel(label,{exact:true}).fill(value);
  }
  await page.getByLabel('Password locale',{exact:true}).fill('synthetic-archive-compatibility-only');
  await page.getByRole('button',{name:'Crea il mio registro'}).click();
}
async function inspectSetupInventory(page){
  return page.evaluate(async()=>{
    const {IndexedDbVaultStore}=await import('/src/security/vaultStore.ts');
    const store=new IndexedDbVaultStore(indexedDB,true);
    try{return {state:(await store.getMetadata())?.state??null,keys:await store.listRecordKeys()};}
    finally{await store.retireConnection();}
  });
}
for(const method of ['createStaging','putMany','activate']){
  test('S-R01b admitted setup revoked after '+method+' never opens a stale session',async({page})=>{
    test.setTimeout(120000);
    await page.setViewportSize({width:390,height:844});
    await page.goto(productApp());
    await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
    await noArchive(page);
    await holdLegacyVaultOperation(page,method);
    await submitInitialSetupForRevocation(page);
    await revokeHeldLegacyOperation(page);
    const activated=method==='activate';
    const notice=activated?'Sessione cambiata. Autenticati nuovamente.':'Sessione cambiata. Ripeti la configurazione in primo piano.';
    await expect(page.getByRole('status').filter({hasText:notice})).toBeVisible({timeout:30000});
    await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
    const inventory=await inspectSetupInventory(page);
    if(activated){
      expect(inventory.state).toBe('ACTIVE');
      expect(inventory.keys).toHaveLength(10);
      expect(await page.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBe('1');
      await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
      await unlockProduct(page);
    }else{
      expect(inventory).toEqual({state:null,keys:[]});
      expect(await page.evaluate(()=>localStorage.getItem('registro_archive_established_v1'))).toBeNull();
      await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
      await submitInitialSetupForRevocation(page);
      await expect(page.getByTestId('header01-topbar')).toBeVisible({timeout:30000});
    }
    await expect(page.getByRole('status').filter({hasText:notice})).toHaveCount(0);
    await page.reload();await unlockProduct(page);
    const final=await readRecoveryDb1(page,'synthetic-archive-compatibility-only');
    expect(final.keys).toHaveLength(10);
    expect(final.snapshot.appData.classes).toEqual([]);
    expect(final.snapshot.settings.archiveMode).toBe('professional');
    expect(final.snapshot.settings.school).toBe('Synthetic setup school');
    expect(final.snapshot.meta).toEqual({changes:0,lastBackup:null});
  });
}


// S-R04c: authenticated completeness evidence distinguishes previously
// complete DB1 from genuinely sparse historical predecessors. The fault is
// introduced only in the isolated browser fixture, never in a user archive.
test('S-R04c complete archive that later loses one encrypted dataset stays protected and Retry preserves all remaining bytes',async({page})=>{
  await seedProduct(page);
  await unlockProduct(page);
  expect(await page.evaluate(()=>localStorage.getItem('registro_archive_complete_v1'))).toBe('1');
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  const damaged=await candidate(page,'preflightInventory','sparse');
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  expect(await bootTrace(page)).toEqual([{attempt:1,phase:'classification',code:'partial-established'}]);
  await expect(page.getByText(/L’archivio già verificato come completo presenta dati mancanti/)).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await page.getByRole('button',{name:'Riprova controllo sicurezza'}).click();
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible();
  await page.goto(productSeed());await page.addScriptTag({path:newBundle});
  expect(await candidate(page,'version')).toBe(1);
  expect(await candidate(page,'preflightInventory')).toBe(damaged);
  expect(await page.evaluate(()=>localStorage.getItem('registro_archive_complete_v1'))).toBe('1');
});
test('S-R04c completeness evidence alone prevents setup if established flag is absent',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('registro_archive_complete_v1','1'));
  await page.goto(productApp());
  await expect(page.getByRole('heading',{name:'Sicurezza non disponibile'})).toBeVisible({timeout:20000});
  expect((await bootTrace(page)).map(t=>t.code)).toEqual(['missing-established','missing-established','missing-established']);
  await noArchive(page);
  await expect(page.getByRole('radio')).toHaveCount(0);
});
