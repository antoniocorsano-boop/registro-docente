const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const base=process.env.PRODUCT05_BASE_URL||'http://127.0.0.1:4173';
const url=base+'/tests/browser/fixtures/val01-product05-qualification.html';
const panel=page=>page.getByTestId('student-formative-sources');
const output=process.env.PRODUCT05_EVIDENCE_DIR||'browser-evidence';
fs.mkdirSync(output,{recursive:true});
async function open(page,width=390,height=844,font200=false){
 await page.setViewportSize({width,height});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const response=await page.goto(url);
 expect(response?.ok()).toBe(true);
 if(font200)await page.evaluate(()=>{document.documentElement.style.fontSize='32px'});
 await expect(page.getByTestId('student-report-workspace')).toBeVisible();
 await page.getByRole('button',{name:'Dossier',exact:true}).click();
 await expect(panel(page)).toBeVisible();
 await panel(page).locator('summary').click();
 await expect(panel(page).getByLabel('Periodo del bilancio')).toBeVisible();
 return errors;
}
async function dates(page,from='2026-09-01',to='2027-01-31'){
 await panel(page).getByLabel('Data iniziale del bilancio').fill(from);
 await panel(page).getByLabel('Data finale del bilancio').fill(to);
}
async function geometry(page,width,name){
 const coords=await page.evaluate(()=>{
  const el=document.querySelector('[data-testid="student-formative-sources"]');
  const b=el.getBoundingClientRect();
  return {x:b.left,right:b.right,w:window.innerWidth,scroll:document.documentElement.scrollWidth};
 });
 expect(coords.w).toBe(width);
 expect(coords.x).toBeGreaterThanOrEqual(-1);
 expect(coords.right).toBeLessThanOrEqual(coords.w+1);
 await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
}
for(const width of [320,390]){
 test('Dossier / '+width+'px — confirmed own record, dates and safe projection',async({page})=>{
  const errors=await open(page,width,width===320?700:844);
  await dates(page);
  await expect(panel(page).getByTestId('student-formative-source-count')).toContainText('1 osservate');
  await expect(panel(page)).toContainText('Filiera sintetica');
  await expect(panel(page)).toContainText('Relazioni tra fasi');
  for(const forbidden of ['Scelta motivata','Collegamenti esplicitati','private-product','Motivazione tecnica'])
   await expect(panel(page)).not.toContainText(forbidden);
  await expect(panel(page).getByRole('button',{name:/Conferma bilancio|Salva bilancio|Esporta bilancio/})).toHaveCount(0);
  await geometry(page,width,'val01-product05-'+width+'-normal');
  expect(errors).toEqual([]);
 });
}
test('320px, testo 200% — fruibilità, nessuna fonte implicita',async({page})=>{
 const errors=await open(page,320,700,true);
 await expect(panel(page)).toContainText('Seleziona entrambe le date');
 await expect(panel(page)).not.toContainText('Filiera sintetica');
 await dates(page);
 await expect(panel(page)).toContainText('Filiera sintetica');
 await geometry(page,320,'val01-product05-320-text-200');
 expect(errors).toEqual([]);
});
test('privacy and student selection invalidate access to previous records',async({page})=>{
 const errors=await open(page);
 await dates(page);
 await expect(panel(page)).toContainText('Filiera sintetica');
 await page.getByTestId('qual-privacy-toggle').click();
 await expect(panel(page)).toContainText('Attiva la protezione dei nominativi');
 await expect(panel(page)).not.toContainText('Filiera sintetica');
 await page.getByTestId('qual-privacy-toggle').click();
 await page.getByLabel('Seleziona alunno').selectOption('s2');
 await page.getByRole('button',{name:'Dossier',exact:true}).click();
 await panel(page).locator('summary').click();
 await dates(page);
 await expect(panel(page).getByTestId('student-formative-source-count')).toContainText('1 non osservate');
 await expect(panel(page)).toContainText('Non osservato');
 await expect(panel(page)).not.toContainText('Collegamenti esplicitati');
 expect(errors).toEqual([]);
});
test('foreign date window and second period produce no fabricated results',async({page})=>{
 const errors=await open(page);
 await dates(page,'2025-11-30','2027-01-31');
 await expect(panel(page)).toContainText('Periodo, contesto o archivio non verificabile');
 await expect(panel(page)).not.toContainText('Filiera sintetica');
 await dates(page);
 await panel(page).getByLabel('Periodo del bilancio').selectOption('Q2');
 await expect(panel(page)).toContainText('Nessuna rilevazione confermata nel periodo selezionato');
 await expect(panel(page)).not.toContainText('Filiera sintetica');
 expect(errors).toEqual([]);
});
