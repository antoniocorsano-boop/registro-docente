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
 let failure=null;let geometry=null;const screenshot='doc01-unified-screenshots/'+id+'.png';
 try{await page.goto(url+(id.startsWith('geometry-')?'?view=preview':''));geometry=await action(page)||null;}catch(e){failure=e;}
 try{const png=await page.screenshot({path:path.join(dir,screenshot),fullPage:true});const actualWidth=png.readUInt32BE(16),actualHeight=png.readUInt32BE(20);expect(actualWidth).toBe(viewport.width);if(geometry)geometry={...geometry,screenshotWidth:actualWidth,screenshotHeight:actualHeight};}catch(e){failure??=e;}
 try{await context.close();expect(errors).toEqual([]);expect(crashes).toEqual([]);expect(fs.statSync(path.join(dir,screenshot)).size).toBeGreaterThan(0);}catch(e){failure??=e;}
 fs.writeFileSync(path.join(dir,'doc01-unified-'+id+'.json'),JSON.stringify({caseId:id,candidateSha:process.env.CANDIDATE_SHA,result:failure?'FAIL':'PASS',pageErrors:errors,crashes,screenshot,geometry},null,2));
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
 await expect(page.getByText('Arena · annualità disciplinari selezionate')).toBeHidden();
 await page.getByText('Provenienza delle informazioni',{exact:true}).click();
 await expect(page.getByRole('list',{name:'Provenienza delle fonti'})).toBeVisible();
 await expect(page.getByText('Arena · annualità disciplinari selezionate')).toBeVisible();
 await expect(page.getByText('Docente OS · UDA confermate e selezionate')).toBeVisible();
 await expect(page.getByText('Registro Docente · diario delle attività selezionate')).toBeVisible();
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
// Do not compare two viewport measurements that can both inflate on mobile.
async function assertReflow(page,width,scale){
 const result=await page.evaluate(({width,scale})=>{
  const root=document.documentElement;
  const view=document.querySelector('.doc-preview');
  const issues=[];
  if(!view)return {issues:['preview absent']};
  const viewport={nominal:width,inner:window.innerWidth,client:root.clientWidth,scroll:root.scrollWidth,bodyScroll:document.body.scrollWidth};
  const rootPx=parseFloat(getComputedStyle(root).fontSize);
  const box=view.getBoundingClientRect();
  if(root.scrollWidth>width+1||root.clientWidth>width+1||window.innerWidth>width+1||document.body.scrollWidth>width+1)issues.push('document wider than nominal viewport');
  if(Math.abs(rootPx-16*scale/100)>1)issues.push('wrong root text scale');
  if(box.left<-.5||box.right>width+.5)issues.push('preview outside nominal viewport');
  const visible=el=>el.getClientRects().length>0&&el.getBoundingClientRect().height>0;
  for(const el of view.querySelectorAll('h1,h2,p,span,li,ul,details,summary,button,div')){
   if(!visible(el))continue;
   const b=el.getBoundingClientRect();
   if(b.left<-.5||b.right>width+.5||el.scrollWidth>el.clientWidth+1)issues.push('overflow: '+el.tagName+' '+el.textContent.slice(0,48));
   if((el.tagName==='BUTTON'||el.tagName==='SUMMARY')&&b.height<43.5)issues.push('touch target below 44px');
   // Inspect rendered word fragments against the containing element rather
   // than relying solely on its (possibly expanded) outer box.
   for(const child of el.childNodes){
    if(child.nodeType!==Node.TEXT_NODE||!child.textContent.trim())continue;
    const range=document.createRange();range.selectNodeContents(child);
    for(const rect of range.getClientRects())if(rect.left<b.left-1||rect.right>b.right+1)issues.push('text outside own element: '+child.textContent.slice(0,48));
   }
  }
  return {viewport,rootPx,previewHeight:Math.ceil(box.height),issues};
 },{width,scale});
 expect(result.issues).toEqual([]);
 return result;
}
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
 test('unified document geometry '+width+' '+scale+'%',async({browser})=>scenario(browser,{width,height},'geometry-'+width+'-'+scale,async page=>{
  if(scale===200)await page.addStyleTag({content:'html{font-size:200% !important}'});
  await expect(page.getByRole('button',{name:'Tre fonti'})).toHaveCount(0);
  await prepare(page);await expect(confirm(page)).toBeVisible();
  const before=await assertReflow(page,width,scale);
  // A deliberately generous density bound: product view alone, not fixture chrome.
  expect(before.previewHeight).toBeLessThanOrEqual(scale===200?2400:850);
  const pre=await page.screenshot({path:path.join(dir,'doc01-unified-screenshots','before-confirm-'+width+'-'+scale+'.png'),fullPage:true});
  expect(pre.readUInt32BE(16)).toBe(width);
  const provenance=page.getByText('Provenienza delle informazioni',{exact:true});
  await provenance.focus();await provenance.press('Enter');
  await expect(page.getByRole('list',{name:'Provenienza delle fonti'})).toBeVisible();
  const incomplete=page.getByText('Informazioni da completare (4)',{exact:true});
  await incomplete.click();await expect(page.getByText('Obiettivi disciplinari',{exact:true})).toBeVisible();
  const expanded=await assertReflow(page,width,scale);
  await provenance.click();await incomplete.click();
  await confirm(page).click();await expect(page.getByRole('status')).toBeVisible();
  const after=await assertReflow(page,width,scale);
  return {nominalWidth:width,scale,before,expanded,after,preConfirmScreenshot:'doc01-unified-screenshots/before-confirm-'+width+'-'+scale+'.png'};
 }));
}
