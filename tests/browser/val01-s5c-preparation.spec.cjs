const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const url=(process.env.NAV_CONTEXT_BASE_URL||'http://127.0.0.1:4173')+'/tests/browser/fixtures/val01-s5c.html';
async function open(page,activity='Attività ordinaria'){
  await page.goto(url);await page.getByRole('button',{name:activity,exact:true}).click();
  await page.getByRole('button',{name:'Apri configurazione'}).click();
  await expect(page.getByRole('heading',{name:'Obiettivi e criteri'})).toBeVisible();
}
async function metadata(page,title='Filiera sintetica',purpose='formative'){
  await page.getByLabel('Titolo',{exact:true}).fill(title);await page.getByLabel('Data',{exact:true}).fill('2026-11-19');
  await page.getByLabel('Periodo',{exact:true}).selectOption('Q1');await page.getByLabel('Finalità',{exact:true}).selectOption(purpose);
}
async function choose(page,criterion='Coerenza dei collegamenti',rubric=''){
  const box=page.getByRole('checkbox',{name:criterion,exact:true});await box.check();
  const card=box.locator('xpath=../..');
  if(rubric)await card.getByLabel('Rubrica (facoltativa)').selectOption(rubric);
  await card.getByLabel('Tipo di evidenza').selectOption('product');await card.getByLabel('Evidenza attesa').fill('Schema delle relazioni');
  await card.getByLabel('Metodo',{exact:true}).fill('Elaborato');return card;
}
async function review(page){await page.getByRole('button',{name:'Rivedi configurazione'}).click();await expect(page.getByRole('heading',{name:'Riepilogo prima della conferma'})).toBeVisible();}
test('ordinary diagnostic activity: explicit selection, no rubric, review and local-only confirmation',async({page})=>{
  await open(page);await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked();await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();
  await metadata(page,'Prova diagnostica','diagnostic');await choose(page);await review(page);
  await expect(page.getByRole('heading',{name:'Riepilogo prima della conferma'})).toBeFocused();
  await expect(page.getByText('Nessuna rubrica',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Conferma configurazione'}).click();
  await expect(page.getByRole('heading',{name:'Configurazione confermata nella dimostrazione'})).toBeVisible();
  await expect(page.getByText('Nessun dato salvato.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Conferma configurazione'})).toHaveCount(0);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.getByRole('button',{name:'Apri configurazione'}).click();
  await expect(page.getByRole('alert')).toContainText('già configurata');
});
test('exam rehearsal: two explicitly selected criteria and compatible rubrics; no official result',async({page})=>{
  await open(page,'Simulazione d’esame');await metadata(page,'Simulazione d’esame','summative');
  const card=await choose(page,'Coerenza dei collegamenti','r1r1');
  await expect(card.getByLabel('Rubrica (facoltativa)').locator('option')).toHaveCount(2);
  const second=await choose(page,'Chiarezza argomentativa','r2r1');
  await expect(second.getByLabel('Rubrica (facoltativa)').locator('option')).toHaveCount(2);
  await review(page);await expect(page.getByText('Coerente: Collegamenti motivati',{exact:true})).toBeVisible();
  await expect(page.getByText('Argomentato: Motiva la scelta',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Conferma configurazione'}).click();
  await expect(page.getByText('Attività pianificata · 2 criteri',{exact:true})).toBeVisible();
});
test('incomplete request, recovery, modification invalidates review',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Rivedi configurazione'}).click();
  await expect(page.getByRole('alert')).toContainText('Completa tutti i campi');await expect(page.getByRole('alert')).toBeFocused();
  await metadata(page);await choose(page);await review(page);await page.getByLabel('Titolo',{exact:true}).fill('Titolo corretto');
  await expect(page.getByRole('button',{name:'Conferma configurazione'})).toHaveCount(0);await review(page);
  await expect(page.getByRole('region',{name:'Riepilogo prima della conferma'})).toContainText('Titolo corretto');
});
test('existing activity cannot be duplicated',async({page})=>{
  await open(page,'Attività esistente');await expect(page.getByRole('alert')).toContainText('già configurata');
  await expect(page.getByRole('button',{name:'Rivedi configurazione'})).toHaveCount(0);
});
test('changed reference rejects confirmation and allows explicit selection repair',async({page})=>{
  await open(page);await metadata(page);await choose(page);await review(page);
  await page.getByRole('button',{name:'Aggiorna riferimento sintetico'}).click();
  await page.getByRole('button',{name:'Conferma configurazione'}).click();
  await expect(page.getByText('Un riferimento non è più disponibile. Rivedi i criteri.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Rimuovi i criteri non disponibili'}).click();
  await choose(page,'Chiarezza argomentativa');await review(page);
  await expect(page.getByRole('region',{name:'Riepilogo prima della conferma'})).toContainText('Chiarezza argomentativa');
});
test('changed activity blocks confirmation; exit explicitly discards draft',async({page})=>{
  await open(page);await metadata(page);await choose(page);await review(page);
  await page.getByRole('button',{name:'Simulazione d’esame',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Il contesto è cambiato');await expect(page.getByRole('button',{name:'Conferma configurazione'})).toHaveCount(0);
  await page.getByRole('button',{name:'Abbandona bozza'}).click();await page.getByRole('button',{name:'Abbandona bozza'}).click();
  await expect(page.getByRole('heading',{name:'Obiettivi e criteri'})).toHaveCount(0);
});
test('back asks before abandoning; continue preserves draft',async({page})=>{
  await open(page);await metadata(page);await page.getByRole('button',{name:'Indietro',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Abbandonare');await page.getByRole('button',{name:'Continua configurazione'}).click();
  await expect(page.getByLabel('Titolo',{exact:true})).toHaveValue('Filiera sintetica');
});
for(const [width,height,scale] of [[320,700,100],[390,844,100],[320,700,200]]){
  test('mobile geometry '+width+' / '+scale+'%',async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
    try{
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await open(page);
      if(scale===200)await page.addStyleTag({content:'html { font-size: 200% !important; }'});
      await metadata(page);await choose(page);await review(page);
      await expect(page.getByRole('button',{name:'Conferma configurazione'})).toBeVisible();
      const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);expect(errors).toEqual([]);
      const root=process.env.HEADER01_EVIDENCE_DIR||'../browser-evidence';await fs.mkdir(path.join(root,'screenshots'),{recursive:true});
      await page.screenshot({path:path.join(root,'screenshots','val01-s5c-'+width+'-'+scale+'.png'),fullPage:true});
      await page.getByRole('button',{name:'Conferma configurazione'}).click();await expect(page.getByRole('status')).toContainText('Configurazione confermata');
    }finally{await context.close();}
  });
}
