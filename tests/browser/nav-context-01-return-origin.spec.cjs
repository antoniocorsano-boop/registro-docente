const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const url = (process.env.NAV_CONTEXT_BASE_URL || 'http://127.0.0.1:4173')
  + '/tests/browser/fixtures/nav-back-01-app.html';

async function openClass(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
}

async function navigateTo(page, tab) {
  await page.locator('nav').getByRole('button', { name: tab }).click();
  await expect(page.getByTestId('header01-context')).toContainText(tab);
}

test('NAV-CONTEXT-01 / Android 390 — Tabellone restores the selected student row and mode after Back', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');

  // The same compact row is opened before and after the report detour.
  const target = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await page.getByRole('button', { name: 'Per Tipologia' }).click();
  await target.click();
  await expect(target).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Medie per tipologia' })).toBeVisible();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  const reportState = await page.evaluate(() => window.history.state);
  expect(reportState).toEqual({
    classId: 'classe-fittizia-a', tab: 'report', studentId: 'fittizio-studente-01',
    __tramaHistoryEntryId: expect.any(String),
    __tramaHistoryEpoch: expect.any(String),
    __tramaHistoryPosition: expect.any(Number)
  });
  expect(page.url()).not.toContain('fittizio-studente-01');
  expect(JSON.stringify(reportState)).not.toContain('expandedStudentId');
  expect(JSON.stringify(reportState)).not.toContain('expandedAnalyticsStudentId');
  expect(JSON.stringify(reportState)).not.toContain('studentSearch');
  expect(reportState.__tramaHistoryPosition).toBeGreaterThanOrEqual(0);

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await expect(target).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Medie per tipologia' })).toBeVisible();

  await page.goForward();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await page.goBack();
  await expect(target).toHaveAttribute('aria-expanded', 'true');

  // Ordinary menu navigation is NOT a report return. No stale disclosure.
  await navigateTo(page, 'Analisi');
  await navigateTo(page, 'Tabellone');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  await context.close();
});

test('NAV-CONTEXT-01 / Android 390 — Analisi reopens student details and retains the calculation mode', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Analisi');

  const section = page.getByTestId('mobile-analytics-student-detail');
  await page.getByTestId('analytics-view-students').click();
  await expect(section).toBeVisible();
  const firstRow = section.getByTestId('analytics-compact-row').first();
  const firstBox = await firstRow.boundingBox();
  expect(firstBox.y + firstBox.height).toBeLessThanOrEqual(844);
  expect(firstBox.width).toBeGreaterThanOrEqual(340);
  const toggle = section.getByTestId('analytics-compact-toggle').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await section.locator('article button').first().click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Analisi');
  await expect(section).toBeVisible();
  await expect(section.locator('article button').first()).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(section.locator('[data-testid="analytics-compact-detail"]:visible')).toHaveCount(1);

  // Going back a second time must restore the real prior dashboard.
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await context.close();
});

test('NAV-CONTEXT-01 — an explicit Analisi → Tabellone → Analisi route resets mobile student detail', async ({ browser }) => {
  for (const width of [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true
    });
    try {
      const page = await context.newPage();
      await openClass(page);
      await navigateTo(page, 'Analisi');
      let section = page.getByTestId('mobile-analytics-student-detail');

      // Ordinary navigation must discard manually expanded UI state.
      await page.getByTestId('analytics-view-students').click();
      await expect(section).toBeVisible();
      await navigateTo(page, 'Tabellone');
      await navigateTo(page, 'Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).toBeHidden();
      await expect(section.getByPlaceholder('Cerca alunno')).toBeHidden();

      // Legitimate report Back still restores an open detail, but only once.
      await page.getByTestId('analytics-view-students').click();
      await section.locator('article button').first().click();
      await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
      await page.goBack();
      await expect(page.getByTestId('header01-context')).toContainText('Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).toBeVisible();

      await navigateTo(page, 'Tabellone');
      await navigateTo(page, 'Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).toBeHidden();
      await expect(section.getByPlaceholder('Cerca alunno')).toBeHidden();
    } finally {
      await context.close();
    }
  }
});

test('NAV-CONTEXT-01 / Android 320 — report detour does not reveal a private student name or overflow the viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');
  const row = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await row.click();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await page.goBack();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Persona Fittizia Uno', { exact: true })).toHaveCount(0);
  const geometry = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
  await context.close();
});

