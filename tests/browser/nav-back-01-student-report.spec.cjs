const { test, expect } = require('@playwright/test');
const url = (process.env.NAV_BACK_BASE_URL || 'http://127.0.0.1:4173') + '/tests/browser/fixtures/nav-back-01-app.html';

async function openSyntheticClass(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('3ª A');
}

async function openStudentFromOrigin(page, origin) {
  await page.locator('nav').getByRole('button', { name: origin }).click();
  await expect(page.getByTestId('header01-context')).toContainText(origin);
  if (origin === 'Tabellone') {
    await page.getByRole('group',{name:'Vista Tabellone'}).getByRole('button',{name:'Storico',exact:true}).click();
    await page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]').click();
    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  } else {
    const details = page.getByTestId('mobile-analytics-student-detail');
    await page.getByTestId('analytics-view-students').click();
    await details.locator('article button').first().click();
  }
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  const actualStudentId = await page.locator('main select').first().inputValue();
  expect(['fittizio-studente-01', 'fittizio-studente-02']).toContain(actualStudentId);
  return actualStudentId;
}

for (const origin of ['Tabellone', 'Analisi']) {
  test(`NAV-BACK-01 / Android 390px — ${origin} → Scheda → Back → Forward`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await openSyntheticClass(page);
    const selectedStudentId = await openStudentFromOrigin(page, origin);

    const route = await page.evaluate(() => ({
      history: window.history.state,
      address: window.location.href
    }));
    expect(route.history).toEqual({
      classId: 'classe-fittizia-a',
      tab: 'report',
      studentId: selectedStudentId,
      __tramaHistoryEntryId: expect.any(String),
      __tramaHistoryEpoch: expect.any(String),
      __tramaHistoryPosition: expect.any(Number)
    });
    expect(route.history.__tramaHistoryPosition).toBeGreaterThanOrEqual(0);
    expect(route.address).not.toContain(selectedStudentId);
    expect(route.address).toContain('tab=report');

    // page.goBack() exercises the browser popstate used by Android's swipe.
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText(origin);
    await expect(page.getByTestId('header01-context')).toContainText('3ª A');
    if (origin === 'Tabellone') await expect(page.getByTestId('matrix-compact-list')).toBeVisible();
    else await expect(page.getByTestId('analytics-mobile-views')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
    await expect(page.locator('main select').first()).toHaveValue(selectedStudentId);
    await context.close();
  });
}

test('NAV-BACK-01 / Android 320px — changing selected student preserves selection across Back/Forward', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openSyntheticClass(page);
  const initialStudentId = await openStudentFromOrigin(page, 'Tabellone');
  const nextStudentId = initialStudentId === 'fittizio-studente-01'
    ? 'fittizio-studente-02' : 'fittizio-studente-01';
  await page.locator('main select').first().selectOption(nextStudentId);
  const state = await page.evaluate(() => window.history.state);
  expect(state.studentId).toBe(nextStudentId);

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await page.goForward();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await expect(page.locator('main select').first()).toHaveValue(nextStudentId);
  await context.close();
});

test('NAV-BACK-01 — forged or deleted student in history does not open a report', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSyntheticClass(page);
  await openStudentFromOrigin(page, 'Tabellone');
  await page.evaluate(() => {
    const bad = { classId: 'classe-fittizia-a', tab: 'report', studentId: 'non-esistente' };
    history.replaceState(bad, '', '?class=classe-fittizia-a&tab=report');
    window.dispatchEvent(new PopStateEvent('popstate', { state: bad }));
  });
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await expect(page.getByTestId('header01-context')).toContainText('3ª A');
  await expect(page.getByText('Scheda Alunno & Profilo delle Competenze')).toHaveCount(0);
});

