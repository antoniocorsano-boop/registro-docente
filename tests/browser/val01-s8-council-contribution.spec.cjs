const {test,expect}=require('@playwright/test');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d-operational.html';
const balance=page=>page.getByRole('region',{name:'Bilancio formativo individuale',exact:true});
const panel=page=>page.getByRole('region',{name:'Contributo disciplinare',exact:true});
const preview=page=>page.getByRole('region',{name:'Anteprima del contributo',exact:true});
const council=page=>page.getByRole('region',{name:'Consigli di classe',exact:true});
const session=(page,n)=>council(page).getByRole('list',{name:'Elenco cronologico delle sedute'}).getByRole('button').filter({hasText:n});
const diag=(page,method,...args)=>page.evaluate(({method,args})=>window.__val01BalanceDiagnostics[method](...args),{method,args});
const physical=page=>page.evaluate(()=>window.__val01OperationalDiagnostics.physicalDigest());
const committed=page=>page.evaluate(()=>window.__val01OperationalDiagnostics.committed());
async function transfer(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 await page.getByRole('button',{name:'Apri archivio dimostrativo'}).click();
 const selector=page.getByRole('group',{name:'Vista Tabellone'});
 await selector.getByRole('button',{name:'Evidenze',exact:true}).click();
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
 await page.getByRole('region',{name:'Righe studenti'}).getByRole('button',{name:'Studente 1',exact:true}).click();
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();await page.getByRole('button',{name:'Restituzione',exact:true}).click();
 await balance(page).getByLabel('Dal',{exact:true}).fill('2026-09-01');await balance(page).getByLabel('Al',{exact:true}).fill('2027-01-31');
 await balance(page).getByRole('region',{name:'Fonti disponibili'}).getByRole('checkbox').first().check();
 await balance(page).getByLabel('Apprendimenti',{exact:true}).fill('Relazioni documentate dal docente.');
 await balance(page).getByLabel('Prossimo passo',{exact:true}).fill('Passo successivo non selezionato.');
 await balance(page).getByRole('button',{name:'Rivedi bilancio',exact:true}).click();
 await balance(page).getByRole('button',{name:'Conferma bilancio',exact:true}).click();
 await balance(page).getByRole('button',{name:'Prepara contributo al Consiglio',exact:true}).click();
 await expect(council(page)).toBeVisible();
 await expect(panel(page)).toHaveCount(0);
 await council(page).getByLabel('Seleziona classe per il Consiglio').selectOption('synthetic-board');
 await expect(council(page).getByRole('list',{name:'Elenco cronologico delle sedute'})).toBeVisible();
 expect(errors).toEqual([]);return errors;
}
async function open(page){
 const errors=await transfer(page);await session(page,'Primo periodo').click();
 await expect(panel(page).getByLabel('Includi apprendimenti',{exact:true})).toBeVisible();
 return errors;
}
async function review(page){
 await panel(page).getByLabel('Includi apprendimenti',{exact:true}).check();
 await panel(page).getByRole('button',{name:'Rivedi contributo',exact:true}).click();
 await expect(preview(page)).toBeVisible();
}
test('confirmed individual balance reuses only selected teacher text in existing council session, no writes',async({page})=>{
 await open(page);const before=await physical(page),state=await committed(page);
 await expect(panel(page).getByLabel('Includi prossimo passo')).not.toBeChecked();
 await review(page);await expect(preview(page)).toContainText('Studente 1');
 await expect(preview(page)).toContainText('Relazioni documentate dal docente.');
 await expect(preview(page)).toContainText('Obiettivo: Rappresentare la filiera');
 await expect(preview(page)).toContainText('2027-02-05');
 for(const privateText of ['Passo successivo non selezionato.','Collegamenti esplicitati','Elaborato','Fittizio','Studente 2','rubric-v1'])await expect(preview(page)).not.toContainText(privateText);
 await expect(council(page).getByRole('button',{name:'Salva valutazioni di ingresso'})).toHaveCount(0);
 await preview(page).getByRole('button',{name:'Conferma contributo personale'}).click();
 await expect(preview(page).getByRole('status')).toContainText('Non salvato né trasmesso');
 expect(await physical(page)).toEqual(before);expect(await committed(page)).toEqual(state);
});
test('period and session must match; changing context during review is blocked until discard',async({page})=>{
 await transfer(page);await session(page,'25 nov').click();
 await expect(panel(page).getByRole('alert')).toContainText('La seduta non corrisponde');
 await expect(panel(page).getByLabel('Includi apprendimenti')).toHaveCount(0);
 await session(page,'Primo periodo').click();await review(page);
 await session(page,'8 feb').click();await expect(preview(page)).toContainText('2027-02-05');
 await expect(page.getByText('Completa o abbandona la bozza prima di cambiare vista.')).toBeVisible();
 await page.getByRole('button',{name:'Torna alla scheda individuale'}).click();await expect(preview(page)).toBeVisible();
 await panel(page).getByRole('button',{name:'Abbandona contributo'}).click();
 await session(page,'8 feb').click();await review(page);await expect(preview(page)).toContainText('2027-02-08');
});
test('correction of source revokes reviewed contribution; unrelated committed evidence preserves it',async({page})=>{
 await open(page);await review(page);await preview(page).getByRole('button',{name:'Conferma contributo personale'}).click();
 await expect(preview(page).getByRole('status')).toContainText('Non salvato né trasmesso');
 await diag(page,'append','s5');await expect(preview(page).getByRole('status')).toContainText('Non salvato né trasmesso');
 await diag(page,'correct');await expect(preview(page)).toHaveCount(0);
 await expect(panel(page).getByRole('alert')).toContainText('Bilancio non più valido');
 await expect(panel(page).getByText('Relazioni documentate dal docente.',{exact:true})).toHaveCount(0);
 await panel(page).getByRole('button',{name:'Abbandona contributo'}).click();
 await page.getByRole('button',{name:'Torna alla scheda individuale'}).click();
 await expect(page.getByRole('region',{name:'Scheda alunno dimostrativa'})).toBeVisible();
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('council contribution mobile geometry '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{const page=await context.newPage(),errors=await open(page);
   if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   await review(page);const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(size.scroll).toBeLessThanOrEqual(size.client+1);expect(errors).toEqual([]);
   await panel(page).getByRole('button',{name:'Abbandona contributo'}).click();
  }finally{await context.close();}
 });
}
