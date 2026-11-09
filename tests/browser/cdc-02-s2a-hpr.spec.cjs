const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { navigationButton } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({ viewport: { width: 360, height: 780 }, trace: 'retain-on-failure' });
test.setTimeout(90000);

async function navigate(page, name) {
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button', { name, exact: true }).click();
}

test('CDC-02/S2a HPR: snapshot-free live overview distinguishes numeric evidence, unsaved drafts and saved teacher votes', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#vault-password').fill('cdc02-s2a-only-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  // Synthetic legacy fixture only. No real identity or grades leave the local browser.
  const legacy = {
    app: 'registro-docente', version: 2,
    settings: { school: 'Istituto sintetico', year: '2026/27',
      teacher: 'Docente sintetico', subject: 'Tecnologia', theme: 'cyan' },
    classes: [{
      id: 'cdc02-s2a-class', name: '2Z Quadro sintetico',
      students: [
        { id: 'synthetic-a', name: 'Alfa Uno' },
        { id: 'synthetic-b', name: 'Beta Due' },
        { id: 'synthetic-c', name: 'Gamma Tre' },
        { id: 'synthetic-d', name: 'Delta Quattro' }
      ],
      grades: [
        { id: 's2a-g1', studentId: 'synthetic-a', date: '2026-10-10',
          type: 'test', period: 'Q1', title: 'Prova sintetica', value: '8' },
        { id: 's2a-g2', studentId: 'synthetic-a', date: '2026-11-20',
          type: 'orale', period: 'Q1', title: 'Prova oltre limite', value: '6' },
        { id: 's2a-g3', studentId: 'synthetic-b', date: '2026-10-10',
          type: 'test', period: 'Q1', title: 'Prova non numerica', value: 'NC' }
      ],
      behaviors: []
    }]
  };
  page.on('dialog', dialog => dialog.accept());
  await navigate(page, 'Privacy');
  await page.locator('input[type=file]').setInputFiles({
    name: 'cdc02-s2a-solo-sintetici.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy))
  });
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: '2Z Quadro sintetico' });
  const cutoff = page.getByRole('textbox', { name: 'Data limite delle prove' })
    .or(page.getByLabel('Data limite delle prove'));
  await cutoff.fill('2026-11-09');
  const overview = page.getByRole('region', { name: 'Quadro sintetico delle evidenze della classe' });
  await expect(overview).toBeVisible();
  await expect(overview).toContainText('Dati correnti');
  await expect(overview).toContainText('non sono una fotografia storica della seduta');
  const expected = async (values) => {
    const labels = ['Alunni', 'Con prove numeriche', 'Senza prove numeriche',
      'Prove numeriche totali', 'Con voto di ingresso salvato', 'Senza voto di ingresso salvato'];
    for (let i = 0; i < labels.length; i++) {
      await expect(overview.getByText(labels[i], { exact: true }).locator('..')
        .getByText(String(values[i]), { exact: true })).toBeVisible();
    }
  };

  const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence', 'cdc02-s2a-human-review');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const shots = [];
  async function capture(name, target, options = {}) {
    const filename = path.join(evidenceDir, name);
    await target.screenshot({ path: filename, animations: 'disabled', ...options });
    const bytes = fs.readFileSync(filename);
    shots.push({ name, bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }

  await expected([4, 1, 3, 1, 0, 4]);
  await capture('01-quadro-iniziale-prove-senza-voti.png', overview);
  const grades = page.getByRole('region', { name: 'Tabellone delle valutazioni di ingresso' })
    .locator('input[aria-label^="Voto di ingresso per"]');
  await expect(grades).toHaveCount(4);
  await grades.nth(0).fill('7');
  await grades.nth(1).fill('6');
  await expected([4, 1, 3, 1, 0, 4]);
  await capture('02-bozze-non-salvate-non-contate.png', overview);

  await page.getByRole('button', { name: 'Salva valutazioni di ingresso' }).click();
  await expect(page.getByRole('status')
    .filter({ hasText: 'Valutazioni di ingresso salvate nell’archivio' })).toBeVisible();
  await expected([4, 1, 3, 1, 2, 2]);
  await capture('03-due-voti-salvati.png', overview);
  await capture('04-schermata-completa-mobile.png', page, { fullPage: true });

  await cutoff.fill('2026-09-30');
  await expected([4, 0, 4, 0, 2, 2]);
  await capture('05-cambio-limite-prove-senza-cambiare-voti.png', overview);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);

  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify({
    contract: 'CDC-02-S2A-HPR-EVIDENCE-v1',
    applicationTreeSourceCommit: 'ae38c8e85967fdb4e15d1eb268c67226b66e6a75',
    captureCommit: process.env.CANDIDATE_SHA || 'LOCAL_DIAGNOSTIC',
    viewport: { width: 360, height: 780 },
    dataClassification: 'synthetic-only',
    authority: 'live-read-only-overview-not-council-deliberation-or-historical-snapshot',
    humanAcceptance: 'PENDING',
    screenshots: shots
  }, null, 2) + '\n');
});
