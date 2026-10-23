const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const candidateSha = process.env.CANDIDATE_SHA || 'unknown';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');

const viewports = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1280x800', width: 1280, height: 800 }
];

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  return metrics;
}

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('uda-sem-01-qualification-only');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function selectThirdA(page) {
  await page.getByText('3ª A - Secondaria I Grado', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Panoramica Sezione: 3ª A - Secondaria I Grado' })).toBeVisible();
}

async function openDrawerDestination(page, label) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

for (const viewport of viewports) {
  test(`UDA-SEM-01 semantic browser contract — ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await setupFreshVault(page);
    await selectThirdA(page);

    await openDrawerDestination(page, 'Scheda alunno');
    await expect(page.getByRole('heading', { name: /Scheda Alunno/ })).toBeVisible();
    await page.getByText('Dossier UDA', { exact: true }).click();
    await expect(page.getByText('Dossier Valutativo per Unità Didattica (UDA)', { exact: true })).toBeVisible();

    const dossierText = await page.locator('body').innerText();
    expect(dossierText).toContain('Monte ore previsto: 14h');
    expect(dossierText).toContain('Ore registrate nel diario: 8h');
    expect(dossierText).toContain('Punti ponderati interni (indice attività):');
    expect(dossierText).toContain('9.3 pt');
    expect(dossierText).toContain('57% del monte ore');
    expect(dossierText).not.toContain('Ore ponderate interne (indice attività):');
    expect(dossierText).not.toContain('% svolto');

    const dossierOverflow = await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(evidenceDir, `uda-sem-01-${viewport.name}-dossier.png`),
      fullPage: true
    });

    await openDrawerDestination(page, 'UDA');
    const summaryButton = page.getByRole('button', { name: 'Riepilogo avanzamento interno', exact: true });
    await expect(summaryButton).toBeVisible();
    await summaryButton.click();
    await expect(page.getByText('Indice di avanzamento didattico (interno)', { exact: true }).first()).toBeVisible();

    const udaText = await page.locator('body').innerText();
    expect(udaText).toContain('Avanzamento ore nel diario');
    expect(udaText).toContain('Indice di avanzamento didattico (interno)');
    expect(udaText).toContain('Indicatore interno di pianificazione: 60% copertura delle ore registrate nel diario + 40% valutazioni collegate');
    expect(udaText).toContain('Non determina voti o livelli');
    expect(udaText).toContain('non una regola di valutazione prescritta');
    expect(udaText).toContain('Contesto curricolare: D.M. 221/2025');
    expect(udaText).toContain('Quota valutazioni:');
    expect(udaText).not.toContain('Quota verifiche:');
    expect(udaText).toContain('74%');
    expect(udaText).toContain('33%');

    const udaOverflow = await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(evidenceDir, `uda-sem-01-${viewport.name}-uda.png`),
      fullPage: true
    });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    await fs.writeFile(
      path.join(evidenceDir, `uda-sem-01-${viewport.name}.json`),
      JSON.stringify({
        candidateSha,
        result: 'PASS',
        viewport,
        dossierOverflow,
        udaOverflow,
        consoleErrors,
        pageErrors
      }, null, 2)
    );

    await context.close();
  });
}
