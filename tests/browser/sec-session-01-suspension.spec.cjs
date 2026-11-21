const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const password = 'synthetic-session-contract';
test.use({viewport:{width:390,height:844},trace:'retain-on-failure'});
test.setTimeout(60000);

async function installNativeDouble(page) {
  await page.addInitScript(() => {
    let epoch=0, foreground=true, authorized=-1;
    window.__sessionEvidence=[];
    window.__transitionSession=(active)=>{
      if (!active && foreground) { epoch++; authorized=-1; }
      foreground=active;
      document.dispatchEvent(new Event('registro-session-change'));
    };
    window.Capacitor={getPlatform:()=> 'android',Plugins:{RegistroSession:{
      getState:async()=>({epoch,foreground}),
      authorize:async(input)=>{
        if(!foreground||input.epoch!==epoch)throw Error('stale native epoch');
        authorized=epoch;
        window.__sessionEvidence.push(['authorize',epoch]);
      },
      revoke:async(input)=>{
        if(input.epoch===epoch)authorized=-1;
        window.__sessionEvidence.push(['revoke',input.epoch]);
      },
      acknowledgeShield:async(input)=>{
        if(!foreground||input.epoch!==epoch)throw Error('stale native shield');
        const protectedSurface=Boolean(document.querySelector('[inert][aria-hidden="true"]'))||
          Boolean(document.querySelector('#vault-password'));
        if(authorized!==epoch&&!protectedSurface)throw Error('unsafe reveal');
        window.__sessionEvidence.push(['shield',epoch,protectedSurface]);
        window.__sessionEvidence.push(['interactive',epoch,input.interactive===true]);
        if(input.interactive===true&&protectedSurface)throw Error('protected surface cannot be interactive');
      }
    }}};
  });
}
async function open(page){
  await installNativeDouble(page);
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Avvia la prova'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
}
async function menu(page,name){
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button',{name,exact:true}).click();
}
async function suspend(page){
  await page.evaluate(()=>window.__transitionSession(false));
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await page.evaluate(()=>window.__transitionSession(true));
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===1&&x[2]))).toBe(true);
}
test('SEC-SESSION-01: resume reauthenticates and preserves an uncommitted draft',async({page})=>{
  await open(page);
  await menu(page,'Consigli di classe');
  const picker=page.getByRole('combobox',{name:'Seleziona classe per il Consiglio'});
  await picker.selectOption({index:1});
  const grade=page.locator('input[aria-label^="Voto di ingresso per"]').first();
  await expect(grade).toBeVisible();
  await grade.fill('8,5');
  await suspend(page);
  await expect(grade).toBeHidden();
  await page.locator('#vault-password').fill('wrong-synthetic-password');
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(grade).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0]);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8,5');
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,1]);
  await page.getByTestId('header01-lock').click();
  const guard=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Continua senza salvare'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
});
test('SEC-SESSION-01: a second pause during unlock cannot authorize stale epoch',async({page})=>{
  await open(page);
  await suspend(page);
  await page.evaluate(()=>{
    const original=window.Capacitor.Plugins.RegistroSession.authorize;
    window.Capacitor.Plugins.RegistroSession.authorize=async input=>{
      if(input.epoch===1){
        window.__transitionSession(false);
        window.__transitionSession(true);
      }
      return original(input);
    };
  });
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===2&&x[2]))).toBe(true);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,2]);
});

