const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'ux-qa-02-browser-qualification';
const CLASS_NAME = 'Classe Sintetica UXQA02';
const UDA_TITLE = 'UDA Sintetica UXQA02';
const TECHNICAL_FILENAME = 'TECNOLOGIA_VERDE_2026_2027.json';
const READABLE_FILENAME_TITLE = 'TECNOLOGIA VERDE 2026 2027';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(180000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.locator('aside').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function returnHome(page) {
  await openDrawerItem(page, 'Classi');
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await returnHome(page);
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  const newUda = page.locator('main').getByRole('button', { name: 'Nuova UDA', exact: true });
  await expect(newUda).toBeVisible();
  await newUda.click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function addSyntheticFileSource(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Foto o file', exact: true }).click();
  await page.locator('#library-file-input').setInputFiles({
    name: TECHNICAL_FILENAME,
    mimeType: 'application/json',
    buffer: Buffer.from('{"title":"Tecnologia Verde 2026/27"}', 'utf8')
  });
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.locator('article').first()).toBeVisible();
}

function observation(id, status, node, expected, observed, evidence = []) {
  return { id, status, node, expected, observed, evidence };
}

async function visible(locator) {
  return locator.isVisible().catch(() => false);
}

async function capture(page, filename) {
  const target = path.join(evidenceDir, filename);
  await page.screenshot({ path: target, fullPage: true });
  return filename;
}

async function measure(locator) {
  if (!(await visible(locator))) return null;
  const box = await locator.boundingBox();
  if (!box) return null;
  return { width: box.width, height: box.height };
}

async function horizontalOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
}

