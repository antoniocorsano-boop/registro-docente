const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-operational.html';
const selector=page=>page.getByRole('group',{name:'Vista Tabellone'});
const panel=page=>page.getByRole('region',{name:'Bilancio formativo individuale',exact:true});
const preview=page=>page.getByRole('region',{name:'Anteprima per il destinatario'});
const sources=page=>panel(page).getByRole('region',{name:'Fonti disponibili'});
const diag=(page,method,...args)=>page.evaluate(({method,args})=>window.__val01BalanceDiagnostics[method](...args),{method,args});
const physical=page=>page.evaluate(()=>window.__val01OperationalDiagnostics.physicalDigest());
const committed=page=>page.evaluate(()=>window.__val01OperationalDiagnostics.committed());
async function open(page,n=1){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 await page.getByRole('button',{name:'Apri archivio dimostrativo'}).click();
 await expect(selector(page)).toBeVisible({timeout:15000});
 await selector(page).getByRole('button',{name:'Evidenze',exact:true}).click();
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');
 await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
 await page.getByRole('region',{name:'Righe studenti'}).getByRole('button',{name:'Studente '+n,exact:true}).click();
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 await page.getByRole('button',{name:'Restituzione',exact:true}).click();
 await expect(panel(page)).toBeVisible();
 expect(errors).toEqual([]);return errors;
}
async function dates(page){
 await panel(page).getByLabel('Dal',{exact:true}).fill('2026-09-01');
 await panel(page).getByLabel('Al',{exact:true}).fill('2027-01-31');
}
const review=page=>panel(page).getByRole('button',{name:'Rivedi bilancio',exact:true}).click();
const confirm=page=>preview(page).getByRole('button',{name:'Conferma bilancio',exact:true}).click();
const confirmed=page=>expect(preview(page).getByRole('status')).toContainText('Non salvato né inviato');
async function chooseOne(page){
 await dates(page);await sources(page).getByRole('checkbox').first().check();
 await panel(page).getByLabel('Apprendimenti',{exact:true}).fill('Riconosce le relazioni tra fasi.');
}
test('existing Restituzione, two selected facts, explicit teacher text, minimized preview and no archive write',async({page})=>{
 await open(page);await diag(page,'append','s1');const before=await physical(page),state=await committed(page);
 await dates(page);await expect(sources(page).getByRole('checkbox')).toHaveCount(2);
 await sources(page).getByRole('checkbox').nth(0).check();await sources(page).getByRole('checkbox').nth(1).check();
 await expect(sources(page)).toContainText('Dettaglio interno sintetico');
 await panel(page).getByLabel('Prima osservazione').selectOption('r-1');
 await panel(page).getByLabel('Seconda osservazione').selectOption('s7b-s1-r');
 await panel(page).getByLabel('Apprendimenti',{exact:true}).fill('Riconosce le relazioni tra fasi.');
 await panel(page).getByLabel('Progresso documentato',{exact:true}).fill('Motiva con maggiore precisione.');
 await panel(page).getByLabel('Prossimo passo',{exact:true}).fill('Spiegare la scelta delle risorse.');
 await review(page);await expect(preview(page)).toBeVisible();
 await expect(preview(page)).toContainText('Studente 1');await expect(preview(page)).toContainText('Obiettivo: Rappresentare la filiera');
 await expect(preview(page)).toContainText('Motiva con maggiore precisione.');
 for(const privateText of ['Dettaglio interno sintetico','Collegamenti esplicitati','private-synthetic-product','Studente 2','Nuova versione','Fittizio 0'])await expect(preview(page)).not.toContainText(privateText);
 await expect(page.getByRole('region',{name:'Evidenze individuali',exact:true})).toHaveCount(0);
 await expect(panel(page).getByRole('region',{name:'Fonti disponibili'})).toHaveCount(0);
 await confirm(page);await confirmed(page);
 expect(await physical(page)).toEqual(before);expect(await committed(page)).toEqual(state);
 await preview(page).getByRole('button',{name:'Modifica bozza'}).click();
 await expect(preview(page)).toHaveCount(0);
 await expect(panel(page).getByLabel('Progresso documentato',{exact:true})).toHaveValue('Motiva con maggiore precisione.');
});
test('one observation does not support progress; period changes clear selections and require review',async({page})=>{
 await open(page);await chooseOne(page);
 await panel(page).getByLabel('Progresso documentato',{exact:true}).fill('Progresso non confrontato');
 await review(page);await expect(panel(page).getByRole('alert')).toContainText('due osservazioni');
 await panel(page).getByLabel('Progresso documentato',{exact:true}).fill('');
 await review(page);await expect(preview(page)).toBeVisible();
 await preview(page).getByRole('button',{name:'Modifica bozza'}).click();
 await panel(page).getByLabel('Periodo',{exact:true}).selectOption('Q2');
 await expect(sources(page).getByRole('checkbox')).toHaveCount(0);
 await expect(sources(page)).toContainText('Nessuna evidenza disponibile');
 await review(page);await expect(panel(page).getByRole('alert')).toContainText('Seleziona almeno una evidenza');
 await panel(page).getByLabel('Periodo',{exact:true}).selectOption('Q1');
 await expect(sources(page).getByRole('checkbox')).toHaveCount(1);
 await expect(sources(page).getByRole('checkbox')).not.toBeChecked();
});
test('non-observation cannot support a learning judgment; no source does not confirm',async({page})=>{
 await open(page,2);await dates(page);
 await expect(sources(page)).toContainText('Non osservato');
 await sources(page).getByRole('checkbox').check();
 await panel(page).getByLabel('Apprendimenti',{exact:true}).fill('Giudizio privo di fatto');
 await review(page);await expect(panel(page).getByRole('alert')).toContainText('almeno un fatto osservato');
 await panel(page).getByLabel('Apprendimenti',{exact:true}).fill('');
 await review(page);await expect(preview(page)).toContainText('Non osservato');await confirm(page);await confirmed(page);
});
test('dirty review guards view, recipient and return; explicit discard permits new recipient',async({page})=>{
 await open(page);await chooseOne(page);await review(page);
 const select=page.getByLabel('Seleziona alunno');
 await select.selectOption('s2');
 await expect(select).toHaveValue('s1');await expect(preview(page)).toContainText('Studente 1');
 await page.getByRole('button',{name:'Torna al Tabellone',exact:true}).click();
 await expect(page.getByText('Completa o abbandona la bozza prima di cambiare vista.')).toBeVisible();
 await expect(preview(page)).toBeVisible();
 await page.getByRole('button',{name:'Torna alla scheda interna',exact:true}).click();
 await expect(preview(page)).toBeVisible();
 await panel(page).getByRole('button',{name:'Abbandona bilancio'}).click();
 await select.selectOption('s2');await expect(select).toHaveValue('s2');
 await page.getByRole('button',{name:'Restituzione',exact:true}).click();await expect(panel(page)).toContainText('Studente 2');
 await expect(panel(page).getByLabel('Apprendimenti',{exact:true})).toHaveValue('');
 await dates(page);await expect(sources(page)).not.toContainText('Collegamenti esplicitati');
});
test('actual committed unrelated evidence preserves confirmation; correction invalidates it and retains teacher draft',async({page})=>{
 await open(page);await chooseOne(page);await review(page);await confirm(page);await confirmed(page);
 await diag(page,'append','s5');await confirmed(page);
 await diag(page,'correct');await expect(preview(page)).toHaveCount(0);
 await expect(panel(page).getByRole('alert')).toContainText('Le evidenze sono cambiate');
 await expect(panel(page).getByLabel('Apprendimenti',{exact:true})).toHaveValue('Riconosce le relazioni tra fasi.');
 await expect(sources(page).getByRole('checkbox')).toHaveCount(1);
 await expect(sources(page).getByRole('checkbox')).not.toBeChecked();await expect(sources(page)).toContainText('Non osservato');
 await expect(panel(page).getByText('Bilancio confermato nella dimostrazione.',{exact:false})).toHaveCount(0);
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('formative balance mobile geometry '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{const page=await context.newPage(),errors=await open(page);
   if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   await chooseOne(page);await review(page);await expect(preview(page)).toBeVisible();
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(size.scroll).toBeLessThanOrEqual(size.client+1);expect(errors).toEqual([]);
   const root=process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence';
   await fs.mkdir(path.join(root,'screenshots'),{recursive:true});
   await page.screenshot({path:path.join(root,'screenshots','val01-s7b-'+width+'-'+scale+'.png'),fullPage:true});
   await panel(page).getByRole('button',{name:'Abbandona bilancio'}).click();
  }finally{await context.close();}
 });
}
