const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const url=base+'/tests/browser/fixtures/behavior-integrity.html';
const status=(page,label,index)=>page.getByRole('button',{name:label,exact:true}).nth(index);
const save=page=>page.getByRole('button',{name:'Salva Registro Comportamenti',exact:true});
const payload=async page=>JSON.parse(await page.getByTestId('fixture-saved').textContent());
async function open(page){await page.goto(url);await expect(page.getByRole('heading',{name:'Valutazione Rapida Comportamenti'})).toBeVisible();}
for(const width of [320,390]){
 test('compact '+width+' — 8/25 synthetic rows and geometry',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await open(page);
  const out=process.env.BEHAVIOR_EVIDENCE_DIR||'../browser-evidence';
  fs.mkdirSync(out,{recursive:true});
  for(const count of [8,25]){
   if(count===25)await page.getByTestId('fixture-count').click();
   await expect(page.getByTestId('behavior-row-toggle')).toHaveCount(count);
   await expect(page.getByTestId('behavior-row-toggle').first()).toBeVisible();
   await expect(page.getByRole('button',{name:'Ottimale 🌟',exact:true})).toHaveCount(0);
   const geom=await page.evaluate(()=>{const rows=[...document.querySelectorAll('[data-testid="behavior-row-toggle"]')];const r=rows[0].getBoundingClientRect();const n=rows[0].querySelector('[data-testid="behavior-name"]').getBoundingClientRect();const save=document.querySelector('[data-testid="behavior-save-bar"]').getBoundingClientRect();return {viewport:innerWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,rowHeight:r.height,rowWidth:r.width,nameWidth:n.width,firstRowY:r.y,rowsInView:rows.filter(x=>{const b=x.getBoundingClientRect();return b.top>=0&&b.bottom<=Math.min(innerHeight,save.top)}).length,saveBottom:save.bottom};});
   expect(geom.overflow).toBeLessThanOrEqual(1);
   expect(geom.rowHeight).toBeGreaterThanOrEqual(48);
   expect(geom.rowsInView).toBeGreaterThanOrEqual(3);
   expect(geom.saveBottom).toBeLessThanOrEqual(width===320?700:844);
   fs.writeFileSync(path.join(out,'compact-'+width+'-'+count+'.json'),JSON.stringify(geom,null,2));
   await page.screenshot({path:path.join(out,'compact-'+width+'-'+count+'.png')});
   const row=page.getByTestId('behavior-row-toggle').first();
   await row.click();
   await expect(page.getByTestId('behavior-options').filter({visible:true})).toHaveCount(1);
   await expect(page.getByRole('button',{name:'Ottimale 🌟',exact:true})).toBeVisible();
   await page.screenshot({path:path.join(out,'compact-'+width+'-'+count+'-expanded.png')});
   await row.click();
  }
 });
}
test('ordinary entry: unobserved students are not implicitly optimal',async({page})=>{
 await open(page);
 await expect(status(page,'Costruttivo 👍',0)).toHaveClass(/ring-2/);
 await expect(status(page,'Ottimale 🌟',1)).not.toHaveClass(/ring-2/);
 await expect(save(page)).toBeDisabled();
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
});
test('date switch reloads the recorded state, not the previous day',async({page})=>{
 await open(page);
 await page.locator('input[type=date]').fill('2025-01-15');
 await expect(status(page,'Distratto ⚠️',0)).toHaveClass(/ring-2/);
 await expect(status(page,'Costruttivo 👍',0)).not.toHaveClass(/ring-2/);
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
});
test('class switch never reuses an identically keyed student draft',async({page})=>{
 await open(page);
 await page.getByTestId('fixture-class').click();
 await expect(status(page,'Disattento ❌',0)).toHaveClass(/ring-2/);
 await expect(status(page,'Costruttivo 👍',0)).not.toHaveClass(/ring-2/);
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
});
test('explicit single selection writes only that student; existing records are not rewritten',async({page})=>{
 await open(page);
 await status(page,'Distratto ⚠️',1).click();
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
 await save(page).click();
 await expect(page.getByTestId('fixture-pending')).toHaveText('false');
 const rows=await payload(page);
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({studentId:'synthetic-2',status:'Distratto ⚠️'});
});
test('editing a recorded observation preserves note and record identity',async({page})=>{
 await open(page);
 await status(page,'Distratto ⚠️',0).click();
 await save(page).click();
 await expect(page.getByTestId('fixture-pending')).toHaveText('false');
 const rows=await payload(page);
 expect(rows.find(x=>x.studentId==='synthetic-1')).toMatchObject({id:'A-existing-today',note:'Nota sintetica conservata',status:'Distratto ⚠️'});
});
test('bulk action is deliberate and no write occurs before save',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'👍 Tutti Costruttivo',exact:true}).click();
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
 await save(page).click();
 await expect(page.getByTestId('fixture-pending')).toHaveText('false');
 const rows=await payload(page);
 expect(rows).toHaveLength(7);
 expect(rows.every(r=>r.studentId!=='synthetic-1'&&r.status==='Costruttivo 👍')).toBe(true);
});
test('failed save retains selected draft and blocks mutation controls while pending',async({page})=>{
 await open(page);
 await page.getByTestId('fixture-fail').click();
 await status(page,'Distratto ⚠️',1).click();
 await save(page).click();
 await expect(page.getByTestId('fixture-pending')).toHaveText('true');
 await expect(page.locator('input[type=date]')).toBeDisabled();
 await expect(status(page,'Distratto ⚠️',1)).toBeDisabled();
 await expect(page.getByTestId('fixture-pending')).toHaveText('false');
 await expect(status(page,'Distratto ⚠️',1)).toHaveClass(/ring-2/);
 await expect(save(page)).toBeEnabled();
 expect(await payload(page)).toEqual([]);
});