test('SEC-SESSION-01: delayed successful authorization response cannot reopen a newer generation',async({page})=>{
  await open(page);
  await menu(page,'Consigli di classe');
  await page.getByRole('combobox',{name:'Seleziona classe per il Consiglio'}).selectOption({index:1});
  const grade=page.locator('input[aria-label^="Voto di ingresso per"]').first();
  await grade.fill('8,5');
  await suspend(page);
  await page.evaluate(()=>{
    const original=window.Capacitor.Plugins.RegistroSession.authorize;
    window.Capacitor.Plugins.RegistroSession.authorize=async input=>{
      await original(input); // Native accepted epoch 1, but JS response is held.
      if(input.epoch===1)await new Promise(resolve=>{window.__releaseAuthorization=resolve;});
    };
    window.__exposedWhileStale=false;
    const observe=()=>{
      const top=document.querySelector('[data-testid="header01-topbar"]');
      if(top&&!top.closest('[inert]')&&window.__watchStale)window.__exposedWhileStale=true;
    };
    window.__watchStale=true;
    new MutationObserver(observe).observe(document.getElementById('root'),{subtree:true,attributes:true,childList:true});
  });
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__releaseAuthorization==='function')).toBe(true);
  await page.evaluate(()=>{window.__transitionSession(false);window.__transitionSession(true);});
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===2&&x[2]))).toBe(true);
  await page.evaluate(()=>window.__releaseAuthorization());
  await expect(page.getByText('Sessione Android cambiata. Autenticati nuovamente.')).toBeVisible();
  await expect(grade).toBeHidden();
  expect(await page.evaluate(()=>window.__exposedWhileStale)).toBe(false);
  await page.evaluate(()=>{window.__watchStale=false;});
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8,5');
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,1,2]);
});

test('SEC-SESSION-01: interrupted foreground authorization after migration returns to the active locked vault',async({page})=>{
  await installNativeDouble(page);
  await page.addInitScript(()=>{
    localStorage.setItem('registro_docente_data_v35',JSON.stringify({classes:[],currentClassId:null}));
    const original=window.Capacitor.Plugins.RegistroSession.authorize;
    window.Capacitor.Plugins.RegistroSession.authorize=async input=>{
      await original(input);
      if(input.epoch===0){
        window.__transitionSession(false);
        window.__transitionSession(true);
      }
    };
  });
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Proteggi i dati esistenti'})).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Proteggi i dati esistenti'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByTestId('header01-topbar')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,1]);
});

test('SEC-SESSION-01: slow admitted daily grade settles without premature unlock or duplicate write',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:/^Apri classe /}).first().click();
  await page.locator('nav').getByRole('button',{name:'Tabellone',exact:true}).click();
  const grade=page.getByRole('textbox',{name:'Voto alunno 1',exact:true});
  await expect(grade).toBeVisible();
  await grade.fill('8');
  await page.getByRole('button',{name:'Conferma voto alunno 1',exact:true}).click();
  await page.getByRole('combobox',{name:'Tipologia prova'}).selectOption('disegno');
  await page.getByRole('textbox',{name:'Argomento prova'}).fill('Prova sintetica sospensione lunga');
  // Hold delivery of the real encrypted transaction completion, not a fake save.
  await page.evaluate(()=>{
    const original=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
    if(!original?.get||!original?.set)throw Error('IDB completion descriptor unavailable');
    window.__gradeCompletionPending=false;
    Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
      configurable:true,enumerable:original.enumerable,get:original.get,
      set(handler){
        if(this.mode==='readwrite'&&this.objectStoreNames.contains('records')){
          Object.defineProperty(IDBTransaction.prototype,'oncomplete',original);
          original.set.call(this,function(event){
            window.__gradeCompletionPending=true;
            window.__releaseGradeCompletion=()=>handler.call(this,event);
          });
        }else original.set.call(this,handler);
      }
    });
  });
  await page.getByRole('button',{name:'Conferma e registra',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__gradeCompletionPending)).toBe(true);
  await page.evaluate(()=>{window.__transitionSession(false);window.__transitionSession(true);});
  await expect(page.getByText('Protezione della sessione…',{exact:true})).toBeVisible();
  await expect(grade).toBeHidden();
  await expect(page.getByText('Sessione protetta. Attesa della conclusione dell’operazione locale.',{exact:true})).toBeVisible({timeout:16000});
  await expect(page.locator('#vault-password')).toHaveCount(0);
  await page.evaluate(()=>window.__releaseGradeCompletion());
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8');
  await expect(page.getByTestId('daily-registration-summary')).toContainText('1 voto registrato');
  await expect(page.getByTestId('daily-registration-summary')).not.toContainText('da registrare');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await page.getByRole('button',{name:/^Apri classe /}).first().click();
  await page.locator('nav').getByRole('button',{name:'Tabellone',exact:true}).click();
  await expect(grade).toHaveValue('8');
  await expect(page.getByTestId('daily-registration-summary')).toContainText('1 voto registrato');
});

