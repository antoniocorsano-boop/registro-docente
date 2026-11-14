const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({ viewport: { width: 360, height: 780 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function navigate(page, name) {
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button', { name, exact: true }).click();
}

test('CDC-02/S1: on smartphone two sessions can be saved and reopened after returning to Consigli', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill('cdc-02-synthetic');
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  const className = '2Z CDC-02 sintetica';
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: className });
  const overview = page.getByRole('region', { name: 'Quadro sintetico delle evidenze della classe' });
  await expect(overview).toBeVisible();
  await expect(overview).toContainText('Dati correnti');
  await expect(overview).toContainText('Con prove numeriche');
  await expect(overview).toContainText('Senza prove numeriche');
  await expect(overview).toContainText('Senza voto di ingresso salvato');
  await expect(overview.getByText('0', { exact: true })).toHaveCount(6);
  await expect(page.getByText('Nessuna seduta registrata per questa classe e questo anno.')).toBeVisible();
  // No currently supported council-specific capability; no generic entry.
  await expect(page.getByRole('button', { name: 'Apri Copilota dai Consigli di classe' })).toHaveCount(0);
  await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);

  const year = await page.getByRole('combobox', { name: 'Seleziona anno scolastico del Consiglio' }).inputValue();
  const start = Number(year.slice(0, 4));
  const date = page.getByRole('textbox', { name: 'Data di nuova seduta' }).or(page.getByLabel('Data di nuova seduta'));
  await page.getByRole('combobox', { name: 'Tipo di nuova seduta' }).selectOption('monitoraggio');
  await date.fill(`${start}-11-09`);
  await expect(page.getByText(`Data selezionata: 9 novembre ${start}`)).toBeVisible();
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  await expect(page.getByRole('region', { name: 'Dettaglio della seduta' })).toContainText('Seduta salvata');
  await expect(page.getByRole('status').filter({ hasText: 'Seduta salvata.' })).toBeVisible();

  await date.fill(`${start}-11-16`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  const entries = page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText(`16 nov ${start}`);
  await expect(entries.last()).toContainText(`9 nov ${start}`);
  await entries.last().click();
  await expect(page.getByRole('region', { name: 'Dettaglio della seduta' })).toContainText('Seduta selezionata');

  await navigate(page, 'Oggi');
  const confirmation = page.getByRole('alertdialog').filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Torna a Oggi' }).click();
  }
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: className });
  const restoredEntries = page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button');
  await expect(restoredEntries).toHaveCount(2);
  await restoredEntries.last().click();
  const reopened = page.getByRole('region', { name: 'Dettaglio della seduta' });
  await expect(reopened).toContainText('Seduta riaperta');
  await expect(reopened).toContainText(`9 novembre ${start}`);
  await expect(overview).toBeVisible();
  await expect(overview).toContainText('Dati correnti');

  // Historical records are not grades and do not require a student or per-session votes.
  await expect(page.getByRole('region', { name: 'Tabellone delle valutazioni di ingresso' })).toBeVisible();
  const xOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(xOverflow).toBe(false);
});