test('UX-QA-02 records progressive-disclosure evidence across mature teacher surfaces', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const observations = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticClass(page);

  // P2: a destructive action must not compete with the primary class action.
  const classCard = page.locator('[data-uxqa-class-card]').filter({ hasText: CLASS_NAME }).first();
  await expect(classCard).toBeVisible();
  const manageClassButton = classCard.getByRole('button', { name: `Gestisci classe ${CLASS_NAME}`, exact: true });
  const deleteClassButton = classCard.getByRole('button', { name: `Elimina classe ${CLASS_NAME}`, exact: true });
  const deleteClassVisibleBeforeDisclosure = await visible(deleteClassButton);
  await expect(manageClassButton).toBeVisible();
  expect(deleteClassVisibleBeforeDisclosure).toBe(false);
  await manageClassButton.click();
  await expect(deleteClassButton).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await deleteClassButton.click();
  await expect(classCard).toBeVisible();
  await manageClassButton.click();
  await expect(deleteClassButton).toHaveCount(0);
  const homeShot = await capture(page, 'ux-qa-02-home-class-card-desktop.png');
  observations.push(observation(
    'UXPD-009',
    'PASS',
    'home.classes',
    'Destructive class maintenance is disclosed behind a secondary management action',
    'Class deletion is available only after the explicit class-management disclosure',
    [homeShot]
  ));

  // P2: evaluation entry should expose essentials before quick-fill/advanced helpers.
  await classCard.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
  await page.locator('main').getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  const quickFillVisible = await visible(page.getByText('COMPILAZIONE RAPIDA:', { exact: true }));
  const evaluationShot = await capture(page, 'ux-qa-02-evaluation-desktop.png');
  observations.push(observation(
    'UXPD-008',
    quickFillVisible ? 'FAIL' : 'PASS',
    'class.evaluations',
    'Evaluation entry starts from essential assessment fields; quick-fill and advanced helpers are disclosed on demand',
    quickFillVisible ? 'Quick-fill controls are visible immediately on entry' : 'Quick-fill controls are not dominant on entry',
    [evaluationShot]
  ));

  // P1: Programmazione must not expose the entire profile/calendar/organization form at once.
  await openDrawerItem(page, 'Programmazione didattica');
  await expect(page.getByRole('heading', { name: 'Programmazione didattica', exact: true })).toBeVisible();
  const planningMain = page.locator('main');
  const planningSelectors = [
    planningMain.getByRole('button', { name: 'Profilo', exact: true }),
    planningMain.getByRole('button', { name: 'Calendario e normativa', exact: true }),
    planningMain.getByRole('button', { name: 'Organizzazione', exact: true })
  ];
  const planningSelectorVisibility = await Promise.all(planningSelectors.map(item => visible(item)));
  const planningSectionsPresent = planningSelectorVisibility.every(Boolean);
  const calendarFieldsVisible = await visible(planningMain.getByText('Inizio lezioni', { exact: true }));
  const organizationFieldsVisible = await visible(planningMain.getByText('Ore settimanali reali', { exact: true }));
  const planningShot = await capture(page, 'ux-qa-02-planning-desktop.png');
  observations.push(observation(
    'UXPD-001',
    planningSectionsPresent && !(calendarFieldsVisible && organizationFieldsVisible) ? 'PASS' : 'FAIL',
    'planning',
    'Programmazione opens read-first/section-first instead of rendering the whole planning form',
    `sectionSelectors=${JSON.stringify(planningSelectorVisibility)}; calendarVisible=${calendarFieldsVisible}; organizationVisible=${organizationFieldsVisible}`,
    [planningShot]
  ));
  observations.push(observation(
    'UXPD-002',
    planningSectionsPresent ? 'PASS' : 'FAIL',
    'planning',
    'Programmazione exposes Profilo, Calendario e normativa, Organizzazione as explicit sections with one focused edit surface',
    planningSectionsPresent ? 'Three explicit planning sections are available' : 'Required planning section selectors are missing',
    [planningShot]
  ));

  // P1: UDA must have four teacher-facing local views and keep analysis/planning out of the default UDA surface.
  await createSyntheticUda(page);
  const udaMain = page.locator('main');
  const udaSelectors = [
    udaMain.getByRole('button', { name: 'UDA', exact: true }),
    udaMain.getByRole('button', { name: 'Avanzamento', exact: true }),
    udaMain.getByRole('button', { name: 'Pianificazione', exact: true }),
    udaMain.getByRole('button', { name: 'Analisi', exact: true })
  ];
  const udaSelectorVisibility = await Promise.all(udaSelectors.map(item => visible(item)));
  const udaViewsPresent = udaSelectorVisibility.every(Boolean);
  const activityMetricsVisible = await visible(udaMain.getByText('Indice Attività UDA', { exact: true }));
  const ganttVisible = await visible(udaMain.getByRole('button', { name: /Cronoprogramma Gantt.*Dipendenze/ }));
  const gapVisible = await visible(udaMain.getByRole('button', { name: /Gap Analysis Competenze/ }));
  const advancedFamiliesVisible = [activityMetricsVisible, ganttVisible, gapVisible].filter(Boolean).length;
  const udaShot = await capture(page, 'ux-qa-02-uda-desktop.png');
  observations.push(observation(
    'UXPD-003',
    udaViewsPresent ? 'PASS' : 'FAIL',
    'uda',
    'UDA workspace exposes UDA, Avanzamento, Pianificazione and Analisi as explicit focused views with UDA as default',
    `viewSelectors=${JSON.stringify(udaSelectorVisibility)}`,
    [udaShot]
  ));
  observations.push(observation(
    'UXPD-004',
    udaViewsPresent && advancedFamiliesVisible === 0 ? 'PASS' : 'FAIL',
    'uda',
    'Default UDA view does not simultaneously surface progress metrics, Gantt/dependencies and gap analysis',
    `activityMetricsVisible=${activityMetricsVisible}; ganttControlVisible=${ganttVisible}; gapControlVisible=${gapVisible}`,
    [udaShot]
  ));

  // P2: Library primary label should describe the teacher resource, not expose the technical filename as its title.
  await addSyntheticFileSource(page);
  const libraryMain = page.locator('main');
  const readableHeading = libraryMain.getByRole('heading', { name: READABLE_FILENAME_TITLE, exact: true });
  const technicalHeadingVisible = await visible(libraryMain.getByRole('heading', { name: TECHNICAL_FILENAME, exact: true }));
  await expect(readableHeading).toBeVisible();
  await expect(libraryMain.getByText(TECHNICAL_FILENAME, { exact: true })).toBeVisible();
  expect(technicalHeadingVisible).toBe(false);
  const libraryShot = await capture(page, 'ux-qa-02-library-desktop.png');
  observations.push(observation(
    'UXPD-005',
    'PASS',
    'library',
    'Library uses a human-readable resource title as primary label and keeps the filename secondary',
    `Readable title ${READABLE_FILENAME_TITLE} is primary; ${TECHNICAL_FILENAME} remains secondary provenance`,
    [libraryShot]
  ));

  // P2: Settings should keep identity/profile primary and disclose advanced professional/technical groups.
  await openDrawerItem(page, 'Impostazioni');
  await expect(page.getByRole('heading', { name: 'Impostazioni Generali & Profilo Docente' })).toBeVisible();
  const settingsMain = page.locator('main');
  const weightingVisible = await visible(settingsMain.getByText(/Ponderazione configurabile delle valutazioni/));
  const technicalEmbeddingVisible = await visible(settingsMain.getByText(/Motore Vettoriale & Embedding Locale/));
  const settingsShot = await capture(page, 'ux-qa-02-settings-desktop.png');
  observations.push(observation(
    'UXPD-006',
    !weightingVisible && !technicalEmbeddingVisible ? 'PASS' : 'FAIL',
    'settings',
    'Settings opens on profile/identity and discloses weighting and technical integration groups on demand',
    `weightingVisible=${weightingVisible}; technicalEmbeddingVisible=${technicalEmbeddingVisible}`,
    [settingsShot]
  ));

  // P2: Privacy starts from status/principles and keeps deep implementation details behind disclosure.
  await openDrawerItem(page, 'Privacy');
  await expect(page.getByRole('heading', { name: /Privacy First & Protezione dei dati/ })).toBeVisible();
  const privacyMain = page.locator('main');
  const vaultTechnicalVisible = await visible(privacyMain.getByText(/VAULT LOCALE CIFRATO/));
  const cryptoTechnicalVisible = await visible(privacyMain.getByText(/CRITTOGRAFIA AES-256/));
  const privacyShot = await capture(page, 'ux-qa-02-privacy-desktop.png');
  observations.push(observation(
    'UXPD-007',
    !vaultTechnicalVisible && !cryptoTechnicalVisible ? 'PASS' : 'FAIL',
    'privacy',
    'Privacy is summary-first and deep technical implementation details are disclosed on demand',
    `vaultTechnicalVisible=${vaultTechnicalVisible}; cryptoTechnicalVisible=${cryptoTechnicalVisible}`,
    [privacyShot]
  ));

  // P1 mobile fit: audit the two blocking product surfaces and any new local selectors if present.
  await page.setViewportSize({ width: 390, height: 844 });
  await openDrawerItem(page, 'Programmazione didattica');
  await expect(page.getByRole('heading', { name: 'Programmazione didattica', exact: true })).toBeVisible();
  const planningOverflow = await horizontalOverflow(page);
  const planningSizes = [];
  for (const selector of planningSelectors) {
    const size = await measure(selector);
    if (size) planningSizes.push(size);
  }
  const planningMobileShot = await capture(page, 'ux-qa-02-planning-mobile.png');

  await openDrawerItem(page, 'UDA');
  const udaOverflow = await horizontalOverflow(page);
  const udaSizes = [];
  for (const selector of udaSelectors) {
    const size = await measure(selector);
    if (size) udaSizes.push(size);
  }
  const newUdaSize = await measure(page.locator('main').getByRole('button', { name: 'Nuova UDA', exact: true }));
  if (newUdaSize) udaSizes.push(newUdaSize);
  const udaMobileShot = await capture(page, 'ux-qa-02-uda-mobile.png');

  const allMeasured = [...planningSizes, ...udaSizes];
  const touchSafe = allMeasured.length > 0 && allMeasured.every(size => size.width >= 44 && size.height >= 44);
  const noOverflow =
    planningOverflow.scrollWidth <= planningOverflow.innerWidth + 1 &&
    udaOverflow.scrollWidth <= udaOverflow.innerWidth + 1;
  observations.push(observation(
    'UXPD-010',
    noOverflow && touchSafe ? 'PASS' : 'FAIL',
    'mobile-audit',
    'Audited mobile nodes have no horizontal overflow and visible primary/view controls are at least 44x44 CSS px',
    `planningOverflow=${planningOverflow.scrollWidth}/${planningOverflow.innerWidth}; udaOverflow=${udaOverflow.scrollWidth}/${udaOverflow.innerWidth}; targets=${JSON.stringify(allMeasured)}`,
    [planningMobileShot, udaMobileShot]
  ));

  // P0 pageerror is deliberately the final observation after the last screenshot/evidence operation.
  observations.push(observation(
    'UXPD-011',
    pageErrors.length === 0 ? 'PASS' : 'FAIL',
    'journey',
    'No pageerror occurs through the final UXPD evidence capture',
    pageErrors.length === 0 ? 'No pageerror observed' : pageErrors.join(' | '),
    [homeShot, planningShot, udaShot, libraryShot, settingsShot, privacyShot, planningMobileShot, udaMobileShot]
  ));

  fs.writeFileSync(
    path.join(evidenceDir, 'ux-qa-02-evidence.json'),
    `${JSON.stringify({
      schema: 'registro.ux-qa-progressive-disclosure-evidence/v1',
      candidateSha: process.env.CANDIDATE_SHA || null,
      observations,
      pageErrors
    }, null, 2)}\n`
  );
});
