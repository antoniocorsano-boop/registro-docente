const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s6c.html';
async function open(page){
 await page.goto(url);
 await page.getByLabel('Prova',{exact:true}).selectOption('a2');
 await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
 await expect(page.getByRole('region',{name:'Righe studenti'})).toBeVisible();
}
const student=(page,n)=>page.getByRole('button',{name:'Studente '+n,exact:true});
const row=(page,n)=>student(page,n).locator('..');
test('four distinct states, one criterion for the class and exact individual detail',async({page})=>{
 await open(page);
 await expect(row(page,1)).toContainText('Osservato');await expect(row(page,2)).toContainText('Non osservato');
 await expect(row(page,3)).toContainText('Non pertinente');await expect(row(page,4)).toContainText('Non registrato');
 await expect(row(page,5)).toContainText('Non registrato');
 await student(page,1).click();await expect(page.getByRole('region',{name:'Rilevazione individuale'})).toContainText('Collegamenti esplicitati');
 await page.getByLabel('Criterio',{exact:true}).selectOption('c2');
 await expect(row(page,1)).toContainText('Non registrato');await expect(row(page,5)).toContainText('Osservato');
 await expect(page.getByRole('region',{name:'Rilevazione individuale'})).toHaveCount(0);
});
test('explicit new observation, edited preview invalidation, correction and withdrawal; no storage',async({page})=>{
 await open(page);await student(page,4).click();await page.getByRole('button',{name:'Nuova rilevazione'}).click();
 await page.getByLabel('Stato',{exact:true}).selectOption('observed');
 await page.getByLabel('Tipo di evidenza').selectOption('product');await page.getByLabel('Fatto osservato').fill('Schema dimostrativo');
 await page.getByLabel('Metodo',{exact:true}).fill('Elaborato');
 await page.getByLabel('Interpretazione',{exact:true}).selectOption('pending');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await expect(page.getByRole('region',{name:'Riepilogo prima della conferma'})).toBeVisible();
 await page.getByLabel('Fatto osservato').fill('Schema riveduto');await expect(page.getByRole('button',{name:'Conferma rilevazione'})).toHaveCount(0);
 await expect(row(page,4)).toContainText('Non registrato');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(page.getByRole('status')).toContainText('Nessun dato salvato');await expect(row(page,4)).toContainText('Osservato');
 await page.getByRole('button',{name:'Correggi'}).click();await page.getByLabel('Stato',{exact:true}).selectOption('not_observed');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(row(page,4)).toContainText('Non osservato');await expect(page.getByRole('button',{name:'Correggi'})).toHaveCount(1);
 await page.getByRole('button',{name:'Ritira'}).click();await page.getByLabel('Motivo del ritiro').fill('Rilevazione da ritirare');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(row(page,4)).toContainText('Non registrato');await expect(page.getByRole('button',{name:'Correggi'})).toHaveCount(0);
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
 await page.reload();await page.getByLabel('Prova',{exact:true}).selectOption('a2');await page.getByLabel('Criterio',{exact:true}).selectOption('c1');
 await expect(row(page,4)).toContainText('Non registrato');
});
test('unconfirmed draft does not change the board and context stays fixed',async({page})=>{
 await open(page);await student(page,4).click();await page.getByRole('button',{name:'Nuova rilevazione'}).click();
 await page.getByLabel('Stato',{exact:true}).selectOption('not_applicable');await page.getByRole('button',{name:'Rivedi rilevazione'}).click();
 await expect(page.getByLabel('Criterio',{exact:true})).toBeDisabled();await expect(student(page,1)).toBeDisabled();
 await page.getByRole('button',{name:'Abbandona bozza'}).click();await expect(row(page,4)).toContainText('Non registrato');
 await expect(page.getByLabel('Criterio',{exact:true})).toBeEnabled();
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('mobile geometry '+width+' / '+scale+'%',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page);if(scale===200)await page.addStyleTag({content:'html {font-size:200% !important;}'});
   await student(page,4).click();await page.getByRole('button',{name:'Nuova rilevazione'}).click();
   await page.getByLabel('Stato',{exact:true}).selectOption('not_applicable');await page.getByRole('button',{name:'Rivedi rilevazione'}).click();
   await expect(page.getByRole('button',{name:'Conferma rilevazione'})).toBeVisible();
   const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   expect(size.scroll).toBeLessThanOrEqual(size.client+1);expect(errors).toEqual([]);
   const root=process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence';await fs.mkdir(path.join(root,'screenshots'),{recursive:true});
   await page.screenshot({path:path.join(root,'screenshots','val01-s6c-'+width+'-'+scale+'.png'),fullPage:true});
  }finally{await context.close();}
 });
}

test('frozen rubric: explicit level, descriptor, preview invalidation and preserved correction',async({page})=>{
 await open(page);await student(page,1).click();await page.getByRole('button',{name:'Correggi'}).click();
 await page.getByLabel('Interpretazione',{exact:true}).selectOption('level');
 const levels=page.getByLabel('Livello',{exact:true});
 await expect(levels.locator('option')).toHaveText(['Seleziona livello','Parziale','Coerente']);
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await expect(page.getByRole('alert')).toContainText('completa i campi');
 await levels.selectOption('l2');await expect(page.getByText('Motiva i collegamenti tra fasi',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await expect(page.getByRole('region',{name:'Riepilogo prima della conferma'})).toContainText('Coerente');
 await levels.selectOption('l1');await expect(page.getByRole('button',{name:'Conferma rilevazione'})).toHaveCount(0);
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(page.getByRole('status')).toContainText('Nessun dato salvato');await expect(page.getByRole('region',{name:'Rilevazione individuale'})).toContainText('Interpretazione: Parziale');
 await page.getByRole('button',{name:'Correggi'}).click();await expect(levels).toHaveValue('l1');
});
test('without rubric only pending or descriptive interpretation; no implicit choice',async({page})=>{
 await open(page);await page.getByLabel('Criterio',{exact:true}).selectOption('c2');await student(page,4).click();
 await page.getByRole('button',{name:'Nuova rilevazione'}).click();
 await page.getByLabel('Stato',{exact:true}).selectOption('observed');await page.getByLabel('Tipo di evidenza').selectOption('product');
 await page.getByLabel('Fatto osservato').fill('Scelta motivata');await page.getByLabel('Metodo',{exact:true}).fill('Elaborato');
 const modes=page.getByLabel('Interpretazione',{exact:true});await expect(modes.locator('option')).toHaveText(['Seleziona interpretazione','Da definire','Descrittiva']);
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await expect(page.getByRole('alert')).toBeVisible();
 await modes.selectOption('description');await page.getByLabel('Interpretazione descrittiva').fill('Motivazione pertinente');
 await page.getByRole('button',{name:'Rivedi rilevazione'}).click();await page.getByRole('button',{name:'Conferma rilevazione'}).click();
 await expect(page.getByRole('status')).toContainText('Nessun dato salvato');await expect(page.getByRole('region',{name:'Rilevazione individuale'})).toContainText('Motivazione pertinente');
});