test('dirty date change asks before discarding, and cancel preserves draft',async({page})=>{
 await open(page);
 const date=page.locator('input[type=date]');
 const initial=await date.inputValue();
 await status(page,'Distratto ⚠️',1).click();
 page.once('dialog',d=>d.dismiss());
 await date.fill('2025-01-15');
 await expect(date).toHaveValue(initial);
 await expect(status(page,'Distratto ⚠️',1)).toHaveClass(/ring-2/);
 page.once('dialog',d=>d.accept());
 await date.fill('2025-01-15');
 await expect(status(page,'Distratto ⚠️',0)).toHaveClass(/ring-2/);
 await expect(status(page,'Distratto ⚠️',1)).not.toHaveClass(/ring-2/);
 await expect(save(page)).toBeDisabled();
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
});
test('restoring original status is a no-op and leaves no changes to save',async({page})=>{
 await open(page);
 await status(page,'Distratto ⚠️',0).click();
 await expect(save(page)).toBeEnabled();
 await status(page,'Costruttivo 👍',0).click();
 await expect(save(page)).toBeDisabled();
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
});

for(const width of [320,390]){
 test('actual App '+width+' — flat rows, one disclosure, accessible controls and 200% visual evidence',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  const out=process.env.BEHAVIOR_EVIDENCE_DIR||'../browser-evidence';
  fs.mkdirSync(out,{recursive:true});
  for(const count of [8,25]){
   await page.goto(base+'/tests/browser/fixtures/nav-back-01-app.html?visualRoster='+count);
   await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
   await page.locator('nav').getByRole('button',{name:'Comportamento',exact:true}).click();
   const rows=page.getByTestId('behavior-row-toggle');
   await expect(rows).toHaveCount(count);
   await expect(rows.first()).toContainText('Non registrato');
   await expect(save(page)).toBeDisabled();
   await expect(page.getByTestId('behavior-options').filter({visible:true})).toHaveCount(0);
   const geometry=await page.evaluate(()=>{const rows=[...document.querySelectorAll('[data-testid="behavior-row-toggle"]')];const r=rows[0].getBoundingClientRect();const name=rows[0].querySelector('[data-testid="behavior-name"]').getBoundingClientRect();const save=document.querySelector('[data-testid="behavior-save-bar"]').getBoundingClientRect();const nav=document.querySelector('nav').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,rowWidth:r.width,rowHeight:r.height,nameWidth:name.width,firstRowY:r.y,rowsInView:rows.filter(x=>{const b=x.getBoundingClientRect();return b.top>=0&&b.bottom<=Math.min(save.top,nav.top)}).length,saveBottom:save.bottom,navTop:nav.top};});
   expect(geometry.overflow).toBeLessThanOrEqual(1);
   expect(geometry.rowHeight).toBeGreaterThanOrEqual(48);
   expect(geometry.rowsInView).toBeGreaterThanOrEqual(3);
   expect(geometry.saveBottom).toBeLessThanOrEqual(geometry.navTop+1);
   fs.writeFileSync(path.join(out,'app-'+width+'-'+count+'.json'),JSON.stringify({sha:process.env.CANDIDATE_SHA,...geometry},null,2));
   await page.screenshot({path:path.join(out,'app-'+width+'-'+count+'-list.png')});
   await rows.first().click();
   await expect(page.getByTestId('behavior-options').filter({visible:true})).toHaveCount(1);
   await page.screenshot({path:path.join(out,'app-'+width+'-'+count+'-expanded.png')});
   await rows.nth(1).click();
   await expect(rows.first()).toHaveAttribute('aria-expanded','false');
   await expect(rows.nth(1)).toHaveAttribute('aria-expanded','true');
   const choice=page.getByRole('button',{name:'Costruttivo 👍',exact:true});
   expect((await choice.boundingBox()).height).toBeGreaterThanOrEqual(48);
   await choice.click();
   await expect(rows.nth(1)).toHaveAttribute('aria-expanded','false');
   await expect(rows.nth(1)).toContainText('Da salvare');
   await expect(save(page)).toBeEnabled();
   await page.getByTestId('behavior-bulk-toggle').click();
   await expect(page.getByRole('button',{name:'👍 Tutti Costruttivo',exact:true})).toBeVisible();
   await page.screenshot({path:path.join(out,'app-'+width+'-'+count+'-bulk.png')});
   await page.getByTestId('behavior-bulk-toggle').click();
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   await rows.first().click();
   const enlargedChoice=page.getByRole('button',{name:'Ottimale 🌟',exact:true});
   await expect(enlargedChoice).toBeVisible();
   await expect(page.getByTestId('behavior-save-bar')).toHaveCSS('position','static');
   await enlargedChoice.scrollIntoViewIfNeeded();
   expect(await enlargedChoice.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
   await page.screenshot({path:path.join(out,'app-'+width+'-'+count+'-200-expanded.png')});
   await enlargedChoice.click();
   await expect(rows.first()).toContainText('Da salvare');
   await save(page).scrollIntoViewIfNeeded();
   await expect(save(page)).toBeEnabled();
   await page.screenshot({path:path.join(out,'app-'+width+'-'+count+'-200-save.png')});
  }
 });
}

test('mobile privacy and disclosure state remain separate from the observation draft',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const row=page.getByTestId('behavior-row-toggle').first();
 await expect(row).not.toContainText('Persona Fittizia');
 await row.click();
 await page.getByTestId('fixture-privacy').click();
 await expect(row).toContainText('Persona Fittizia 1');
 await page.getByTestId('fixture-privacy').click();
 await expect(row).not.toContainText('Persona Fittizia');
 await expect(page.getByRole('button',{name:/Persona Fittizia/})).toHaveCount(0);
 await expect(page.getByTestId('fixture-calls')).toHaveText('0');
 await expect(save(page)).toBeDisabled();
});
