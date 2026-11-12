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
 test('compact '+width+' — 8/25 synthetic rows, 44px targets and no nested scroll',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await open(page);
  const out=process.env.BEHAVIOR_EVIDENCE_DIR||'../browser-evidence';
  fs.mkdirSync(out,{recursive:true});
  for(const count of [8,25]){
   if(count===25)await page.getByTestId('fixture-count').click();
   await expect(page.getByRole('button',{name:'Ottimale 🌟',exact:true})).toHaveCount(count);
   const geom=await page.evaluate(()=>{
    const list=document.querySelector('[data-testid="behavior-student-list"]');
    const rows=[...document.querySelectorAll('[data-testid="behavior-student-row"]')];
    return {viewport:innerWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     nestedScroll:list.scrollHeight>list.clientHeight+1,
     buttons:rows.flatMap(row=>[...row.querySelectorAll('button')]).length,
     minTouch:Math.min(...rows.flatMap(row=>[...row.querySelectorAll('button')].map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height)))),
     aligned:rows.every(row=>{
      const name=row.querySelector('[data-testid="behavior-student-name"]').getBoundingClientRect();
      const buttons=[...row.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
      return name.width>=70 && name.right<=buttons[0].left+1 && buttons.every(b=>Math.abs(b.top-buttons[0].top)<1);
     })};
   });
   expect(geom.overflow).toBeLessThanOrEqual(1);
   expect(geom.nestedScroll).toBe(false);
   expect(geom.buttons).toBe(count*4);
   expect(geom.minTouch).toBeGreaterThanOrEqual(44);
   expect(geom.aligned).toBe(true);
   await expect(save(page)).toBeInViewport();
   const footer=page.getByTestId('behavior-save-actions');
   const footerBox=await footer.boundingBox();
   expect(footerBox.y+footerBox.height).toBeLessThanOrEqual((width===320?700:844)-79);
   await page.getByTestId('behavior-student-row').last().scrollIntoViewIfNeeded();
   await expect(save(page)).toBeInViewport();
   await expect(page.getByTestId('behavior-student-row').last().getByRole('button',{name:'Ottimale 🌟',exact:true})).toBeInViewport();
   await page.evaluate(()=>window.scrollTo(0,0));
   fs.writeFileSync(path.join(out,'compact-'+width+'-'+count+'.json'),JSON.stringify(geom,null,2));
   await page.screenshot({path:path.join(out,'compact-'+width+'-'+count+'.png')});
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
