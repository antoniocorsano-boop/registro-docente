const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { navigationButton } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({ viewport: { width: 360, height: 780 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function navigate(page, name) {
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button', { name, exact: true }).click();
}

test('CDC-02/S1: on smartphone two sessions can be saved and reopened after returning to Consigli', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#vault-password').fill('cdc-02-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  const className = '2Z CDC-02 sintetica';
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  // Synthetic student; used only to demonstrate the persistent name column.
  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill('Alessandrini Maria Caterina (sintetica)');
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();

  const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence', 'cdc02-s1-human-review');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const screenshots = [];
  async function capture(filename, surface, options = {}) {
    const file = path.join(evidenceDir, filename);
    await surface.screenshot({ path: file, animations: 'disabled', ...options });
    const bytes = fs.readFileSync(file);
    screenshots.push({ name: filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  }

  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: className });
  const year = await page.getByRole('combobox', { name: 'Seleziona anno scolastico del Consiglio' }).inputValue();
  const archive = page.getByRole('region', { name: 'Archivio sedute del Consiglio' });
  await expect(archive).toContainText('Nessuna seduta registrata per questa classe e questo anno.');
  await capture('01-anno-classe-archivio-vuoto.png', page, { fullPage: true });
  const start = Number(year.slice(0, 4));
  const date = page.getByRole('textbox', { name: 'Data di nuova seduta' }).or(page.getByLabel('Data di nuova seduta'));
  await page.getByRole('combobox', { name: 'Tipo di nuova seduta' }).selectOption('monitoraggio');
  await date.fill(`${start}-11-09`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Seduta salvata.' })).toBeVisible();

  await date.fill(`${start}-11-16`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  const entries = page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText(`${start}-11-16`);
  await expect(entries.last()).toContainText(`${start}-11-09`);
  await capture('02-due-sedute-distinte.png', archive);

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
  await expect(page.getByRole('region', { name: 'Seduta recuperata' })).toContainText(`${start}-11-09`);
  await capture('03-seduta-recuperata-dopo-oggi.png', archive);

  // Historical records are not grades and do not require a student or per-session votes.
  const table = page.getByRole('region', { name: 'Tabellone delle valutazioni di ingresso' });
  await expect(table).toBeVisible();
  const studentName = table.locator('tbody th[scope="row"]').first();
  // Privacy Shield is ON by default. Explicitly reveal only the synthetic name
  // for this visual check, via the same user control that the teacher uses.
  const privacyToggle = page.getByTestId('header01-privacy');
  await expect(privacyToggle).toBeVisible();
  if (await privacyToggle.getAttribute('data-privacy-state') === 'protected') {
    await privacyToggle.click();
  }
  await expect(privacyToggle).toHaveAttribute('data-privacy-state', 'visible');
  await expect(studentName).toContainText('Alessandrini');
  const leftBefore = await studentName.evaluate(el => el.getBoundingClientRect().left);
  await table.evaluate(el => { el.scrollLeft = el.scrollWidth - el.clientWidth; });
  expect(await table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(Math.abs(await studentName.evaluate(el => el.getBoundingClientRect().left) - leftBefore)).toBeLessThan(2);
  const xOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(xOverflow).toBe(false);
  await capture('04-nominativo-fisso-tabellone-scorso.png', table);
  // The screenshots show the exact application tree of S1; only this test was changed.
  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify({
    contract: 'CDC-02/S1-HPR-EVIDENCE-v1',
    applicationTreeSourceCommit: '731aa092df27f6f27bbc5378795739c80bfef998',
    captureCandidateCommit: process.env.CANDIDATE_SHA || 'LOCAL_DIAGNOSTIC',
    viewport: { width: 360, height: 780 },
    dataClassification: 'synthetic-only',
    status: 'AUTOMATED_EVIDENCE_ONLY_NOT_HUMAN_ACCEPTANCE',
    screenshotFiles: screenshots
  }, null, 2) + '\n');
});