test('NAV-CONTEXT-01 — a privacy toggle while in report scrubs the saved visible-name search', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Analisi');
  const privacy = page.getByTestId('header01-privacy');
  await privacy.click(); // privacy off, purely synthetic data
  await expect(privacy).toHaveAttribute('data-privacy-state', 'visible');

  const section = page.getByTestId('mobile-analytics-student-detail');
  await page.getByTestId('analytics-view-students').click();
  const search = section.getByPlaceholder('Cerca alunno');
  await search.fill('Persona Fittizia');
  await section.locator('article button').first().click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  await privacy.click(); // turn protection ON while Analytics is unmounted
  await expect(privacy).toHaveAttribute('data-privacy-state', 'protected');
  await privacy.click(); // return to visible mode: old search must remain scrubbed
  await expect(privacy).toHaveAttribute('data-privacy-state', 'visible');

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Analisi');
  await expect(section).toBeVisible();
  await expect(search).toHaveValue('');
  await page.goForward();
  await page.goBack();
  await expect(search).toHaveValue('');
  await context.close();
});

test('NAV-CONTEXT-01 — a backup action leaves the report and discards the previous disclosure', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');
  const row = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await row.click();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('button', { name: 'Esporta backup cifrato' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Privacy');
  // The backup navigation is explicit, even though legacy code does not push
  // a new history entry. Back must NOT revive the old expanded row.
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  await context.close();
});


// Actual App, not an isolated component: evidence for the mobile HPR.
for (const width of [320, 390]) {
  for (const count of [8, 25]) {
    test(`MOBILE-DENSITY-02 visual App / ${width}px / ${count} synthetic students`, async ({ browser }) => {
      const height = width === 320 ? 700 : 844;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const evidence = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence', 'analytics-visual');
      await fs.mkdir(evidence, { recursive: true });
      const prefix = path.join(evidence, `app-${width}-${count}`);
      const page = await context.newPage();
      const capture = async (name) => {
        await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
        await page.screenshot({ path: `${prefix}-${name}.png`, animations: 'disabled' });
      };
      try {
        await page.goto(url + '?visualRoster=' + count, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
        await navigateTo(page, 'Analisi');
        const privacy = page.getByTestId('header01-privacy');
        if (await privacy.getAttribute('data-privacy-state') === 'protected') await privacy.click();
        await expect(privacy).toHaveAttribute('data-privacy-state', 'visible');
        await expect(page.getByTestId('analytics-mobile-summary')).toBeVisible();
        const copilot = page.getByTestId('library-copilot-trigger');
        await expect(copilot).toBeVisible();
        expect(await copilot.evaluate(el => getComputedStyle(el).position)).not.toBe('fixed');
        await capture('sintesi');
        const exportMenu = page.getByRole('button', { name: 'Esportazione e stampa' });
        await exportMenu.click();
        await expect(page.getByRole('button', { name: 'Esporta PDF di lavoro', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Stampa prospetto', exact: true })).toBeVisible();
        await exportMenu.click();
        await expect(page.getByRole('button', { name: 'Stampa prospetto', exact: true })).toHaveCount(0);
        await page.getByTestId('analytics-view-students').click();
        const section = page.getByTestId('mobile-analytics-student-detail');
        const rows = section.getByTestId('analytics-compact-row');
        await expect(rows).toHaveCount(count);
        await capture('alunni');
        const geometry = await section.evaluate((el) => {
          const all = Array.from(el.querySelectorAll('[data-testid="analytics-compact-row"]'));
          const first = all[0].getBoundingClientRect();
          const name = all[0].querySelector('[data-testid="analytics-compact-name"]').getBoundingClientRect();
          return { viewport: { width: innerWidth, height: innerHeight }, firstRow: { y: first.y, width: first.width, height: first.height }, nameWidth: name.width,
            visibleRows: all.filter(row => { const r = row.getBoundingClientRect(); const nav = document.querySelector('nav.md\\:hidden'); return r.top >= 0 && r.bottom <= (nav?.getBoundingClientRect().top ?? innerHeight); }).length,
            horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        await fs.writeFile(prefix + '-geometry.json', JSON.stringify(geometry, null, 2));
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        const toggle = rows.first().getByTestId('analytics-compact-toggle');
        await toggle.click();
        await expect(rows.first().getByTestId('analytics-compact-detail')).toBeVisible();
        await capture('dettaglio');
        await page.getByTestId('analytics-view-details').click();
        await expect(page.getByTestId('analytics-advanced-surface')).toBeVisible();
        await capture('approfondimenti');
        await page.getByTestId('analytics-view-students').click();
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const views = page.getByTestId('analytics-mobile-views');
        await expect(views).toBeVisible();
        const summaryBox = await page.getByTestId('analytics-view-summary').boundingBox();
        const studentsBox = await page.getByTestId('analytics-view-students').boundingBox();
        const detailsBox = await page.getByTestId('analytics-view-details').boundingBox();
        expect(studentsBox.y).toBeGreaterThanOrEqual(summaryBox.y + summaryBox.height - 1);
        expect(detailsBox.y).toBeGreaterThanOrEqual(studentsBox.y + studentsBox.height - 1);
        await expect(rows.first()).toBeVisible();
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        await capture('testo-200');
        await expect(rows.first().getByTestId('analytics-compact-detail')).toBeVisible();
        await rows.first().getByTestId('analytics-compact-detail').scrollIntoViewIfNeeded();
        await page.screenshot({ path: prefix + '-dettaglio-200.png', animations: 'disabled' });
        await fs.writeFile(prefix + '-commit.txt', (process.env.CANDIDATE_SHA || 'local') + '\n');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const footer = page.locator('nav').filter({ has: page.getByRole('button', { name: 'Analisi', exact: true }) });
        const lastBox = await rows.last().boundingBox();
        const footerBox = await footer.boundingBox();
        expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(footerBox.y + 1);
        await privacy.click();
        await expect(privacy).toHaveAttribute('data-privacy-state', 'protected');
        await expect(section.getByText('Persona Fittizia Uno', { exact: true })).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
}


test('VAL-01/S4a — compact matrix entry, explicit save, protected roster and blank rows',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(url+'?matrixWrite=1');await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
  await navigateTo(page,'Tabellone');await page.getByRole('button',{name:'Inserisci valutazione'}).click();
  const editor=page.getByTestId('matrix-evaluation-editor');await expect(editor).toBeVisible();
  await expect(editor.getByTestId('matrix-evaluation-row')).toHaveCount(2);
  await expect(editor).not.toContainText('Persona Fittizia Uno');
  await editor.getByRole('textbox',{name:'Titolo / Argomento prova'}).fill('Prova sintetica nuova');
  await editor.getByRole('textbox',{name:'Voto alunno 1',exact:true}).fill('8');
  await editor.getByRole('textbox',{name:'Voto alunno 2',exact:true}).fill('xyz');
  await editor.getByRole('button',{name:'Salva valutazioni'}).click();await expect(editor.getByRole('alert')).toContainText('Controlla i voti');
  expect(await page.evaluate(()=>window.__matrixWrites||0)).toBe(0);
  await editor.getByRole('textbox',{name:'Voto alunno 2',exact:true}).fill('');
  await editor.getByRole('button',{name:'Annulla',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('valutazioni non salvate');
  await page.getByRole('button',{name:'Rimani nelle valutazioni'}).click();await expect(editor.getByRole('textbox',{name:'Voto alunno 1',exact:true})).toHaveValue('8');
  await editor.getByRole('button',{name:'Salva valutazioni'}).click();await expect(page.getByTestId('matrix-compact-list')).toBeVisible();
  const saved=await page.evaluate(()=>window.__matrixSaved);expect(saved.classes[0].grades).toHaveLength(3);expect(saved.classes[0].grades.filter(g=>g.title==='Prova sintetica nuova')).toHaveLength(1);expect(await page.evaluate(()=>window.__matrixWrites)).toBe(1);
  await page.getByRole('button',{name:'Inserisci valutazione'}).click();await expect(editor.getByRole('textbox',{name:'Voto alunno 1',exact:true})).toHaveValue('');
  await context.close();
});


test('VAL-01/S4a — guarded browser Back preserves draft and committed pending save cannot be resubmitted',async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:700},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto(url+'?matrixWrite=1');await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
  await navigateTo(page,'Tabellone');await page.getByRole('button',{name:'Inserisci valutazione'}).click();
  const editor=page.getByTestId('matrix-evaluation-editor');await editor.getByRole('textbox',{name:'Titolo / Argomento prova'}).fill('Prova sintetica Back');await editor.getByRole('textbox',{name:'Voto alunno 1',exact:true}).fill('8');
  await page.goBack();await expect(page.getByRole('dialog')).toContainText('valutazioni non salvate');
  await page.getByRole('button',{name:'Rimani nelle valutazioni'}).click();await expect(editor.getByRole('textbox',{name:'Voto alunno 1',exact:true})).toHaveValue('8');
  await page.evaluate(()=>window.__matrixHold=true);await editor.getByRole('button',{name:'Salva valutazioni'}).click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__finishMatrixWrite))).toBe(true);
  await page.locator('nav').getByRole('button',{name:'Tabellone'}).click();await expect(page.getByRole('dialog')).toContainText('Salvataggio delle valutazioni in corso');await expect(page.getByRole('button',{name:'Continua senza salvare'})).toBeDisabled();
  await page.evaluate(()=>window.__finishMatrixWrite());await expect(page.getByTestId('matrix-evaluation-committed')).toBeAttached();
  await page.getByRole('button',{name:'Rimani nelle valutazioni'}).click();await expect(page.getByTestId('matrix-evaluation-committed')).toBeVisible();await expect(page.getByRole('button',{name:'Salva valutazioni'})).toHaveCount(0);
  await page.getByRole('button',{name:'Torna al Tabellone'}).click();await expect(page.getByTestId('matrix-compact-list')).toBeVisible();expect(await page.evaluate(()=>window.__matrixWrites)).toBe(1);await context.close();
});


test('VAL-01/S4a — selecting active Valutazioni navigation preserves the compact draft',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto(url+'?matrixWrite=1');await page.getByRole('button',{name:/Apri classe 3ª A.*Prova sintetica/i}).click();
  await navigateTo(page,'Tabellone');await page.getByRole('button',{name:'Inserisci valutazione'}).click();
  const editor=page.getByTestId('matrix-evaluation-editor');await editor.getByRole('textbox',{name:'Titolo / Argomento prova'}).fill('Prova stessa scheda');await editor.getByRole('textbox',{name:'Voto alunno 1',exact:true}).fill('7');
  const before=await page.evaluate(()=>({url:location.href,length:history.length}));
  await page.locator('nav').getByRole('button',{name:'Valutazioni',exact:true}).click();
  await expect(editor.getByRole('textbox',{name:'Voto alunno 1',exact:true})).toHaveValue('7');await expect(editor.getByRole('textbox',{name:'Titolo / Argomento prova'})).toHaveValue('Prova stessa scheda');
  expect(await page.evaluate(()=>({url:location.href,length:history.length}))).toEqual(before);
  expect(await page.evaluate(()=>window.__matrixWrites||0)).toBe(0);await context.close();
});
