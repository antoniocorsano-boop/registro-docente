const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-operational.html';
const selector=page=>page.getByRole('group',{name:'Vista Tabellone'});
const student=(page,n)=>page.getByRole('region',{name:'Righe studenti'}).getByRole('button',{name:'Studente '+n,exact:true});
const row=(page,n)=>student(page,n).locator('..');
const diag=(page,method,...args)=>page.evaluate(({method,args})=>window.__val01OperationalDiagnostics[method](...args),{method,args});
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 await page.getByRole('button',{name:'Apri archivio dimostrativo'}).click();
 await expect(selector(page)).toBeVisible({timeout:15000});
 expect(errors).toEqual([]);return errors;
}
async function evidence(page,criterion='c1'){
 await selector(page).getByRole('button',{name:'Evidenze',exact:true}).click();
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');
 await page.getByLabel('Criterio',{exact:true}).selectOption(criterion);
}
async function review(page,state='not_applicable'){
 await student(page,4).click();await page.getByRole('button',{name:'Nuova rilevazione'}).click();
 await page.getByLabel('Stato',{exact:true}).selectOption(state);
 if(state==='observed'){
  await page.getByLabel('Tipo di evidenza').selectOption('product');
  await page.getByLabel('Fatto osservato').fill('Schema individuale sintetico');
  await page.getByLabel('Metodo',{exact:true}).fill('Elaborato');
  await page.getByLabel('Interpretazione',{exact:true}).selectOption('level');
  await page.getByLabel('Livello',{exact:true}).selectOption('l2');
 }
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();
}
const confirm=page=>page.getByRole('button',{name:'Conferma rilevazione'});
const saved=page=>expect(page.getByRole('status').filter({hasText:'Rilevazione salvata'})).toBeVisible();
test('durable receipt only after real DB2 write, with duplicate and navigation guard',async({page})=>{
 test.setTimeout(60000);await open(page);await evidence(page);await review(page);
 const before=await diag(page,'physicalDigest'),initial=await diag(page,'committed');
 await diag(page,'arm','hold');await confirm(page).click();
 await expect.poll(()=>diag(page,'held')).toBe(true);
 await expect(confirm(page)).toBeDisabled();await expect(page.getByRole('button',{name:'Abbandona bozza'})).toBeDisabled();
 await expect(row(page,4)).toContainText('Non registrato');
 await expect(page.getByText('Rilevazione salvata nell’archivio protetto.',{exact:true})).toHaveCount(0);
 expect(await diag(page,'physicalDigest')).toEqual(before);expect(await diag(page,'committed')).toEqual(initial);
 await selector(page).getByRole('button',{name:'Storico',exact:true}).click();
 await expect(page.getByText('Completa o abbandona la bozza prima di cambiare vista.')).toBeVisible();
 await diag(page,'release');await saved(page);await expect(row(page,4)).toContainText('Non pertinente');
 const after=await diag(page,'physicalDigest'),committed=await diag(page,'committed');
 expect(Object.keys(after).filter(k=>after[k]!==before[k]).sort()).toEqual(['appData','meta']);
 expect(committed.changes).toBe(initial.changes+1);expect(committed.grades).toEqual(initial.grades);
 expect(committed.revisionIds).toEqual([...initial.revisionIds,'board-revision-1']);
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 const report=page.getByRole('region',{name:'Evidenze individuali',exact:true});
 await expect(report).toContainText('Non pertinente');await expect(report).toContainText('Studente 4');
 await expect(report).not.toContainText('Collegamenti esplicitati');
});
test('real transaction abort keeps reviewed draft, requires reopening, retries exactly once',async({page})=>{
 test.setTimeout(60000);await open(page);await evidence(page);await review(page,'observed');
 const before=await diag(page,'physicalDigest'),initial=await diag(page,'committed');
 await diag(page,'arm','abort');await confirm(page).click();
 await expect(page.getByText('Salvataggio non confermato. La bozza è conservata.',{exact:false})).toBeVisible();
 await expect(page.getByLabel('Fatto osservato')).toHaveValue('Schema individuale sintetico');
 await expect(confirm(page)).toBeDisabled();await expect(row(page,4)).toContainText('Non registrato');
 expect(await diag(page,'physicalDigest')).toEqual(before);expect(await diag(page,'committed')).toEqual(initial);
 await page.getByRole('button',{name:'Riapri archivio dimostrativo'}).click();
 await expect(page.getByText('Archivio riaperto. Verifica la bozza prima di confermare.')).toBeVisible();
 await expect(confirm(page)).toBeEnabled();await expect(page.getByLabel('Livello',{exact:true})).toHaveValue('l2');
 await confirm(page).click();await saved(page);
 expect(await diag(page,'committed')).toEqual({changes:initial.changes+1,revisionIds:[...initial.revisionIds,'board-revision-1'],grades:initial.grades});
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 const report=page.getByRole('region',{name:'Evidenze individuali',exact:true});
 await expect(report).toContainText('Schema individuale sintetico');await expect(report).toContainText('Coerente');
 await expect(report).toContainText('Motiva i collegamenti tra fasi');
 await expect(report).toContainText('Obiettivo: Rappresentare la filiera');
 await expect(report).not.toContainText('Nuova versione');
});
test('cold reload, exact historical correction and withdrawal remain durable without duplicate IDs',async({page})=>{
 test.setTimeout(60000);await open(page);await evidence(page);await review(page);await confirm(page).click();await saved(page);
 await page.reload();await page.getByRole('button',{name:'Apri archivio dimostrativo'}).click();await evidence(page);
 await expect(row(page,4)).toContainText('Non pertinente');await student(page,4).click();
 await page.getByRole('button',{name:'Correggi'}).click();await page.getByLabel('Stato',{exact:true}).selectOption('not_observed');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await confirm(page).click();await saved(page);
 await expect(row(page,4)).toContainText('Non osservato');
 await page.getByRole('button',{name:'Ritira'}).click();await page.getByLabel('Motivo del ritiro').fill('Ritiro sintetico');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await confirm(page).click();await saved(page);
 await expect(row(page,4)).toContainText('Non registrato');
 const state=await diag(page,'committed');expect(state.changes).toBe(3);
 expect(state.revisionIds.slice(-3)).toEqual(['board-revision-1','board-revision-2','board-revision-3']);
 expect(state.grades).toEqual(['8']);
 await page.reload();await page.getByRole('button',{name:'Apri archivio dimostrativo'}).click();await evidence(page);
 await expect(row(page,4)).toContainText('Non registrato');expect(await diag(page,'committed')).toEqual(state);
});
test('individual reports show only selected committed evidence and mask synthetic full names',async({page})=>{
 await open(page);await evidence(page);await student(page,1).click();
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 const report=page.getByRole('region',{name:'Evidenze individuali',exact:true});
 await expect(report).toContainText('Collegamenti esplicitati');await expect(report).toContainText('Da definire');
 await expect(report).not.toContainText('Motivazione pertinente');await expect(report).not.toContainText('Studente 2');
 await expect(page.getByText('Fittizio 0',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Torna al Tabellone'}).click();
 await expect(page.getByLabel('Prova',{exact:true})).toHaveValue('a2');
 await expect(page.getByLabel('Criterio',{exact:true})).toHaveValue('c1');
 await expect(student(page,1)).toHaveAttribute('aria-pressed','true');
 await student(page,2).click();await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 await expect(report).toContainText('Studente 2');await expect(report).toContainText('Non osservato');
 await expect(report).not.toContainText('Collegamenti esplicitati');
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('operational board geometry '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{const page=await context.newPage();await open(page);await evidence(page);
   if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   await review(page);await expect(confirm(page)).toBeVisible();
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(size.scroll).toBeLessThanOrEqual(size.client+1);
   await page.getByRole('button',{name:'Abbandona bozza'}).click();
  }finally{await context.close();}
 });
}

async function prepareDailyCriterion(page){
 const entry=page.getByTestId('daily-criterion-recorder');
 await entry.locator('summary').click();
 await entry.getByLabel('Prova svolta con criteri').selectOption('a2');
 await entry.getByLabel('Criterio della prova').selectOption('c1');
 await entry.getByLabel('Alunno per rilevazione').selectOption('s4');
 await entry.getByLabel('Stato della rilevazione').selectOption('observed');
 await entry.getByLabel('Tipo di evidenza').selectOption('product');
 await entry.getByLabel('Metodo della rilevazione').fill('Elaborato sintetico');
 await entry.getByLabel('Fatto osservato').fill('Schema sintetico delle relazioni');
 await entry.getByRole('button',{name:'Esamina rilevazione'}).click();
 await expect(entry.getByTestId('criterion-confirmation')).toBeVisible();
 return entry;
}
test('VAL-01/PRODUCT-02 real daily criterion writes only after encrypted DB2 commit and updates evidence',async({page})=>{
 test.setTimeout(120000);await open(page);
 const entry=await prepareDailyCriterion(page);
 const before=await diag(page,'physicalDigest'),original=await diag(page,'committed');
 await diag(page,'arm','hold');
 await entry.getByRole('button',{name:'Conferma e salva'}).click();
 await expect.poll(()=>diag(page,'held')).toBe(true);
 await expect(entry.getByRole('button',{name:'Salvataggio…'})).toBeDisabled();
 await expect(entry.getByText('Rilevazione salvata e verificata nell’archivio protetto.')).toHaveCount(0);
 expect(await diag(page,'physicalDigest')).toEqual(before);
 expect(await diag(page,'committed')).toEqual(original);
 await diag(page,'release');
 await expect(entry.getByText('Rilevazione salvata e verificata nell’archivio protetto.')).toBeVisible();
 const after=await diag(page,'physicalDigest'),committed=await diag(page,'committed');
 expect(Object.keys(after).filter(k=>before[k]!==after[k]).sort()).toEqual(['appData','meta']);
 expect(committed.changes).toBe(original.changes+1);
 expect(committed.grades).toEqual(original.grades);
 expect(committed.revisionIds).toHaveLength(original.revisionIds.length+1);
 await selector(page).getByRole('button',{name:'Evidenze',exact:true}).click();
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');
 await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
 await expect(row(page,4)).toContainText('Osservato');
});
for(const [width,height,scale] of [[320,700,200],[390,844,100]]){
 test('VAL-01/PRODUCT-02 daily criterion is usable without horizontal scrolling '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{
   const page=await context.newPage();await open(page);
   if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   const entry=await prepareDailyCriterion(page);
   await expect(entry.getByRole('button',{name:'Conferma e salva'})).toBeVisible();
   const geometry=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);
  }finally{await context.close();}
 });
}
