// DOC-01/D4c3e1: real Chromium UI qualification on a synthetic owner.
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/doc01-d4c3e1.html';
async function open(page,scenario='success'){
 const response=await page.goto(url+'?scenario='+encodeURIComponent(scenario));
 expect(response?.ok()).toBe(true);
 await expect(page.getByRole('region',{name:'Recupero documentale protetto'})).toBeVisible();
}
const calls=page=>page.evaluate(()=>globalThis.__doc01D4c3e1.calls());
async function inspect(page){
 await page.getByRole('button',{name:'Esamina il recupero'}).click();
 await expect(page.getByRole('group',{name:'Riepilogo del recupero'})).toBeVisible();
 await expect(page.getByText('Revisioni già presenti')).toBeVisible();
 await expect(page.getByText('Revisioni nella copia proposta')).toBeVisible();
}
async function approve(page,{expectVerification=true}={}){
 await inspect(page);
 const ok=page.getByRole('button',{name:'Conferma recupero'});
 await expect(ok).toBeDisabled();
 await page.locator('#doc01-v8-consent').fill('RIPRISTINA');
 await expect(ok).toBeDisabled();
 await page.getByRole('checkbox').check();
 await expect(ok).toBeEnabled();
 await ok.click();
 if(expectVerification)await expect(page.getByText('Non è ancora una conferma di recupero riuscito',{exact:false})).toBeVisible();
}
async function footprint(page,width,name){
 const sizes=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}));
 expect(sizes.scrollWidth).toBeLessThanOrEqual(width);
 const dir=path.resolve(process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence');
 fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'doc01-d4c3e1-'+name+'.png');
 await page.screenshot({path:file,fullPage:true});
 expect(fs.statSync(file).size).toBeGreaterThan(1500);
}
test('390px teacher consent: review cannot write, typed approval is one-use, verify-required before cold reopen',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page);await inspect(page);
 expect(await calls(page)).toEqual(['prepare']);
 const ok=page.getByRole('button',{name:'Conferma recupero'});
 await expect(ok).toBeDisabled();
 await page.getByRole('checkbox').check();
 await page.locator('#doc01-v8-consent').fill('RIPRISTINA');
 await ok.click();
 await expect(page.getByText('Non è ancora una conferma di recupero riuscito',{exact:false})).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','commit']);
 await footprint(page,390,'verification-required');
 await page.getByRole('button',{name:'Verifica dopo il nuovo accesso'}).click();
 await expect(page.getByText('Archivio riaperto e verificato.')).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','commit','reopen-verified','invalidate']);
 expect(errors).toEqual([]);await context.close();
});
test('320px cancelled teacher choice leaves the archive unchanged and grant invalidated',async({browser})=>{
 const context=await browser.newContext({viewport:{width:320,height:700},isMobile:true,hasTouch:true});
 const page=await context.newPage();await open(page);await inspect(page);
 await footprint(page,320,'before-cancel');
 await page.getByRole('button',{name:'Annulla'}).click();
 await expect(page.getByText('Operazione annullata. Nessun recupero è stato eseguito.')).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','invalidate']);
 expect(await calls(page)).not.toContain('commit');
 await footprint(page,320,'cancelled');await context.close();
});
test('invalid protected preview cannot authorize restore or silently succeed',async({page})=>{
 await open(page,'invalid');
 await page.getByRole('button',{name:'Esamina il recupero'}).click();
 await expect(page.getByText('La copia non è verificabile. Nessun recupero è stato autorizzato.')).toBeVisible();
 expect(await calls(page)).not.toContain('commit');
 await expect(page.getByRole('button',{name:'Conferma recupero'})).toHaveCount(0);
});
test('uncertain physical commit never says successful and cannot be repeated',async({page})=>{
 await open(page,'uncertain');await approve(page,{expectVerification:false});
 await expect(page.getByText('Esito del recupero non verificato.',{exact:false}).first()).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','commit','invalidate']);
 await expect(page.getByRole('button',{name:'Conferma recupero'})).toHaveCount(0);
 await expect(page.getByText('Archivio riaperto e verificato.')).toHaveCount(0);
});
test('reopen verification denied keeps uncertain result; physical commit occurs once',async({page})=>{
 await open(page,'verification-fail');await approve(page);
 await page.getByRole('button',{name:'Verifica dopo il nuovo accesso'}).click();
 await expect(page.getByText('Esito del recupero non verificato.',{exact:false}).first()).toBeVisible();
 expect((await calls(page)).filter(x=>x==='commit')).toHaveLength(1);
 expect(await page.getByText('Archivio riaperto e verificato.')).toHaveCount(0);
});

