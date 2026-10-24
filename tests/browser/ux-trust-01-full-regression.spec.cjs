const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const candidateSha = process.env.CANDIDATE_SHA || 'unknown';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'ux-trust-01-full-regression-only';

test.setTimeout(180000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function unlockVault(page) {
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

function primaryWorkflowButton(page, label) {
  return page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first();
}

async function openDrawerDestination(page, label) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function assertNoDocumentOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.bodyScrollWidth, `${label}: body horizontal overflow`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.rootScrollWidth, `${label}: root horizontal overflow`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  return metrics;
}

async function checkpoint(page, visited, label, marker) {
  if (marker) await expect(marker, `${label}: route marker`).toBeVisible();
  await expect(page.locator('main'), `${label}: teacher main`).toBeVisible();
  const metrics = await assertNoDocumentOverflow(page, label);
  visited.push({ label, metrics });
}

async function assertStudentPortalIsolation(page, viewport, visited) {
  await page.goto(`${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(visited.className)}`, {
    waitUntil: 'domcontentloaded'
  });
  await unlockVault(page);

  const portal = page.locator('div.fixed.inset-0.z-\\[60\\]').first();
  await expect(portal).toBeVisible();
  await expect(page.getByText('Flashcard Formativa', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('es. Rossi Maria')).toBeVisible();

  const box = await portal.boundingBox();
  expect(box, 'Student Portal viewport box').not.toBeNull();
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);

  const topmostIsPortal = await page.evaluate(() => {
    const portalNode = document.querySelector('div.fixed.inset-0.z-\\[60\\]');
    const topmost = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return Boolean(portalNode && topmost && portalNode.contains(topmost));
  });
  expect(topmostIsPortal, 'Student Portal must own the visible viewport above teacher chrome').toBe(true);

  const metrics = await assertNoDocumentOverflow(page, 'Student Portal');
  visited.items.push({ label: 'Student Portal', metrics, portalBox: box });
}

for (const viewport of [
  { name: 'mobile 390x844', width: 390, height: 844 },
  { name: 'desktop 1280x900', width: 1280, height: 900 }
]) {
  test(`UXT-F full application inventory is error-free and overflow-safe — ${viewport.name}`, async ({ browser }) => {
    await fs.mkdir(evidenceDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const suffix = viewport.width < 768 ? 'MOBILE' : 'DESKTOP';
    const className = `Classe Sintetica UXT-F ${suffix}`;
    const visited = { className, items: [] };

    await setupFreshVault(page);
    await checkpoint(page, visited.items, 'Home', page.getByRole('heading', { name: 'Le mie classi' }));

    page.once('dialog', dialog => dialog.accept(className));
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
    await closePersistenceConfirmation(page);
    await checkpoint(page, visited.items, 'Gestione alunni', page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` }));

    await primaryWorkflowButton(page, 'Riepilogo').click();
    await checkpoint(page, visited.items, 'Riepilogo', page.getByRole('heading', { name: `Panoramica Sezione: ${className}` }));

    await primaryWorkflowButton(page, 'Valutazioni').click();
    await checkpoint(page, visited.items, 'Valutazioni', page.getByRole('heading', { name: 'Nuova Valutazione di Classe' }));

    await primaryWorkflowButton(page, 'Comportamento').click();
    await checkpoint(page, visited.items, 'Comportamento', page.getByRole('heading', { name: 'Valutazione Rapida Comportamenti' }));

    await primaryWorkflowButton(page, 'Tabellone').click();
    await checkpoint(page, visited.items, 'Tabellone', page.getByRole('heading', { name: `Tabellone Classe: ${className}` }));

    await primaryWorkflowButton(page, 'Analisi').click();
    await checkpoint(page, visited.items, 'Analisi', page.getByRole('heading', { name: 'Analisi medie & fasce analitiche' }));

    await openDrawerDestination(page, 'Storico prove');
    await checkpoint(page, visited.items, 'Storico', page.getByRole('heading', { name: `Storico Prove Registrate: ${className}` }));

    await openDrawerDestination(page, 'Scheda alunno');
    await checkpoint(page, visited.items, 'Scheda alunno', page.getByRole('heading', { name: 'Scheda Alunno & Profilo delle Competenze' }));

    await openDrawerDestination(page, 'Gestione alunni');
    await checkpoint(page, visited.items, 'Gestione alunni (drawer)', page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` }));

    await openDrawerDestination(page, 'Verifiche online');
    await checkpoint(page, visited.items, 'Verifiche online', page.getByRole('heading', { name: 'Verifiche sulle Lezioni & Flashcards Formative' }));

    await openDrawerDestination(page, 'UDA');
    await checkpoint(page, visited.items, 'UDA', page.getByRole('button', { name: 'Nuova UDA', exact: true }));

    await openDrawerDestination(page, 'Impostazioni');
    await checkpoint(page, visited.items, 'Impostazioni', page.getByRole('heading', { name: 'Impostazioni Generali & Profilo Docente' }));

    await openDrawerDestination(page, 'Privacy');
    await checkpoint(page, visited.items, 'Privacy', page.getByRole('heading', { name: /Privacy First & Protezione dei dati/ }));

    const shield = page.locator('button[title^="Privacy Shield"]').first();
    await expect(shield).toBeVisible();
    await shield.click();
    await expect(shield).toHaveClass(/bg-slate-800/);
    await assertNoDocumentOverflow(page, 'Privacy Shield disabled');
    await shield.click();
    await expect(shield).toHaveClass(/bg-purple-950/);
    await assertNoDocumentOverflow(page, 'Privacy Shield enabled');
    visited.items.push({ label: 'Privacy Shield', toggledOffAndOn: true });

    await assertStudentPortalIsolation(page, viewport, visited);

    expect(pageErrors, 'full inventory page errors').toEqual([]);
    expect(consoleErrors, 'full inventory unexpected console errors').toEqual([]);

    const slug = viewport.width < 768 ? 'mobile' : 'desktop';
    await page.screenshot({
      path: path.join(evidenceDir, `ux-trust-01-uxt-f-${slug}.png`),
      fullPage: false
    });
    await fs.writeFile(
      path.join(evidenceDir, `ux-trust-01-uxt-f-${slug}.json`),
      JSON.stringify({
        candidateSha,
        viewport,
        className,
        syntheticOnly: true,
        visited: visited.items,
        pageErrors,
        consoleErrors,
        result: 'PASS'
      }, null, 2) + '\n'
    );

    await context.close();
  });
}
