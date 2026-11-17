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
  await expect(page.getByRole('button',{name:'Reset Totale Sicuro'})).toBeDisabled();
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