test('SEC-SESSION-01: explicit lock revokes native authority until fresh authenticated surface',async({page})=>{
  await open(page);
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='interactive').at(-1))).toEqual(['interactive',0,true]);
  await menu(page,'Blocca ed esci');
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='revoke'&&x[1]===0))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='interactive').at(-1))).toEqual(['interactive',0,false]);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='interactive').at(-1))).toEqual(['interactive',0,true]);
});

test('SEC-SESSION-01: recover a queued first grade after key revocation without reconstructing its proof',async({page})=>{
  await open(page);
  const dialogs=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});
  await menu(page,'Impostazioni');
  await expect(page.getByRole('button',{name:'Matrix Green',exact:true})).toBeVisible();
  // First real settings write commits to IndexedDB; hold only its completion delivery.
  // The shared App coordinator stays busy, so the subsequent grade is admitted but cannot start.
  await page.evaluate(()=>{
    const original=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
    if(!original?.get||!original?.set)throw Error('IDB completion descriptor unavailable');
    window.__queuedRecoveryWrites=0;
    window.__settingsCompletionHeld=false;
    Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
      configurable:true,enumerable:original.enumerable,get:original.get,
      set(handler){
        if(this.mode==='readwrite'&&this.objectStoreNames.contains('records')){
          window.__queuedRecoveryWrites++;
          if(window.__queuedRecoveryWrites===1){
            original.set.call(this,function(event){
              window.__settingsCompletionHeld=true;
              window.__releaseSettingsCompletion=()=>{
                if(!window.__settingsCompletionHeld)throw Error('completion already released');
                window.__settingsCompletionHeld=false;
                handler.call(this,event);
              };
            });
            return;
          }
        }
        original.set.call(this,handler);
      }
    });
  });
  await page.getByRole('button',{name:'Matrix Green',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__settingsCompletionHeld)).toBe(true);
  await menu(page,'Oggi');
  const homeConfirm=page.getByTestId('header01-home-confirm');
  await expect(homeConfirm).toBeVisible();
  await homeConfirm.getByRole('button',{name:'Torna a Oggi'}).click();
  await page.getByRole('button',{name:/^Apri classe /}).first().click();
  await page.locator('nav').getByRole('button',{name:'Tabellone',exact:true}).click();
  const grade=page.getByRole('textbox',{name:'Voto alunno 1',exact:true});
  const proofTitle=page.getByRole('textbox',{name:'Argomento prova'});
  const proofType=page.getByRole('combobox',{name:'Tipologia prova'});
  const proofPeriod=page.getByRole('combobox',{name:'Periodo prova'});
  const summary=page.getByTestId('daily-registration-summary');
  await grade.fill('8,5');
  await page.getByRole('button',{name:'Conferma voto alunno 1',exact:true}).click();
  await proofType.selectOption('disegno');
  await proofTitle.fill('Prova sintetica da recuperare');
  await proofPeriod.selectOption('Q2');
  await page.getByRole('button',{name:'Conferma e registra',exact:true}).click();
  await expect(summary).toContainText('Salvataggio');
  await expect(summary).toContainText('0 voti registrati');
  expect(await page.evaluate(()=>window.__queuedRecoveryWrites)).toBe(1);
  await page.evaluate(()=>{window.__transitionSession(false);window.__transitionSession(true);});
  await expect(page.getByText('Protezione della sessione…',{exact:true})).toBeVisible();
  await expect(grade).toBeHidden();
  await expect(page.getByText('Sessione protetta. Attesa della conclusione dell’operazione locale.',{exact:true})).toBeVisible({timeout:16000});
  await expect(page.locator('#vault-password')).toHaveCount(0);
  await page.evaluate(()=>window.__releaseSettingsCompletion());
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(grade).toBeHidden();
  expect(await page.evaluate(()=>window.__queuedRecoveryWrites)).toBe(1);
  // Wrong authentication cannot reveal the failed grade or proof.
  await page.locator('#vault-password').fill('wrong-synthetic-password');
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByText(/Password errata/)).toBeVisible();
  await expect(grade).toBeHidden();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8,5');
  await expect(proofType).toHaveValue('disegno');
  await expect(proofTitle).toHaveValue('Prova sintetica da recuperare');
  await expect(proofPeriod).toHaveValue('Q2');
  await expect(summary).toContainText('0 voti registrati');
  await expect(summary).toContainText('1 da registrare');
  await expect(page.getByText('Voto non salvato. Riprova con il comando di conferma.',{exact:true})).toBeVisible();
  await expect(page.getByTestId('daily-grade-registered-icon')).toHaveCount(0);
  expect(dialogs).toEqual([]);
  // Explicitly retry the original proof; no retyping and no automatic replay.
  await page.getByRole('button',{name:'Conferma e registra',exact:true}).click();
  await expect(summary).toContainText('1 voto registrato');
  await expect(summary).not.toContainText('da registrare');
  await expect(page.getByTestId('daily-grade-registered-icon')).toHaveCount(1);
  expect(await page.evaluate(()=>window.__queuedRecoveryWrites)).toBe(2);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.locator('body')).toHaveClass(/theme-matrix/);
  await page.getByRole('button',{name:/^Apri classe /}).first().click();
  await page.locator('nav').getByRole('button',{name:'Tabellone',exact:true}).click();
  await expect(summary).toContainText('1 voto registrato');
  await expect(page.getByTestId('daily-grade-registered-icon')).toHaveCount(1);
  await expect(page.getByRole('combobox',{name:'Prova della giornata'}).locator('option:checked')).toHaveText('Disegno / Grafica · Prova sintetica da recuperare');
  await expect(page.getByTestId('daily-matrix').getByText('Secondo periodo',{exact:true})).toBeVisible();
  await expect(grade).toHaveValue('8.5');
  await expect(page.getByTestId('daily-proof-panel')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});


