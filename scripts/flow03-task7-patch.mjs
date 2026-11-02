import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`PATCH_MARKER_MISSING:${label}`);
  const second = source.indexOf(needle, first + needle.length);
  if (second >= 0) throw new Error(`PATCH_MARKER_AMBIGUOUS:${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

const flow02SpecPath = 'tests/browser/flow-02-conduci.spec.cjs';
let flow02Spec = readFileSync(flow02SpecPath, 'utf8');
flow02Spec = replaceOnce(
  flow02Spec,
  "  const record = page.getByRole('region', { name: 'Continua: Registra' });",
  "  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });",
  'flow02-record-region'
);
flow02Spec = replaceOnce(
  flow02Spec,
  '    await expect(record).not.toContainText(RAPID_NOTE);',
  "    await expect(record.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);",
  'flow02-staged-note-expectation'
);
writeFileSync(flow02SpecPath, flow02Spec);

const flow02ContractPath = 'src/security/flow02BrowserQualificationContract.test.ts';
let flow02Contract = readFileSync(flow02ContractPath, 'utf8');
flow02Contract = replaceOnce(
  flow02Contract,
  `    expect(spec).toContain("getByRole('region', { name: 'Continua: Registra' })");\n    expect(spec).toContain('assertSelectedClassStillVisible');`,
  `    expect(spec).toContain("getByRole('region', { name: \\`Registra per \\${CLASS_NAME}\\` })");\n    expect(spec).toContain("getByLabel('Nota di sessione', { exact: true })");\n    expect(spec).toContain('toHaveValue(RAPID_NOTE)');\n    expect(spec).toContain('assertSelectedClassStillVisible');`,
  'flow02-browser-contract'
);
writeFileSync(flow02ContractPath, flow02Contract);

const browserSpecPath = 'tests/browser/flow-03-registra.spec.cjs';
if (existsSync(browserSpecPath)) throw new Error('PATCH_TARGET_ALREADY_EXISTS:flow03-browser-spec');
const browserSpec = String.raw`const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-03';
const UDA_TITLE = 'Sistema tecnologico FLOW-03';
const RAPID_NOTE = 'Osservazione FLOW-03: collegare la fase operativa al sistema tecnologico.';
const LESSON_TOPIC = 'Attività FLOW-03 registrata nel diario UDA';

// Journey markers: Conduci → Registra → diario UDA; Registra → Valutazione;
// Registra → Comportamento; Registra → Esiti verifica online.

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function assertNoPersistenceConfirmation(page) {
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toHaveCount(0);
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  const item = drawer.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function openOggiFromDrawer(page) {
  await openDrawerItem(page, 'Oggi');
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  const views = page.getByRole('group', { name: 'Viste UDA' });
  const udaToggle = views.getByRole('button', { name: 'UDA', exact: true });
  if (await udaToggle.isVisible().catch(() => false)) await udaToggle.click();

  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function setupClassAndUda(page, password) {
  await configureVault(page, password);
  await createSyntheticClass(page);
  await createSyntheticUda(page);
}

async function chooseClassIfRequested(page, action) {
  const status = page.getByRole('status');
  if (await status.isVisible().catch(() => false)) {
    const text = await status.textContent();
    if (text && text.includes(`Per continuare con ${action}, scegli una classe.`)) {
      await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
    }
  }
}

async function openConductToRecord(page, note = RAPID_NOTE) {
  await openOggiFromDrawer(page);
  await page.getByRole('button', { name: 'Conduci', exact: true }).click();
  await chooseClassIfRequested(page, 'Conduci');
  const conduct = page.getByRole('region', { name: `Conduci per ${CLASS_NAME}` });
  await expect(conduct).toBeVisible();
  await expect(conduct).toContainText(UDA_TITLE);
  const rapid = conduct.getByLabel('Nota rapida', { exact: true });
  await rapid.fill(note);
  await conduct.getByRole('button', { name: 'Vai a Registra', exact: true }).click();
  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  await expect(record).toContainText('Bozza temporanea — non ancora registrata');
  await expect(record.getByLabel('Nota di sessione', { exact: true })).toHaveValue(note);
  await assertSelectedClassStillVisible(page);
  return record;
}

async function openDirectRecord(page) {
  await openOggiFromDrawer(page);
  await page.getByRole('button', { name: 'Registra', exact: true }).click();
  await chooseClassIfRequested(page, 'Registra');
  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  return record;
}

async function assertSelectedClassStillVisible(page) {
  const quickSwitcher = page.locator('select[title="Cambia rapidamente classe attiva"]');
  if (await quickSwitcher.isVisible().catch(() => false)) {
    await expect.poll(() => quickSwitcher.evaluate(select => select.selectedOptions[0]?.textContent?.trim() ?? '')).toBe(CLASS_NAME);
    return;
  }
  await expect.poll(async () => {
    const labels = page.getByText(CLASS_NAME, { exact: true });
    for (let index = 0; index < await labels.count(); index += 1) {
      if (await labels.nth(index).isVisible()) return true;
    }
    return false;
  }).toBe(true);
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertCriticalControlsTouchSafe(record) {
  for (const label of ['Chiudi Registra', 'Valutazione', 'Comportamento', 'Esiti verifica online', 'Attività / nota UDA']) {
    const button = record.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertStagedNoteTextareaUnobscured(page, record) {
  const textarea = record.getByLabel('Nota di sessione', { exact: true });
  await textarea.scrollIntoViewIfNeeded();
  const box = await textarea.boundingBox();
  expect(box).not.toBeNull();
  const overlaps = await page.evaluate((textareaBox) => {
    const target = { left: textareaBox.x, top: textareaBox.y, right: textareaBox.x + textareaBox.width, bottom: textareaBox.y + textareaBox.height };
    const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return [...document.querySelectorAll('body *')]
      .filter(element => {
        const style = getComputedStyle(element);
        return style.position === 'fixed' && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(rect => intersects(target, rect));
  }, box);
  expect(overlaps).toEqual([]);
}

async function assertNoAutomaticMutation(page) {
  await assertNoPersistenceConfirmation(page);
}

test.describe('FLOW-03 desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Registra → Valutazione keeps the explicit class and safe UDA reviewable without automatic save', async ({ page }) => {
    await setupClassAndUda(page, 'flow-03-evaluation');
    const record = await openConductToRecord(page);
    await page.screenshot({ path: evidencePath('flow-03-desktop-record.png'), fullPage: true });
    await assertNoAutomaticMutation(page);

    await record.getByRole('button', { name: 'Valutazione', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe', exact: true })).toBeVisible();
    const udaSelect = page.getByLabel('Collega a UDA Curricolare', { exact: true });
    await expect.poll(() => udaSelect.evaluate(select => select.selectedOptions[0]?.textContent?.trim() ?? '')).toBe(`${CLASS_NAME} · ${UDA_TITLE}`);
    await assertSelectedClassStillVisible(page);
    await assertNoAutomaticMutation(page);
    await page.screenshot({ path: evidencePath('flow-03-desktop-evaluation.png'), fullPage: true });
  });

  test('Registra → Comportamento opens the existing surface without FLOW-03 mutation', async ({ page }) => {
    await setupClassAndUda(page, 'flow-03-behaviour');
    const record = await openDirectRecord(page);
    await record.getByRole('button', { name: 'Comportamento', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Valutazione Rapida Comportamenti', exact: true })).toBeVisible();
    await expect(page.getByText('Nessun alunno presente in questa classe.', { exact: true })).toBeVisible();
    await assertNoAutomaticMutation(page);
    await page.screenshot({ path: evidencePath('flow-03-desktop-behaviour.png'), fullPage: true });
  });

  test('Registra → Esiti verifica online opens the authoritative tool without auto-import', async ({ page }) => {
    await setupClassAndUda(page, 'flow-03-online');
    const record = await openDirectRecord(page);
    await record.getByRole('button', { name: 'Esiti verifica online', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verifiche sulle Lezioni & Flashcards Formative' })).toBeVisible();
    await assertNoAutomaticMutation(page);
    await page.screenshot({ path: evidencePath('flow-03-desktop-online-outcomes.png'), fullPage: true });
  });
});

test.describe('FLOW-03 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Conduci → Registra → diario UDA completes only after durable save and then offers Rivedi', async ({ page }) => {
    await setupClassAndUda(page, 'flow-03-mobile');
    const record = await openConductToRecord(page);

    await assertNoHorizontalOverflow(page);
    await assertCriticalControlsTouchSafe(record);
    await assertStagedNoteTextareaUnobscured(page, record);
    await assertNoAutomaticMutation(page);
    await page.screenshot({ path: evidencePath('flow-03-mobile-record.png'), fullPage: true });

    const staged = record.getByLabel('Nota di sessione', { exact: true });
    await staged.fill(`${RAPID_NOTE} Confermata dal docente.`);
    await expect(staged).toHaveValue(`${RAPID_NOTE} Confermata dal docente.`);

    await record.getByRole('button', { name: 'Attività / nota UDA', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pianificazione UDA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true })).toBeVisible();

    const topicInput = page.getByPlaceholder('Argomento o fase operativa svolta...');
    const notes = page.getByPlaceholder('Note professionali opzionali sulla lezione...');
    await expect(topicInput).toHaveValue(UDA_TITLE);
    await expect(notes).toHaveValue(`${RAPID_NOTE} Confermata dal docente.`);
    await topicInput.fill(LESSON_TOPIC);
    await page.screenshot({ path: evidencePath('flow-03-mobile-uda-prefill.png'), fullPage: true });

    const form = topicInput.locator('xpath=ancestor::form');
    await form.locator('select').selectOption('teoria');
    await form.locator('button[type="submit"]').click();

    const saved = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
    await expect(saved).toBeVisible();
    await expect(saved).toContainText('Registrazione completata');
    await expect(saved.getByRole('button', { name: 'Rivedi', exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-03-mobile-uda-saved.png'), fullPage: true });

    await saved.getByRole('button', { name: 'Rivedi', exact: true }).click();
    const review = page.getByRole('region', { name: 'Continua: Rivedi' });
    await expect(review).toBeVisible();
    await assertSelectedClassStillVisible(page);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-03-mobile-review.png'), fullPage: true });
  });
});
`;
writeFileSync(browserSpecPath, browserSpec);

const workflowPath = '.github/workflows/browser-qualification.yml';
let workflow = readFileSync(workflowPath, 'utf8');
workflow = replaceOnce(
  workflow,
  '          cp tests/browser/flow-02-conduci.spec.cjs .browser-tools/flow-02-conduci.spec.cjs\n',
  '          cp tests/browser/flow-02-conduci.spec.cjs .browser-tools/flow-02-conduci.spec.cjs\n          cp tests/browser/flow-03-registra.spec.cjs .browser-tools/flow-03-registra.spec.cjs\n',
  'browser-copy-flow03'
);
const flow02Step = `      - name: Run FLOW-02 Chromium qualification\n        shell: bash\n        run: |\n          set -euo pipefail\n          cd .browser-tools\n          BASE_URL="http://127.0.0.1:\${PORT}" \\\n          EVIDENCE_DIR="../browser-evidence" \\\n          CANDIDATE_SHA="\${CANDIDATE_SHA}" \\\n          ./node_modules/.bin/playwright test \\\n            flow-02-conduci.spec.cjs \\\n            --workers=1 \\\n            --reporter=line \\\n            --output=../browser-evidence/flow-02-test-results\n`;
const flow03Step = `\n      - name: Run FLOW-03 Chromium qualification\n        shell: bash\n        run: |\n          set -euo pipefail\n          cd .browser-tools\n          BASE_URL="http://127.0.0.1:\${PORT}" \\\n          EVIDENCE_DIR="../browser-evidence" \\\n          CANDIDATE_SHA="\${CANDIDATE_SHA}" \\\n          ./node_modules/.bin/playwright test \\\n            flow-03-registra.spec.cjs \\\n            --workers=1 \\\n            --reporter=line \\\n            --output=../browser-evidence/flow-03-test-results\n`;
workflow = replaceOnce(workflow, flow02Step, flow02Step + flow03Step, 'browser-flow03-step');
writeFileSync(workflowPath, workflow);

const registryPath = 'qualification/invariants.v1.json';
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
if (registry.invariants.some(entry => entry.id === 'FLOW-03-I01')) throw new Error('INVARIANT_ALREADY_EXISTS:FLOW-03-I01');
registry.invariants.push({
  id: 'FLOW-03-I01',
  owner: 'FLOW-03',
  statement: 'Registra is a session-only recording orchestrator: it preserves explicit professional context, carries staged lesson evidence without auto-writing it, delegates all durable writes to authoritative specialist surfaces, preserves drafts on failure, and offers Rivedi only after a matching successful durable mutation.',
  impactPaths: [
    'qualification/invariants.v1.json',
    'src/App.tsx',
    'src/recording/',
    'src/components/RecordLessonPanel.tsx',
    'src/components/ConductLessonPanel.tsx',
    'src/components/DashboardView.tsx',
    'src/components/EvaluationsView.tsx',
    'src/components/UdaWorkspaceView.tsx',
    'src/components/UdaGanttView.tsx',
    'src/today/todayRouter.ts',
    'src/security/flow03RecordSessionContract.test.ts',
    'src/security/flow03ConductHandoffContract.test.ts',
    'src/security/flow03RecordUiContract.test.ts',
    'src/security/flow03AppIntegrationContract.test.ts',
    'src/security/flow03EvaluationPrefillContract.test.ts',
    'src/security/flow03UdaDiaryHandoffContract.test.ts',
    'src/security/flow03BrowserQualificationContract.test.ts',
    'src/security/flow03QualificationContract.test.ts',
    'tests/browser/flow-02-conduci.spec.cjs',
    'tests/browser/flow-03-registra.spec.cjs',
    '.github/workflows/browser-qualification.yml'
  ],
  tests: [
    'src/security/flow03RecordSessionContract.test.ts',
    'src/security/flow03ConductHandoffContract.test.ts',
    'src/security/flow03RecordUiContract.test.ts',
    'src/security/flow03AppIntegrationContract.test.ts',
    'src/security/flow03EvaluationPrefillContract.test.ts',
    'src/security/flow03UdaDiaryHandoffContract.test.ts',
    'src/security/flow03BrowserQualificationContract.test.ts',
    'src/security/flow03QualificationContract.test.ts'
  ],
  browserSmoke: [
    'tests/browser/qualification-invariant-smoke.spec.cjs',
    'tests/browser/flow-03-registra.spec.cjs'
  ]
});
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

console.log('FLOW-03 Task 7 qualification patch applied');