for (const width of [320, 390]) {
  test('MOBILE-DENSITY-04 — ' + width + ' essential/dossier, selection, privacy and readable evidence', async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    await page.goto(url + '?visualRoster=8');
    await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
    await openStudentFromOrigin(page, 'Tabellone');
    const root = page.getByTestId('student-report-workspace');
    const essential = page.getByTestId('student-report-essential');
    const dossier = page.getByTestId('student-report-dossier');
    const select = root.getByRole('combobox', { name: 'Seleziona alunno' });
    await expect(essential).toBeVisible();
    await expect(dossier).toBeHidden();
    await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
    await expect(essential.getByTestId('student-report-average')).toHaveText('8,5');
    await expect(essential.getByTestId('student-report-grade-count')).toHaveText('2');
    await expect(root.getByRole('button', { name: 'Essenziale', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const out = process.env.REPORT_EVIDENCE_DIR || '../browser-evidence';
    require('node:fs').mkdirSync(out, { recursive: true });
    await page.screenshot({ path: out + '/student-report-' + width + '-essential.png' });
    await root.getByRole('button', { name: 'Dossier', exact: true }).click();
    await expect(essential).toBeHidden();
    await expect(dossier).toBeVisible();
    await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
    await expect(dossier.locator('details[open]')).toHaveCount(0);
    await dossier.getByText('Elenco valutazioni', { exact: true }).click();
    await expect(dossier.locator('details[open]')).toHaveCount(1);
    await expect(dossier.locator('details[open]')).toContainText('Esercizio sintetico Q2');
    await page.screenshot({ path: out + '/student-report-' + width + '-grades.png' });
    await dossier.getByText('Comportamenti e partecipazione', { exact: true }).click();
    await expect(dossier.locator('details[open]')).toHaveCount(1);
    await expect(dossier.locator('details[open]')).toContainText('Nessuna nota comportamentale');
    // Landscape/desktop permits independent disclosures; mobile reconciles on return.
    await page.setViewportSize({ width: 900, height: 700 });
    await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
    await dossier.getByText('Elenco valutazioni', { exact: true }).click();
    await expect(dossier.locator(':scope > details[open]')).toHaveCount(2);
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    await expect(dossier.locator(':scope > details[open]')).toHaveCount(1);

    await select.selectOption('fittizio-studente-02');
    await expect(essential).toBeVisible();
    await expect(essential.getByTestId('student-report-average')).toHaveText('6,5');
    await expect(dossier).toBeHidden();
    const privacy = page.getByTestId('header01-privacy');
    if (await privacy.getAttribute('data-privacy-state') !== 'protected') await privacy.click();
    await expect(select).not.toContainText('Persona Fittizia Due');
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await expect(essential).toBeVisible();
    expect(await essential.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
    const header = page.getByTestId('header01-topbar');
    const context = page.getByTestId('header01-context');
    const mode = root.getByRole('group', { name: 'Viste scheda alunno' });
    // At 200% each control and label can reflow instead of splitting words.
    const headerWidth = await header.evaluate(el => el.clientWidth);
    expect(await context.evaluate(el => el.clientWidth)).toBeGreaterThan(headerWidth * 0.8);
    for (const name of ['header01-brand-navigation', 'header01-privacy', 'header01-lock']) {
      const control = await page.getByTestId(name).boundingBox();
      expect(control.width).toBeGreaterThanOrEqual(48);
      expect(control.height).toBeGreaterThanOrEqual(48);
    }
    for (const label of ['Essenziale', 'Dossier']) {
      const button = mode.getByRole('button', { name: label, exact: true });
      expect(await button.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set(Array.from(range.getClientRects()).map(r => Math.round(r.top))).size;
      })).toBe(1);
      expect(await button.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: out + '/student-report-' + width + '-200.png' });
    await mode.getByRole('button', { name: 'Dossier', exact: true }).click();
    await dossier.getByText('Elenco valutazioni', { exact: true }).click();
    await expect(dossier.locator('details[open]')).toHaveCount(1);
    await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
    await dossier.getByTestId('student-report-mobile-grades').scrollIntoViewIfNeeded();
    await page.screenshot({ path: out + '/student-report-' + width + '-grades-200.png' });
  });
}

for (const width of [320,390,1280]) {
  test('MOBILE-DENSITY-04/S2 — ' + width + ' protected restitution, validation and recipient reset', async ({page}) => {
    await page.setViewportSize({width:width===1280?390:width,height:844});
    await page.goto(url+'?visualRoster=8');
    await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
    await openStudentFromOrigin(page,'Tabellone');
    if(width===1280) await page.setViewportSize({width,height:900});
    const root=page.getByTestId('student-report-workspace');
    const select=root.getByRole('combobox',{name:'Seleziona alunno'});
    await select.selectOption('fittizio-studente-01');
    const privacy=page.getByTestId('header01-privacy');
    if (width < 768 && await privacy.getAttribute('data-privacy-state') !== 'protected') await privacy.click();
    await root.getByRole('button',{name:'Restituzione',exact:true}).click();
    const restitution=page.getByTestId('student-report-restitution');
    // The synthetic fixture starts with protected names.
    await expect(restitution).toBeVisible();
    const assertModeLabels = async () => {
      const mode = root.getByRole('group', {name:'Viste scheda alunno'});
      for (const label of ['Essenziale','Dossier','Restituzione']) {
        const button=mode.getByRole('button',{name:label,exact:true});
        expect(await button.evaluate(el=>{
          const range=document.createRange();
          range.selectNodeContents(el);
          return new Set(Array.from(range.getClientRects()).map(r=>Math.round(r.top))).size;
        })).toBe(1);
        expect(await button.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
        expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(48);
      }
    };
    if(width<768) await assertModeLabels();
    await expect(restitution.getByTestId('restitution-row')).toHaveCount(2);
    await expect(restitution.getByTestId('restitution-mean')).toHaveText('8,5');
    await expect(root.getByTestId('student-report-dossier')).toHaveCount(0);
    await restitution.getByLabel('Periodo',{exact:true}).selectOption('Q1');
    await expect(restitution.getByTestId('restitution-row')).toHaveCount(1);
    await restitution.getByLabel('Periodo',{exact:true}).selectOption('all');
    await restitution.getByLabel('Punti di forza',{exact:true}).fill('Evidenza sintetica del docente');
    await restitution.getByLabel('Primo obiettivo di miglioramento',{exact:true}).fill('Obiettivo sintetico');
    await restitution.getByRole('button',{name:'Controlla anteprima'}).click();
    const preview=restitution.getByTestId('restitution-preview');
    await expect(preview).toContainText('Evidenza sintetica del docente');
    await expect(preview).toContainText('Obiettivo sintetico');
    await expect(preview).not.toContainText('Persona Fittizia');
    await expect(preview.getByTestId('restitution-row')).toHaveCount(2);
    const validate=restitution.getByRole('button',{name:'Valida anteprima'});
    await expect(validate).toBeDisabled();
    await restitution.getByRole('checkbox').check();
    await validate.click();
    await expect(restitution.getByRole('status')).toContainText('Validazione locale completata');
    const out=process.env.REPORT_EVIDENCE_DIR||'../browser-evidence';
    require('node:fs').mkdirSync(out,{recursive:true});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:out+'/restitution-'+width+'-viewport.png'});
    await page.screenshot({path:out+'/restitution-'+width+'-preview.png',fullPage:true});
    await restitution.getByRole('button',{name:'Modifica',exact:true}).click();
    await expect(restitution.getByLabel('Punti di forza',{exact:true})).toHaveValue('Evidenza sintetica del docente');
    await restitution.getByRole('button',{name:'Controlla anteprima'}).click();
    await expect(restitution.getByRole('button',{name:'Valida anteprima'})).toBeDisabled();
    if(width<768){
      await privacy.click();
      await expect(restitution).toHaveCount(0);
      await expect(root.getByRole('alert')).toContainText('Attiva la protezione');
      await privacy.click();
      await expect(restitution.getByLabel('Punti di forza',{exact:true})).toHaveValue('');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      expect(await restitution.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
      await assertModeLabels();
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:out+'/restitution-'+width+'-200-viewport.png'});
      await page.screenshot({path:out+'/restitution-'+width+'-200.png',fullPage:true});
    }
    await select.selectOption('fittizio-studente-02');
    await expect(restitution).toHaveCount(0);
    await root.getByRole('button',{name:'Restituzione',exact:true}).click();
    await expect(restitution.getByLabel('Punti di forza',{exact:true})).toHaveValue('');
    await expect(restitution.getByTestId('restitution-mean')).toHaveText('6,5');
    await expect(restitution).not.toContainText('Evidenza sintetica del docente');
  });
}