// M1-B2 browser revocation — real Root and physical IndexedDB, synthetic data only.
// Interception happens at the *real transaction-complete callback*, after the
// durable commit but before the application can publish the resulting state.
async function installM1ArchiveRevocation(page, target) {
  await page.evaluate(kind => {
    if (typeof window.__transitionSession !== 'function') throw Error('Native session double missing');
    const original = IDBObjectStore.prototype.put;
    const intercepted = new WeakSet();
    let armed = true;
    window.__m1B2CommitRevokeCount = 0;
    window.__m1B2RevocationPoint = null;
    IDBObjectStore.prototype.put = function (value, key) {
      const result = original.apply(this, arguments);
      const isTarget = kind === 'active'
        ? this.name === 'metadata' && value?.state === 'ACTIVE'
        : this.name === 'records';
      if (armed && isTarget && !intercepted.has(this.transaction)) {
        const tx = this.transaction;
        const complete = tx.oncomplete;
        if (typeof complete !== 'function') throw Error('Missing real IndexedDB commit callback');
        armed = false;
        intercepted.add(tx);
        tx.oncomplete = function (event) {
          window.__m1B2RevocationPoint = kind;
          window.__m1B2CommitRevokeCount += 1;
          window.__transitionSession(false);
          window.__transitionSession(true);
          complete.call(this, event);
        };
      }
      return result;
    };
  }, target);
}

async function m1PhysicalVault(page) {
  return page.evaluate(async () => {
    const name = 'registro-docente-secure-vault';
    if (!(await indexedDB.databases()).some(db => db.name === name)) {
      return {exists: false, state: null, recordKeys: []};
    }
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.transaction?.abort();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(['metadata', 'records'], 'readonly');
      const metadata = tx.objectStore('metadata').get('current');
      const records = tx.objectStore('records').getAllKeys();
      const result = await Promise.all([
        new Promise((resolve, reject) => {
          metadata.onsuccess = () => resolve(metadata.result ?? null);
          metadata.onerror = () => reject(metadata.error);
        }),
        new Promise((resolve, reject) => {
          records.onsuccess = () => resolve(records.result);
          records.onerror = () => reject(records.error);
        })
      ]);
      return {
        exists: true, state: result[0]?.state ?? null,
        recordKeys: result[1].slice().sort()
      };
    } finally {
      db.close();
    }
  });
}

