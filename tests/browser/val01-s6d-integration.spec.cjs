const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6d.html';
const selector=page=>page.getByRole('group',{name:'Vista Tabellone'});
const select=(page,view)=>selector(page).getByRole('button',{name:view,exact:true}).click();
const board=page=>page.getByRole('region',{name:'Righe studenti'});
const student=(page,n)=>board(page).getByRole('button',{name:'Studente '+n,exact:true});
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 await expect(selector(page)).toBeVisible();expect(errors).toEqual([]);return errors;
}
async function enterEvidence(page){
 await select(page,'Evidenze');
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');
 await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
}
test('existing daily and historical views coexist with isolated evidence and retain selection',async({page})=>{
 const errors=await open(page);
 await expect(selector(page).getByRole('button',{name:'Oggi'})).toHaveAttribute('aria-pressed','true');
 await select(page,'Storico');await expect(page.getByRole('heading',{name:'Tabellone Classe: Classe dimostrativa'})).toBeVisible();
 await enterEvidence(page);await expect(student(page,1)).toBeVisible();
 await select(page,'Oggi');await expect(board(page)).not.toBeVisible();
 await select(page,'Evidenze');await expect(page.getByLabel('Prova',{exact:true})).toHaveValue('a2');
 await expect(page.getByLabel('Criterio',{exact:true})).toHaveValue('c1');
 expect(errors).toEqual([]);
});
test('evidence draft blocks switching and confirmed record reaches only selected student report',async({page})=>{
 const errors=await open(page);await enterEvidence(page);await student(page,4).click();
 await page.getByRole('button',{name:'Nuova rilevazione'}).click();
 await page.getByLabel('Stato',{exact:true}).selectOption('not_applicable');
 await select(page,'Storico');await expect(page.getByRole('alert')).toContainText('Completa o abbandona');
 await expect(selector(page).getByRole('button',{name:'Evidenze'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(student(page,4).locator('..')).toContainText('Non pertinente');
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 const report=page.getByRole('region',{name:'Evidenze individuali',exact:true});
 await expect(report).toContainText('Studente 4');await expect(report).toContainText('Non pertinente');
 await expect(report).not.toContainText('Osservato');await expect(report).not.toContainText('Motivazione tecnica');
 await page.getByRole('button',{name:'Torna al Tabellone'}).click();
 await expect(page.getByLabel('Criterio',{exact:true})).toHaveValue('c1');
 await expect(student(page,4)).toHaveAttribute('aria-pressed','true');
 await expect(student(page,4).locator('..')).toContainText('Non pertinente');
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
 expect(errors).toEqual([]);
});
test('report contains only selected evidence and no full synthetic names with privacy active',async({page})=>{
 await open(page);await enterEvidence(page);await student(page,1).click();
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();
 const report=page.getByRole('region',{name:'Evidenze individuali',exact:true});
 await expect(report).toContainText('Studente 1');await expect(report).toContainText('Osservato');
 await expect(report).not.toContainText('Non osservato');await expect(report).not.toContainText('Studente 2');
 await expect(page.getByText('Ada Fittizia',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Torna al Tabellone'}).click();await student(page,2).click();
 await page.getByRole('button',{name:'Apri scheda alunno'}).click();await expect(report).toContainText('Studente 2');await expect(report).toContainText('Non osservato');
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('integrated evidence geometry '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{const page=await context.newPage(),errors=await open(page);await enterEvidence(page);
   if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   await student(page,1).click();await expect(page.getByRole('button',{name:'Apri scheda alunno'})).toBeVisible();
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(size.scroll).toBeLessThanOrEqual(size.client+1);expect(errors).toEqual([]);
   const root=process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence';await fs.mkdir(path.join(root,'screenshots'),{recursive:true});
   await page.screenshot({path:path.join(root,'screenshots','val01-s6d-'+width+'-'+scale+'.png'),fullPage:true});
  }finally{await context.close();}
 });
}