test('MOBILE-DENSITY-04/S3 — actual protected PDF, all pages, native receipt and stale recipient', async({page})=>{
  test.setTimeout(120000);
  const {execFileSync}=require('node:child_process'),fs=require('node:fs');
  await page.setViewportSize({width:390,height:844});
  const external=[];
  await page.route('**/*',async route=>{
    const u=route.request().url();
    if(u.startsWith('data:')||u.startsWith('blob:')||new URL(u).origin===new URL(url).origin)return route.continue();
    external.push(u);return route.abort();
  });
  await page.addInitScript(()=>{
    window.__pdf={choose:0,write:0,cancel:false,bad:false,hold:false,filename:'',last:''};
    window.Capacitor={getPlatform:()=> 'android',Plugins:{RegistroPdfFiles:{
      choosePdfDestination:async o=>{
        window.__pdf.choose++;window.__pdf.filename=o.filename;
        if(Object.keys(o).join(',')!=='filename')throw Error('Unexpected picker arguments');
        if(window.__pdf.hold)return new Promise(resolve=>{window.__finishPicker=()=>resolve({status:'selected',token:'test'});});
        return window.__pdf.cancel?{status:'cancelled'}:{status:'selected',token:'test'};
      },
      writePdf:async o=>{
        window.__pdf.write++;window.__pdf.last=o.pdfBase64;
        const bytes=Uint8Array.from(atob(o.pdfBase64),c=>c.charCodeAt(0));
        const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        return {status:'verified',bytes:bytes.length,sha256:window.__pdf.bad?'wrong':sha256};
      }
    }}};
  });
  await page.goto(url+'?pdfRoster=1');
  await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
  await openStudentFromOrigin(page,'Tabellone');
  const root=page.getByTestId('student-report-workspace'),select=root.getByRole('combobox',{name:'Seleziona alunno'});
  const open=async(student)=>{
    await select.selectOption(student);
    await root.getByRole('button',{name:'Restituzione',exact:true}).click();
    const view=page.getByTestId('student-report-restitution');
    await view.getByLabel('Punti di forza',{exact:true}).fill(student.endsWith('01')?'Spiega con precisione le proprietà dei materiali.':'Sa riconoscere gli strumenti di disegno e usarli in modo ordinato.');
    await view.getByLabel('Apprendimenti e competenze',{exact:true}).fill('Riconosce le principali proprietà dei materiali e sa spiegare le fasi di un procedimento con esempi concreti.');
    await view.getByLabel('Partecipazione e metodo di lavoro',{exact:true}).fill('Partecipa alle attività e organizza gli strumenti di lavoro. Con una guida, controlla la completezza degli elaborati.');
    await view.getByLabel('Primo obiettivo di miglioramento',{exact:true}).fill('Prima di consegnare un disegno, controllare misure, quote e ordine delle linee.');
    await view.getByLabel('Come sostenere il percorso',{exact:true}).fill('A casa: invitare a spiegare con parole proprie le scelte fatte e a verificare il lavoro con la scheda di controllo.');
    await view.getByLabel('Domanda di autovalutazione per l’alunno',{exact:true}).fill('Quale passaggio riesco a svolgere in autonomia? Su quale ho ancora bisogno di aiuto?');
    await view.getByRole('button',{name:'Controlla anteprima'}).click();
    await expect(view.getByRole('button',{name:'Salva PDF'})).toHaveCount(0);
    await view.getByRole('checkbox').check();
    await view.getByRole('button',{name:'Valida anteprima'}).click();
    return view;
  };
  let view=await open('fittizio-studente-01');
  let save=view.getByRole('button',{name:'Salva PDF'});
  const dialog=page.waitForEvent('dialog');const click=save.click();const warning=await dialog;
  expect(warning.message()).toContain('non è cifrato');await warning.dismiss();await click;
  expect(await page.evaluate(()=>window.__pdf.choose)).toBe(0);
  page.on('dialog',d=>d.accept());
  await page.evaluate(()=>window.__pdf.cancel=true);
  await save.click();await expect(view.getByTestId('restitution-export-status')).toContainText('annullato',{timeout:30000});
  expect(await page.evaluate(()=>window.__pdf.write)).toBe(0);
  await page.evaluate(()=>{window.__pdf.cancel=false;window.__pdf.bad=true;});
  await save.click();await expect(view.getByTestId('restitution-export-status')).toContainText('non salvato o non verificato',{timeout:30000});
  await page.evaluate(()=>window.__pdf.bad=false);
  await save.click();await expect(view.getByTestId('restitution-export-status')).toContainText('salvato e verificato',{timeout:30000});
  const result=await page.evaluate(()=>window.__pdf);
  expect(result.filename).toMatch(/^Bilancio_Formativo_\d{4}-\d{2}-\d{2}\.pdf$/);
  const buffer=Buffer.from(result.last,'base64');
  const text=execFileSync('pdftotext',['-layout','-','-'],{input:buffer,encoding:'utf8'});
  const info=execFileSync('pdfinfo',['-'],{input:buffer,encoding:'utf8'});
  for(let i=1;i<=45;i++)expect(text).toContain('RIGA-'+String(i).padStart(3,'0'));
  expect(text).toContain('Spiega con precisione');
  // In layout extraction, the status may wrap alongside the period in the preceding column.
  expect(text).toMatch(/RIGA-003[^\n]*Non classificato[^\n]*\n[^\n]*\(NC\)[^\n]*\n[^\n]*Fuori media/);
  expect(text).toContain('Alunno 01');
  const firstPage=text.split('\f')[0];
  expect(firstPage).toContain('Media del periodo');expect(firstPage).toContain('Che cosa ha appreso');expect(firstPage).toContain('Su cosa lavorare adesso');
  expect(text).toContain('Non è il voto finale di scrutinio.');
  expect(text).not.toContain('Scelta dei materiali per un oggetto');expect(text).not.toContain('Persona Fittizia');expect(info).not.toContain('Persona Fittizia');
  expect(Number(info.match(/Pages:\s+(\d+)/)?.[1])).toBeGreaterThanOrEqual(3);
  expect(Number(info.match(/Pages:\s+(\d+)/)?.[1])).toBeLessThanOrEqual(5);expect(info).toMatch(/Page size:\s+595/);
  const out=process.env.REPORT_EVIDENCE_DIR||'../browser-evidence';fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(out+'/bilancio-formativo-sintetico.pdf',buffer);
  execFileSync('pdftoppm',['-png','-r','96',out+'/bilancio-formativo-sintetico.pdf',out+'/bilancio-formativo']);
  await page.evaluate(()=>window.__pdf.hold=true);
  await save.click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__finishPicker))).toBe(true);
  await select.selectOption('fittizio-studente-02');
  await page.evaluate(()=>{window.__finishPicker();window.__pdf.hold=false;});
  await expect(view).toHaveCount(0);
  // Wait for the aborted operation to settle before checking the native write count.
  await expect.poll(()=>page.evaluate(()=>window.__pdf.write)).toBe(2);
  view=await open('fittizio-studente-02');
  await view.getByRole('button',{name:'Salva PDF'}).click();
  await expect(view.getByTestId('restitution-export-status')).toContainText('salvato e verificato',{timeout:30000});
  const peer=await page.evaluate(()=>window.__pdf);
  const peerText=execFileSync('pdftotext',['-layout','-','-'],{input:Buffer.from(peer.last,'base64'),encoding:'utf8'});
  expect(peerText).toContain('Alunno 02');expect(peerText).not.toContain('1 registrazioni');expect(peerText.split('\f')[0]).toContain('6,5');expect(peerText).toContain('Sa riconoscere gli strumenti');expect(peerText).toContain('Scelta dei materiali per un oggetto');
  expect(peerText).not.toContain('Spiega con precisione');expect(peerText).not.toContain('RIGA-001');expect(peer.write).toBe(3);
  fs.writeFileSync(out+'/bilancio-formativo-esempio-breve.pdf',Buffer.from(peer.last,'base64'));
  execFileSync('pdftoppm',['-png','-r','96',out+'/bilancio-formativo-esempio-breve.pdf',out+'/bilancio-breve']);
  expect(external).toEqual([]);
});