test('CDC-02/S2b-P3: anteprima, annullamento, versioni e ritorno su mobile sintetico', async ({ page }) => {
  // P4: keep HPR frames in browser-evidence/, the directory actually uploaded
  // by the canonical qualification workflow. The previous test.info.attach()
  // alone did not yield an image in the published ZIP.
  await page.setViewportSize({ width: 390, height: 844 });
  const reviewDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
  const reviewFrames = [];
  async function captureP4Frame(file, meaning) {
    await fs.promises.mkdir(reviewDir, { recursive: true });
    const imageFile = path.join(reviewDir, file);
    await page.screenshot({ path: imageFile, fullPage: true, animations: 'disabled' });
    const size = (await fs.promises.stat(imageFile)).size;
    expect(size).toBeGreaterThan(5_000);
    reviewFrames.push({ file, meaning, sizeBytes: size, viewport: '390x844',
      syntheticDataOnly: true });
  }
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill('cdc-02-p3-synthetic');
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  const className = '2P Fotografie sintetiche';
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill('Alfa Sintetico');
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();

  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: className });
  const year = await page.getByRole('combobox', { name: 'Seleziona anno scolastico del Consiglio' }).inputValue();
  const start = Number(year.slice(0, 4));
  const date = page.getByLabel('Data di nuova seduta');
  await date.fill(`${start}-10-10`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  const detail = page.getByRole('region', { name: 'Dettaglio della seduta' });
  await expect(detail).toContainText('Seduta salvata');

  const panel = page.getByRole('region', { name: 'Fotografie storiche della seduta' });
  await expect(panel.getByText('Nessuna fotografia confermata per questa seduta.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Prepara fotografia' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Prepara fotografia' }).click();
  await expect(panel.getByText('Anteprima non salvata · revisione 1')).toBeVisible();
  await expect(panel.getByText('Nessuna fotografia confermata per questa seduta.')).toBeVisible();
  await captureP4Frame('cdc02-p4-01-anteprima-non-salvata-390.png', 'Anteprima esplicitamente preparata; zero fotografie salvate');
  await panel.getByRole('button', { name: 'Annulla anteprima' }).click();
  await expect(panel.getByText('Anteprima non salvata · revisione 1')).toHaveCount(0);
  await expect(panel.getByText('Nessuna fotografia confermata per questa seduta.')).toBeVisible();

  await panel.getByRole('button', { name: 'Prepara fotografia' }).click();
  await expect(panel.getByText('Anteprima non salvata · revisione 1')).toBeVisible();
  await panel.getByRole('button', { name: 'Conferma e salva fotografia' }).click();
  await expect(panel.getByText('Fotografia confermata · revisione 1')).toBeVisible();
  const history = panel.getByRole('combobox', { name: 'Seleziona versione fotografica' });
  await expect(history.locator('option')).toHaveCount(1);
  const archived = panel.locator('[aria-label="Fotografia archiviata"]');
  const frozenVotes = archived.locator('[aria-label="Alunni con voto di ingresso salvato nella fotografia"]');
  const currentVotes = archived.locator('[aria-label="Alunni con voto di ingresso salvato nel quadro corrente"]');
  await expect(archived.getByRole('heading', { name: 'Alunni con voto di ingresso salvato' })).toHaveCount(1);
  await expect(frozenVotes).toContainText('Fotografia');
  await expect(currentVotes).toContainText('Quadro corrente');
  await expect(frozenVotes).toContainText(`Prove fino al 10 ottobre ${start}`);
  await expect(currentVotes).toContainText('Prove fino al');
  await expect(archived).toContainText('La fotografia non cambia; il quadro corrente può cambiare.');
  await expect(archived).toContainText('I limiti delle prove non attestano quando i voti furono registrati.');
  await expect(frozenVotes.getByText('0', { exact: true })).toBeVisible();
  await expect(currentVotes.getByText('0', { exact: true })).toBeVisible();
  await expect(archived.getByText('Acquisita il', { exact: false })).toBeVisible();
  await expect(archived.getByText('Istante originale UTC:', { exact: false })).toBeHidden();
  await captureP4Frame('cdc02-p4-02-prima-fotografia-confermata-390.png', 'Prima fotografia immutabile; una versione confermata');

  // The live assessment changes; the first confirmed snapshot must remain fixed.
  const vote = page.locator('input[aria-label^="Voto di ingresso per"]');
  await vote.fill('7');
  await expect(panel.getByRole('button', { name: 'Acquisisci nuova versione' })).toBeDisabled();
  await page.getByRole('button', { name: 'Salva valutazioni di ingresso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Valutazioni di ingresso salvate nell’archivio' })).toBeVisible();
  const liveOverview = page.getByRole('region', { name: 'Quadro sintetico delle evidenze della classe' });
  await expect(liveOverview.locator('details')).not.toHaveAttribute('open', '');
  await expect(currentVotes.getByText('1', { exact: true })).toBeVisible();
  await expect(frozenVotes.getByText('0', { exact: true })).toBeVisible();
  await captureP4Frame('cdc02-p4-03-corrente-diverso-da-congelato-390.png', 'Quadro corrente: un voto salvato; prima fotografia ancora zero');
  await panel.getByRole('button', { name: 'Acquisisci nuova versione' }).click();
  await expect(panel.getByText('Anteprima non salvata · revisione 2')).toBeVisible();
  await panel.getByRole('button', { name: 'Conferma e salva fotografia' }).click();
  await expect(history.locator('option')).toHaveCount(2);
  await expect(panel.getByText('Fotografia confermata · revisione 2')).toBeVisible();
  await expect(frozenVotes.getByText('1', { exact: true })).toBeVisible();
  await captureP4Frame('cdc02-p4-04-seconda-revisione-confermata-390.png', 'Seconda revisione esplicita; due versioni presenti');

  const firstRevisionId = await history.locator('option').first().getAttribute('value');
  await history.selectOption(firstRevisionId);
  await expect(panel.getByText('Fotografia confermata · revisione 1')).toBeVisible();
  await expect(frozenVotes.getByText('0', { exact: true })).toBeVisible();
  await captureP4Frame('cdc02-p4-05-prima-revisione-ancora-consultabile-390.png', 'Selezione e consultazione della prima revisione dopo la seconda');

  await navigate(page, 'Oggi');
  const confirmation = page.getByRole('alertdialog').filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Torna a Oggi' }).click();
  }
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: className });
  await page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button').first().click();
  const reopened = page.getByRole('region', { name: 'Fotografie storiche della seduta' });
  await expect(reopened.getByRole('combobox', { name: 'Seleziona versione fotografica' }).locator('option')).toHaveCount(2);
  await expect(reopened.getByText('Fotografia confermata · revisione 2')).toBeVisible();
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  }
  await fs.promises.writeFile(path.join(reviewDir, 'cdc02-p4-evidence-manifest.json'),
    JSON.stringify({ candidateSha: process.env.CANDIDATE_SHA ?? 'unspecified',
      evidenceContract: 'CDC-02/S2b-P4', reviewStatus: 'HPR_PENDING',
      frames: reviewFrames }, null, 2) + '\n');
  await test.info().attach('cdc02-p3-mobile-history', { body: await page.screenshot(), contentType: 'image/png' });
});