async function m1SyntheticLegacy(page) {
  await installNativeDouble(page);
  await page.goto(baseURL, {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Configura archivio protetto'})).toBeVisible();
  await page.evaluate(() => {
    // These are entirely fictional, empty school records; never use an existing vault.
    localStorage.setItem('registro_docente_data_v35', JSON.stringify({
      classes: [], currentClassId: null
    }));
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Proteggi i dati esistenti'})).toBeVisible();
}

test('M1-B2 browser revocation A: first encrypted legacy record commit cannot activate or delete source', async ({page}) => {
  await m1SyntheticLegacy(page);
  const source = await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'));
  await installM1ArchiveRevocation(page, 'records');
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Proteggi i dati esistenti'}).click();

  await expect.poll(() => page.evaluate(() => window.__m1B2CommitRevokeCount)).toBe(1);
  await expect(page.getByRole('heading', {name: 'Proteggi i dati esistenti'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'))).toBe(source);
  const physical = await m1PhysicalVault(page);
  expect(physical.state).toBeNull();
  expect(physical.recordKeys).toEqual([]);

  // A new explicit authorization can migrate without losing the original data.
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Proteggi i dati esistenti'}).click();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toBeVisible();
  expect((await m1PhysicalVault(page)).state).toBe('ACTIVE');
  expect(await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  expect(await page.evaluate(() => window.__m1B2CommitRevokeCount)).toBe(1);
});

test('M1-B2 browser revocation B: ACTIVE commit followed by session loss preserves legacy until fresh authentication', async ({page}) => {
  await m1SyntheticLegacy(page);
  const source = await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'));
  await installM1ArchiveRevocation(page, 'active');
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Proteggi i dati esistenti'}).click();

  await expect.poll(() => page.evaluate(() => window.__m1B2CommitRevokeCount)).toBe(1);
  await expect(page.getByRole('heading', {name: 'Sblocca Registro'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'))).toBe(source);
  const physical = await m1PhysicalVault(page);
  expect(physical.state).toBe('ACTIVE');
  expect(physical.recordKeys).toEqual(['appData']);

  // The preexisting plaintext is cleaned only on the authenticated recovery.
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Sblocca Registro'}).click();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('registro_docente_data_v35'))).toBeNull();
  expect((await m1PhysicalVault(page)).recordKeys).toEqual(['appData']);
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Sblocca Registro'})).toBeVisible();
});

test('M1-B2 browser revocation C: initial demo configuration revoked after record commit never publishes success', async ({page}) => {
  await installNativeDouble(page);
  await page.goto(baseURL, {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Configura archivio protetto'})).toBeVisible();
  await installM1ArchiveRevocation(page, 'records');
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Avvia la prova'}).click();

  await expect.poll(() => page.evaluate(() => window.__m1B2CommitRevokeCount)).toBe(1);
  await expect(page.getByRole('heading', {name: 'Configura archivio protetto'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toHaveCount(0);
  const physical = await m1PhysicalVault(page);
  expect(physical.state).toBeNull();
  expect(physical.recordKeys).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('registro_archive_established_v1'))).toBeNull();

  // A second explicit setup is allowed only when the previous attempt was
  // conclusively aborted, with an empty physical archive.
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', {name: 'Avvia la prova'}).click();
  await expect(page.getByRole('heading', {name: 'Le mie classi'})).toBeVisible();
  const after = await m1PhysicalVault(page);
  expect(after.state).toBe('ACTIVE');
  expect(after.recordKeys).toHaveLength(10);
  expect(await page.evaluate(() => window.__m1B2CommitRevokeCount)).toBe(1);
});
