const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const url=(process.env.PRODUCT05_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-product05-qualification.html';
const dir=process.env.PRODUCT05_EVIDENCE_DIR||'browser-evidence';
fs.mkdirSync(dir,{recursive:true});
const panel=p=>p.getByTestId('student-formative-sources');
const editor=p=>p.getByTestId('student-formative-review');
const preview=p=>editor(p).getByRole('region',{name:'Anteprima del bilancio per il destinatario'});
async function start(page,width=390,zoom=false){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:width===320?700:844});
 const response=await page.goto(url);expect(response?.ok()).toBe(true);
 if(zoom)await page.evaluate(()=>document.documentElement.style.fontSize='32px');
 await page.getByRole('button',{name:'Dossier',exact:true}).click();
 await expect(panel(page)).toBeVisible();
 await panel(page).locator('summary').click();
 await expect(panel(page).getByLabel('Data iniziale del bilancio')).toBeVisible();
 return errors;
}
async function dates(page){
 await panel(page).getByLabel('Data iniziale del bilancio').fill('2026-09-01');
 await panel(page).getByLabel('Data finale del bilancio').fill('2027-01-31');
 await expect(panel(page).getByTestId('student-formative-source-count')).toBeVisible();
}
async function edit(page){
 await dates(page);
 await panel(page).getByTestId('student-formative-start').click();
 await expect(editor(page)).toBeVisible();
}
async function choose(page,text='Il docente osserva la filiera.'){
 await editor(page).getByRole('group',{name:'Evidenze selezionabili'}).getByRole('checkbox').first().check();
 await editor(page).getByLabel('Apprendimenti',{exact:true}).fill(text);
}
async function capture(page,label){
 const rect=await editor(page).evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,width:innerWidth,scroll:document.documentElement.scrollWidth};});
 expect(rect.left).toBeGreaterThanOrEqual(-1);
 expect(rect.right).toBeLessThanOrEqual(rect.width+1);
 await page.screenshot({path:path.join(dir,label+'.png'),fullPage:true});
}
for(const width of [320,390]){
 test('S7 / '+width+'px — individual teacher selection, allowlisted preview and explicit transient confirmation',async({page})=>{
  const errors=await start(page,width);await edit(page);
  await expect(editor(page)).toContainText('0 fonti scelte esplicitamente');
  await expect(preview(page)).toHaveCount(0);
  await choose(page);
  await editor(page).getByRole('button',{name:'Rivedi bilancio'}).click();
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toContainText('Filiera sintetica');
  await expect(preview(page)).toContainText('Rappresentare la filiera');
  await expect(preview(page)).toContainText('Il docente osserva la filiera.');
  for(const internal of ['Collegamenti esplicitati','rubric-v1','private-product','s2','other-student'])
   await expect(preview(page)).not.toContainText(internal);
  await expect(preview(page).getByRole('button',{name:'Conferma riesame locale'})).toBeVisible();
  await preview(page).getByRole('button',{name:'Conferma riesame locale'}).click();
  await expect(preview(page).getByRole('status')).toContainText('Non salvato né inviato');
  await capture(page,'product05-s7-'+width+'-review');
  expect(errors).toEqual([]);
 });
}
test('S7 / 320px text 200% — usable controls and no panel overflow',async({page})=>{
 const errors=await start(page,320,true);await edit(page);await choose(page);
 await editor(page).getByRole('button',{name:'Rivedi bilancio'}).click();
 await expect(preview(page)).toBeVisible();
 await capture(page,'product05-s7-320-text200');
 expect(errors).toEqual([]);
});
test('S7 — not-observed is not evidence for a learning judgement',async({page})=>{
 const errors=await start(page);
 await page.getByLabel('Seleziona alunno').selectOption('s2');
 await page.getByRole('button',{name:'Dossier',exact:true}).click();
 await panel(page).locator('summary').click();
 await edit(page);
 await choose(page,'Apprendimento non documentato');
 await editor(page).getByRole('button',{name:'Rivedi bilancio'}).click();
 await expect(editor(page).getByRole('alert')).toContainText('richiede evidenze osservate');
 await expect(preview(page)).toHaveCount(0);
 expect(errors).toEqual([]);
});
test('S7 — progress without a valid comparison is rejected',async({page})=>{
 const errors=await start(page);await edit(page);await choose(page);
 await editor(page).getByLabel('Progresso documentato',{exact:true}).fill('Miglioramento non verificato');
 await editor(page).getByRole('button',{name:'Rivedi bilancio'}).click();
 await expect(editor(page).getByRole('alert')).toContainText('due osservazioni confrontabili');
 await expect(preview(page)).toHaveCount(0);
 expect(errors).toEqual([]);
});
test('S7 — privacy reset clears selected sources and recipient switch cannot reuse preview',async({page})=>{
 const errors=await start(page);await edit(page);await choose(page);
 await editor(page).getByRole('button',{name:'Rivedi bilancio'}).click();
 await expect(preview(page)).toBeVisible();
 await page.getByTestId('qual-privacy-toggle').click();
 await expect(editor(page)).toHaveCount(0);
 await panel(page).locator('summary').click();
 await expect(panel(page)).toContainText('Attiva la protezione dei nominativi');
 await page.getByTestId('qual-privacy-toggle').click();
 await page.getByRole('button',{name:'Dossier',exact:true}).click();
 await panel(page).locator('summary').click();
 await dates(page);
 await panel(page).getByTestId('student-formative-start').click();
 await expect(editor(page)).toContainText('0 fonti scelte esplicitamente');
 await page.getByLabel('Seleziona alunno').selectOption('s2');
 await expect(editor(page)).toHaveCount(0);
 expect(errors).toEqual([]);
});
