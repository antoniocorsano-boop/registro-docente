const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'ux-qa-01-browser-qualification';
const CLASS_A = 'Classe Sintetica UXQA A';
const CLASS_B = 'Classe Sintetica UXQA B';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function reloadAndUnlock(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlockHeading.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(vaultPassword);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.locator('aside').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticClass(page, name) {
  page.once('dialog', dialog => dialog.accept(name));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${name}` })).toBeVisible();
  await closePersistenceConfirmation(page);
}

async function returnHome(page) {
  await openDrawerItem(page, 'Classi');
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

function observation(id, status, node, expected, observed, evidence = []) {
  return { id, status, node, expected, observed, evidence };
}

async function isVisible(locator) {
  return locator.isVisible().catch(() => false);
}

async function capture(page, filename) {
  const target = path.join(evidenceDir, filename);
  await page.screenshot({ path: target, fullPage: true });
  return filename;
}

async function measureTouchTarget(locator) {
  if (!(await isVisible(locator))) return null;
  const box = await locator.boundingBox();
  if (!box) return null;
  return { width: box.width, height: box.height };
}

test('UX-QA-01 explores the teacher journey and records deterministic usability evidence', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const observations = [];
  const navigationGraph = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticClass(page, CLASS_A);
  await returnHome(page);
  await createSyntheticClass(page, CLASS_B);

  // Reopen the persisted vault. Current production persists currentClassId, so the
  // explorer observes whether that navigation context is reactivated implicitly.
  await reloadAndUnlock(page);
  const staleClassSwitcherCount = await page.locator('select[title="Cambia rapidamente classe attiva"]').count();
  const staleClassNavCount = await page.getByRole('button', { name: 'Valutazioni', exact: true }).count();
  const ingressShot = await capture(page, 'ux-qa-01-ingress-desktop.png');
  observations.push(observation(
    'UXNAV-001',
    staleClassSwitcherCount === 0 ? 'PASS' : 'FAIL',
    'home.classes',
    'Home opens with no active class even when the vault persisted a previous currentClassId',
    staleClassSwitcherCount === 0 ? 'No implicit class context detected' : 'A persisted class context was reactivated on Home',
    [ingressShot]
  ));
  observations.push(observation(
    'UXNAV-002',
    staleClassNavCount === 0 ? 'PASS' : 'FAIL',
    'home.classes',
    'Class-only navigation is absent until an explicit class selection',
    staleClassNavCount === 0 ? 'No class-only navigation on Home' : `${staleClassNavCount} class navigation control(s) exist on Home`,
    [ingressShot]
  ));

  // Normalize to an explicit neutral Home before auditing hierarchy and history.
  await returnHome(page);
  const main = page.locator('main');
  const homeModeButtons = {
    classes: main.getByRole('button', { name: 'Classi', exact: true }),
    summary: main.getByRole('button', { name: 'Sintesi', exact: true }),
    comparison: main.getByRole('button', { name: 'Confronto', exact: true })
  };
  const hasHomeModes =
    (await homeModeButtons.classes.count()) === 1 &&
    (await homeModeButtons.summary.count()) === 1 &&
    (await homeModeButtons.comparison.count()) === 1;
  const kpiVisible = await isVisible(main.getByText('Media Istituto', { exact: true }));
  const comparisonVisible = await isVisible(main.getByText('Confronto tra classi', { exact: true }));
  const classCards = main.locator('[data-uxqa-class-card]');
  const classCardCount = await classCards.count();
  const accentValues = classCardCount > 0
    ? await classCards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-accent-index')))
    : [];
  const distinctAccents = new Set(accentValues.filter(Boolean)).size;
  const homeShot = await capture(page, 'ux-qa-01-home-classes-desktop.png');

  observations.push(observation(
    'UXNAV-005',
    hasHomeModes ? 'PASS' : 'FAIL',
    'home.classes',
    'Home exposes Classi, Sintesi and Confronto and starts from Classi',
    hasHomeModes ? 'Three explicit Home views are available' : 'Teacher-first Home view controls are missing',
    [homeShot]
  ));
  observations.push(observation(
    'UXNAV-006',
    hasHomeModes && !kpiVisible && !comparisonVisible ? 'PASS' : 'FAIL',
    'home.classes',
    'KPI summary and class comparison stay hidden until explicitly requested',
    `summaryVisible=${kpiVisible}; comparisonVisible=${comparisonVisible}`,
    [homeShot]
  ));
  observations.push(observation(
    'UXNAV-007',
    classCardCount >= 2 && distinctAccents >= 2 ? 'PASS' : 'FAIL',
    'home.classes',
    'At least two compact class cards are directly present with distinct stable categorical accents',
    `classCards=${classCardCount}; distinctAccents=${distinctAccents}`,
    [homeShot]
  ));

  // Class entry must create one history node and Back must return to neutral Home.
  const classBOpen = main.getByRole('button', { name: `Apri classe ${CLASS_B}`, exact: true });
  const legacyClassBOpen = main.getByText(CLASS_B, { exact: true }).last();
  if (await isVisible(classBOpen)) {
    await classBOpen.click();
  } else {
    await legacyClassBOpen.click();
  }
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_B}` })).toBeVisible();
  navigationGraph.push({ from: 'home.classes', to: 'class.dashboard', action: `select:${CLASS_B}` });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  const classBackReturnedHome = await isVisible(page.getByRole('heading', { name: 'Le mie classi' }));
  const classContextAfterBack = await page.locator('select[title="Cambia rapidamente classe attiva"]').count();
  observations.push(observation(
    'UXNAV-003',
    classBackReturnedHome && classContextAfterBack === 0 ? 'PASS' : 'FAIL',
    'class.dashboard',
    'Browser Back from class dashboard returns to neutral Home',
    `home=${classBackReturnedHome}; activeClassControls=${classContextAfterBack}`,
    [await capture(page, 'ux-qa-01-back-class-home-desktop.png')]
  ));
  navigationGraph.push({ from: 'class.dashboard', to: classBackReturnedHome ? 'home.classes' : 'unknown', action: 'browser-back' });

  if (!classBackReturnedHome) await returnHome(page);

  // A class subview must add its own history node. This currently exposes the
  // state-only tab navigation defect without stopping evidence collection.
  const classBOpenAgain = main.getByRole('button', { name: `Apri classe ${CLASS_B}`, exact: true });
  if (await isVisible(classBOpenAgain)) {
    await classBOpenAgain.click();
  } else {
    await main.getByText(CLASS_B, { exact: true }).last().click();
  }
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_B}` })).toBeVisible();
  await page.locator('main').getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  navigationGraph.push({ from: 'class.dashboard', to: 'class.evaluations', action: 'Valutazioni' });

  await page.goBack({ waitUntil: 'domcontentloaded' });
  const firstBackDashboard = await isVisible(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_B}` }));
  let secondBackHome = false;
  if (firstBackDashboard) {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    secondBackHome = await isVisible(page.getByRole('heading', { name: 'Le mie classi' }));
  } else {
    secondBackHome = await isVisible(page.getByRole('heading', { name: 'Le mie classi' }));
  }
  observations.push(observation(
    'UXNAV-004',
    firstBackDashboard && secondBackHome ? 'PASS' : 'FAIL',
    'class.evaluations',
    'First Back returns to the same class dashboard; second Back returns to Home',
    `firstBackDashboard=${firstBackDashboard}; secondBackHome=${secondBackHome}`,
    [await capture(page, 'ux-qa-01-relative-back-desktop.png')]
  ));
  navigationGraph.push({ from: 'class.evaluations', to: firstBackDashboard ? 'class.dashboard' : (secondBackHome ? 'home.classes' : 'unknown'), action: 'browser-back' });

  if (!(await isVisible(page.getByRole('heading', { name: 'Le mie classi' })))) await returnHome(page);

  // Global routes are captured in the graph even before they become blocking invariants.
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  navigationGraph.push({ from: 'home.classes', to: 'library', action: 'Biblioteca privata' });
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
  navigationGraph.push({ from: 'library', to: await isVisible(page.getByRole('heading', { name: 'Le mie classi' })) ? 'home.classes' : 'unknown', action: 'browser-back' });
  if (!(await isVisible(page.getByRole('heading', { name: 'Le mie classi' })))) {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
    if (await isVisible(unlockHeading)) {
      await page.locator('#vault-password').fill(vaultPassword);
      await page.getByRole('button', { name: 'Sblocca Registro' }).click();
    }
    if (!(await isVisible(page.getByRole('heading', { name: 'Le mie classi' })))) await returnHome(page);
  }

  await openDrawerItem(page, 'Programmazione');
  await expect(page.getByRole('heading', { name: 'Programmazione didattica', exact: true })).toBeVisible();
  navigationGraph.push({ from: 'home.classes', to: 'planning', action: 'Programmazione' });
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
  navigationGraph.push({ from: 'planning', to: await isVisible(page.getByRole('heading', { name: 'Le mie classi' })) ? 'home.classes' : 'unknown', action: 'browser-back' });

  // Mobile fit is assessed on neutral Home, independently from semantic UX findings.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await isVisible(unlockHeading)) {
    await page.locator('#vault-password').fill(vaultPassword);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  if (!(await isVisible(page.getByRole('heading', { name: 'Le mie classi' })))) await returnHome(page);
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.getByRole('button', { name: 'Valutazioni', exact: true }).count()) await returnHome(page);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  const touchTargets = [];
  for (const locator of [
    page.getByRole('button', { name: /Nuova Classe/ }),
    page.getByRole('button', { name: 'Menu', exact: true }),
    main.getByRole('button', { name: 'Classi', exact: true }),
    main.getByRole('button', { name: 'Sintesi', exact: true }),
    main.getByRole('button', { name: 'Confronto', exact: true })
  ]) {
    const size = await measureTouchTarget(locator);
    if (size) touchTargets.push(size);
  }
  const touchSafe = touchTargets.length >= 2 && touchTargets.every(size => size.width >= 44 && size.height >= 44);
  const mobileShot = await capture(page, 'ux-qa-01-home-mobile.png');
  observations.push(observation(
    'UXNAV-008',
    overflow.scrollWidth <= overflow.innerWidth + 1 && touchSafe ? 'PASS' : 'FAIL',
    'home.classes',
    '390x844 Home has no horizontal overflow and primary controls are at least 44x44 CSS px',
    `overflow=${overflow.scrollWidth}/${overflow.innerWidth}; touchTargets=${JSON.stringify(touchTargets)}`,
    [mobileShot]
  ));

  // The error invariant is evaluated last so late rendering/screenshot errors cannot be hidden.
  observations.push(observation(
    'UXNAV-009',
    pageErrors.length === 0 ? 'PASS' : 'FAIL',
    'journey',
    'No pageerror occurs through the final evidence capture',
    pageErrors.length === 0 ? 'No pageerror observed' : pageErrors.join(' | '),
    [ingressShot, homeShot, mobileShot]
  ));

  fs.writeFileSync(
    path.join(evidenceDir, 'ux-qa-01-evidence.json'),
    JSON.stringify({
      schema: 'registro.ux-qa-evidence/v1',
      candidateSha: process.env.CANDIDATE_SHA || null,
      generatedAt: new Date().toISOString(),
      observations,
      navigationGraph,
      pageErrors
    }, null, 2) + '\n'
  );

  // Only harness/runtime failures should fail Playwright. UX defects are delegated
  // to the deterministic analyzer step so the complete journey remains inspectable.
  expect(observations).toHaveLength(9);
});