const release=async(page,stage)=>page.evaluate(stage=>globalThis.__doc01D4c3e1.release(stage),stage);
async function remount(page,epoch){
 await page.evaluate(()=>globalThis.__doc01D4c3e1.remount());
 await expect(page.getByTestId('doc01-recovery-epoch')).toHaveAttribute('data-epoch',String(epoch));
}
async function beginDeferred(page,scenario='deferred'){
 await open(page,scenario);
 await page.getByRole('button',{name:'Esamina il recupero'}).click();
 await expect(page.getByText('Verifica locale in corso…')).toBeVisible();
}
async function approveDeferred(page){
 await release(page,'prepare');
 await expect(page.getByRole('group',{name:'Riepilogo del recupero'})).toBeVisible();
 await page.getByRole('checkbox').check();
 await page.locator('#doc01-v8-consent').fill('RIPRISTINA');
 await page.getByRole('button',{name:'Conferma recupero'}).click();
 await expect(page.getByText('Sostituzione locale in corso…')).toBeVisible();
}

test('external decision remounts during deferred prepare and exposes consent after settlement',async({page})=>{
 await beginDeferred(page);
 await remount(page,1);
 expect(await calls(page)).toEqual(['prepare']);
 await release(page,'prepare');
 await expect(page.getByRole('group',{name:'Riepilogo del recupero'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Conferma recupero'})).toBeDisabled();
 expect(await calls(page)).toEqual(['prepare']);
});
test('external decision remounts during deferred commit and exposes required verification',async({page})=>{
 await beginDeferred(page);
 await approveDeferred(page);
 await remount(page,1);
 await expect(page.getByText('Sostituzione locale in corso…')).toBeVisible();
 await release(page,'commit');
 await expect(page.getByRole('button',{name:'Verifica dopo il nuovo accesso'})).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','commit']);
 await expect(page.getByText('Archivio riaperto e verificato.')).toHaveCount(0);
});
test('external decision remounts during deferred verification and displays only verified result',async({page})=>{
 await beginDeferred(page);
 await approveDeferred(page);
 await release(page,'commit');
 await expect(page.getByRole('button',{name:'Verifica dopo il nuovo accesso'})).toBeVisible();
 await page.getByRole('button',{name:'Verifica dopo il nuovo accesso'}).click();
 await expect(page.getByText('Verifica dopo il nuovo accesso in corso…')).toBeVisible();
 await remount(page,1);
 await expect(page.getByText('Verifica dopo il nuovo accesso in corso…')).toBeVisible();
 await expect(page.getByText('Archivio riaperto e verificato.')).toHaveCount(0);
 await release(page,'verify');
 await expect(page.getByText('Archivio riaperto e verificato.')).toBeVisible();
 expect(await calls(page)).toEqual(['prepare','commit','reopen-verified','invalidate']);
});
test('external decision remount after uncertain physical outcome cannot retry or report success',async({page})=>{
 await beginDeferred(page,'deferred-uncertain');
 await approveDeferred(page);
 await remount(page,1);
 await release(page,'commit');
 await expect(page.getByText('Non ripetere il ripristino automaticamente.',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Conferma recupero'})).toHaveCount(0);
 await expect(page.getByText('Archivio riaperto e verificato.')).toHaveCount(0);
 expect((await calls(page)).filter(x=>x==='commit')).toHaveLength(1);
});
