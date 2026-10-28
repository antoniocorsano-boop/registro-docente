const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-06-budget-governor-browser';
const CLASS_NAME = 'Classe Sintetica AIC-06';
const UDA_TITLE = 'UDA Sintetica AIC-06';
const ROUTINE_SOURCE = 'Fonte ordinaria AIC-06';
const EXPENSIVE_SOURCE = 'Fonte ampia AIC-06';
const MOBILE_SOURCE = 'Fonte ampia mobile AIC-06';
const PROPOSAL_TITLE = 'Proposta sintetica AIC-06';
const LARGE_TEXT = `Materiale professionale sintetico AIC-06. ${'energia trasformazione sistema tecnologia '.repeat(2100)}`;

const proposalContent = {
  title: PROPOSAL_TITLE,
  objective: 'Riconoscere una trasformazione tecnologica nel contesto corrente.',
  teacherSetup: 'Presentare la fonte e richiamare il lessico essenziale.',
  studentTask: 'Ricostruire il processo e motivarne i passaggi.',
  steps: ['Osserva', 'Ricostruisci', 'Motiva'],
  questions: ['Quale trasformazione osservi?', 'Quale passaggio è più importante?'],
  adaptationHint: 'Usare una tabella guida essenziale.'
};

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(150000);

function installConsoleGuards(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  return { pageErrors, consoleErrors };
}

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function reloadAndUnlock(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const unlock = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlock.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(vaultPassword);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createFixture(page, sources) {
  await setupFreshVault(page);
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await closePersistenceConfirmation(page);

  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();

  await openDrawerItem(page, 'Biblioteca privata');
  for (const [title, content] of sources) {
    await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
    await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
    await page.getByLabel('Tipo').selectOption('concept');
    await page.getByLabel('Titolo').fill(title);
    await page.getByLabel('Contenuto').fill(content);
    await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }

  await reloadAndUnlock(page);
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
  await openDrawerItem(page, 'Biblioteca privata');
}

async function openComposer(page, sourceTitle) {
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('copilot-deck')).toBeVisible();
  await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  await composer.getByLabel('Fonte della Biblioteca').selectOption({ label: sourceTitle });
  return composer;
}

async function openPrepare(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  if (await classify.isVisible().catch(() => false)) await classify.click();
  await disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  await disclosure.getByRole('button', { name: 'Prepara attività', exact: true }).click();
  return disclosure;
}

async function assertAtLeast44(locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
}

function proposalFor(body) {
  return {
    schemaVersion: 1,
    kind: 'activity',
    ...proposalContent,
    sourceId: body.source.id,
    context: { udaId: body.context.udaId, ...(body.context.lessonId ? { lessonId: body.context.lessonId } : {}) },
    provenance: { mode: 'remote', provider: 'browser-fixture', model: 'browser-fixture-v1', generatedAt: '2026-10-27T18:00:00.000Z' }
  };
}

async function installRoutes(page, bodies) {
  await page.route('**/api/copilot/library-proposal/provider', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
  }));
  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const expanded = Boolean(body.budget?.authorization);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposal: proposalFor(body),
        receipt: {
          requestId: `browser-aic06-${bodies.length}`,
          provider: 'browser-fixture',
          model: 'browser-fixture-v1',
          durationMs: 10,
          attemptCount: 1,
          budget: { tier: expanded ? 'remote-expanded' : 'remote-low', profile: body.budget.profile, escalated: expanded }
        }
      })
    });
  });
}

test('AIC-06 governs routine and expensive PREPARE and persists only the base profile — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const bodies = [];
  await installRoutes(page, bodies);
  await createFixture(page, [
    [ROUTINE_SOURCE, 'Breve materiale professionale sintetico sulle trasformazioni di energia.'],
    [EXPENSIVE_SOURCE, LARGE_TEXT]
  ]);

  let composer = await openComposer(page, ROUTINE_SOURCE);
  let disclosure = await openPrepare(composer);
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0].budget).toMatchObject({ schemaVersion: 1, profile: 'balanced' });
  expect(bodies[0].budget.authorization).toBeUndefined();
  await disclosure.getByRole('button', { name: 'Lascia', exact: true }).click();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  composer = await openComposer(page, EXPENSIVE_SOURCE);
  disclosure = await openPrepare(composer);
  await expect(disclosure.getByText('Serve una tua autorizzazione aggiuntiva', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
  const operation = disclosure.getByRole('button', { name: 'Autorizza solo questa operazione', exact: true });
  const activity = disclosure.getByRole('button', { name: 'Autorizza per questa attività', exact: true });
  await assertAtLeast44(operation);
  await assertAtLeast44(activity);
  await operation.click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1].budget.authorization.scope).toBe('operation');
  await disclosure.getByRole('button', { name: 'Lascia', exact: true }).click();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  composer = await openComposer(page, EXPENSIVE_SOURCE);
  disclosure = await openPrepare(composer);
  await expect(disclosure.getByText('Serve una tua autorizzazione aggiuntiva', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2);
  await disclosure.getByRole('button', { name: 'Autorizza per questa attività', exact: true }).click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[2].budget.authorization.scope).toBe('activity');
  await disclosure.getByRole('button', { name: 'Lascia', exact: true }).click();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  await openDrawerItem(page, 'Impostazioni');
  const economy = page.getByRole('button', { name: /^Risparmio/ });
  await economy.click();
  await expect(economy).toHaveAttribute('aria-pressed', 'true');
  await expect(economy).toBeEnabled();
  await expect(page.locator('[aria-label="Impostazioni aggiornate"]')).toBeVisible();
  await reloadAndUnlock(page);
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
  await openDrawerItem(page, 'Impostazioni');
  await expect(page.getByRole('button', { name: /^Risparmio/ })).toHaveAttribute('aria-pressed', 'true');
  await openDrawerItem(page, 'Biblioteca privata');

  composer = await openComposer(page, EXPENSIVE_SOURCE);
  disclosure = await openPrepare(composer);
  await expect(disclosure.getByText('Serve una tua autorizzazione aggiuntiva', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(3);
  await disclosure.getByRole('button', { name: 'Autorizza solo questa operazione', exact: true }).click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  expect(bodies).toHaveLength(4);
  expect(bodies[3].budget.profile).toBe('economy');

  await page.screenshot({ path: path.join(evidenceDir, 'aic-06-budget-governor-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-06-budget-governor-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    proposalRequestCount: bodies.length,
    scopes: bodies.map(body => body.budget?.authorization?.scope || null),
    profiles: bodies.map(body => body.budget?.profile || null),
    ...guards
  }, null, 2) + '\n');
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-06 escalation disclosure is touch-safe before any proposal POST — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  const bodies = [];
  await installRoutes(page, bodies);
  await createFixture(page, [[MOBILE_SOURCE, LARGE_TEXT]]);
  const composer = await openComposer(page, MOBILE_SOURCE);
  const disclosure = await openPrepare(composer);
  await expect(disclosure.getByText('Serve una tua autorizzazione aggiuntiva', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(0);
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Autorizza solo questa operazione', exact: true }));
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Autorizza per questa attività', exact: true }));
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  await page.screenshot({ path: path.join(evidenceDir, 'aic-06-budget-governor-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-06-budget-governor-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    proposalRequestCountBeforeAuthorization: bodies.length,
    overflow,
    ...guards
  }, null, 2) + '\n');
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
