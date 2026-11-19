const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence');
const url=(process.env.BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/doc01-d1c.html';
async function scenario(browser,viewport,id,action){
  fs.mkdirSync(path.join(dir,'doc01-screenshots'),{recursive:true});
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];const crashes=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('crash',()=>crashes.push('crash'));
  let failure=null;const screenshot='doc01-screenshots/'+id+'.png';
  try {await page.goto(url);await action(page);}catch(e){failure=e;}
  try {await page.screenshot({path:path.join(dir,screenshot),fullPage:true});}catch(e){failure??=e;}
  try {await context.close();expect(errors).toEqual([]);expect(crashes).toEqual([]);expect(fs.statSync(path.join(dir,screenshot)).size).toBeGreaterThan(0);}catch(e){failure??=e;}
  fs.writeFileSync(path.join(dir,'doc01-'+id+'.json'),JSON.stringify({caseId:id,candidateSha:process.env.CANDIDATE_SHA,result:failure?'FAIL':'PASS',pageErrors:errors,crashes,screenshot},null,2));
  if(failure)throw failure;
}
async function prepare(page){await page.getByRole('button',{name:'Prepara anteprima'}).click();await expect(page.getByRole('list',{name:'Sezioni del contributo'})).toBeVisible();}
test('document fields, withheld value, provenance and partial confirmation',async({browser})=>scenario(browser,{width:390,height:844},'review',async page=>{
  await prepare(page);
  await expect(page.getByText('Informazioni incomplete.',{exact:false})).toBeVisible();
  const rows=page.getByRole('list',{name:'Sezioni del contributo'}).getByRole('listitem');
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0)).toContainText('Sistemi tecnologici');
  await expect(rows.nth(1)).toContainText('Da verificare');
  await expect(rows.nth(1)).not.toContainText('Cittadinanza responsabile');
  await expect(rows.nth(2)).toContainText('Mancante');
  await expect(rows.nth(3).getByText('0',{exact:true})).toBeVisible();
  await rows.nth(0).locator('summary').click();
  await expect(rows.nth(0).getByText('Curricolo',{exact:true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText('demo-private-ref');
  await page.getByRole('button',{name:'Conferma le informazioni'}).click();
  await expect(page.getByRole('status')).toContainText('Nessun documento salvato o approvato');
  await expect(page.getByText('Informazioni incomplete.',{exact:false})).toBeVisible();
}));
test('source and context changes invalidate confirmation',async({browser})=>scenario(browser,{width:390,height:844},'invalidation',async page=>{
  await prepare(page);await page.getByRole('button',{name:'Conferma le informazioni'}).click();
  await page.getByRole('button',{name:'Modifica la fonte'}).click();
  await expect(page.getByRole('list',{name:'Sezioni del contributo'})).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('informazioni sono cambiate');
  await prepare(page);
  await page.getByRole('button',{name:'Cambia contesto di prova'}).click();
  await expect(page.getByRole('list',{name:'Sezioni del contributo'})).toHaveCount(0);
  await page.getByRole('button',{name:'Prepara anteprima'}).click();
  await expect(page.getByRole('status')).toContainText('Anteprima non disponibile');
}));
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
  test('document geometry '+width+' '+scale+'%',async({browser})=>scenario(browser,{width,height},'geometry-'+width+'-'+scale,async page=>{
    if(scale===200)await page.addStyleTag({content:'html{font-size:200% !important}'});
    await prepare(page);
    await expect(page.getByRole('button',{name:'Conferma le informazioni'})).toBeVisible();
    const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
    expect(fits).toBe(true);
    await page.getByRole('button',{name:'Conferma le informazioni'}).click();
    await expect(page.getByRole('status')).toBeVisible();
  }));
}
