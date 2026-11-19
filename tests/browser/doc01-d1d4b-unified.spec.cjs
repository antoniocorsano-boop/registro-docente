const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence');
const url=(process.env.BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/doc01-d1d4b.html';
async function scenario(browser,viewport,id,action){
 fs.mkdirSync(path.join(dir,'doc01-unified-screenshots'),{recursive:true});
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];const crashes=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('crash',()=>crashes.push('crash'));
 let failure=null;const screenshot='doc01-unified-screenshots/'+id+'.png';
 try{await page.goto(url);await action(page);}catch(e){failure=e;}
 try{await page.screenshot({path:path.join(dir,screenshot),fullPage:true});}catch(e){failure??=e;}
 try{await context.close();expect(errors).toEqual([]);expect(crashes).toEqual([]);expect(fs.statSync(path.join(dir,screenshot)).size).toBeGreaterThan(0);}catch(e){failure??=e;}
 fs.writeFileSync(path.join(dir,'doc01-unified-'+id+'.json'),JSON.stringify({caseId:id,candidateSha:process.env.CANDIDATE_SHA,result:failure?'FAIL':'PASS',pageErrors:errors,crashes,screenshot},null,2));
 if(failure)throw failure;
}
const prepare=async page=>{await page.getByRole('button',{name:'Prepara anteprima'}).click();await expect(page.getByRole('list',{name:'Fonti documentali'})).toBeVisible();};
const rows=page=>page.getByRole('list',{name:'Fonti documentali'}).getByRole('listitem');
const confirm=page=>page.getByRole('button',{name:'Conferma la revisione'});
test('three sources, provenance, incomplete fields and partial confirmation',async({browser})=>scenario(browser,{width:390,height:844},'review',async page=>{
 await prepare(page);await expect(rows(page)).toHaveCount(3);
 await expect(rows(page).nth(0)).toContainText('1 riferimento');
 await expect(rows(page).nth(1)).toContainText('1 UDA · 4 ore');await expect(rows(page).nth(1)).toContainText('ore programmate');
 await expect(rows(page).nth(2)).toContainText('1 registrazione · 1,5 ore');await expect(rows(page).nth(2)).toContainText('Solo registrazioni selezionate');
 await expect(rows(page).nth(0).getByText('Arena · annualità disciplinari selezionate')).toBeHidden();
 await rows(page).nth(0).locator('summary').click();await expect(rows(page).nth(0).getByText('Arena · annualità disciplinari selezionate')).toBeVisible();
 await page.getByText('Informazioni da completare (4)',{exact:false}).click();await expect(page.getByText('Obiettivi disciplinari',{exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/demo-|Titolo dimostrativo|Contenuto dimostrativo|sourceCommit/);
 await confirm(page).click();await expect(page.getByRole('status')).toContainText('Nessun documento salvato o approvato');await expect(page.getByText('Documento incompleto.',{exact:false})).toBeVisible();
}));
test('missing is not zero and partial review remains confirmable',async({browser})=>scenario(browser,{width:390,height:844},'missing',async page=>{
 await page.getByRole('button',{name:'Fonte non selezionata'}).click();await prepare(page);
 await expect(rows(page).nth(1)).toContainText('Non selezionata');await expect(rows(page).nth(1)).not.toContainText('0 ore');
 await expect(confirm(page)).toBeEnabled();await confirm(page).click();await expect(page.getByRole('status')).toContainText('Revisione confermata');
}));
test('invalid and entirely missing selections block confirmation',async({browser})=>scenario(browser,{width:320,height:700},'blocked',async page=>{
 await page.getByRole('button',{name:'Fonte da verificare'}).click();await prepare(page);
 await expect(rows(page).nth(1)).toContainText('Da verificare');await expect(rows(page).nth(0)).toContainText('Disponibile');await expect(confirm(page)).toBeDisabled();
 await page.getByRole('button',{name:'Nessuna fonte'}).click();await prepare(page);
 await expect(rows(page)).toHaveCount(3);await expect(confirm(page)).toBeDisabled();await expect(page.getByText('Seleziona o verifica le fonti prima di confermare.')).toBeVisible();
}));
test('source change after confirmation hides previous review; restart works',async({browser})=>scenario(browser,{width:390,height:844},'invalidation',async page=>{
 await prepare(page);await confirm(page).click();
 await page.getByRole('button',{name:'Modifica curricolo'}).click();await expect(page.getByRole('list',{name:'Fonti documentali'})).toHaveCount(0);
 await expect(page.getByRole('status')).toContainText('Le informazioni sono cambiate');
 await page.getByRole('button',{name:'Fonte non selezionata'}).click();
 await page.getByRole('button',{name:'Tre fonti'}).click();
 await expect(page.getByRole('list',{name:'Fonti documentali'})).toHaveCount(0);
 await prepare(page);await expect(confirm(page)).toBeEnabled();
 await page.getByRole('button',{name:'Ricomincia'}).click();await expect(page.getByRole('list',{name:'Fonti documentali'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Prepara anteprima'})).toBeVisible();
}));
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('unified document geometry '+width+' '+scale+'%',async({browser})=>scenario(browser,{width,height},'geometry-'+width+'-'+scale,async page=>{
  if(scale===200)await page.addStyleTag({content:'html{font-size:200% !important}'});
  await prepare(page);await expect(confirm(page)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await confirm(page).click();await expect(page.getByRole('status')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }));
}
