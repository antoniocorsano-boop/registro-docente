const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2Z CDC-01 sintetica';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function navigate(page, name) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  await drawer.getByRole('button', { name, exact: true }).click();
}

test('CDC-01: teacher explicitly chooses class and saves an independent entrance grade', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('cdc-01-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill('Alfa Uno');
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();

  await navigate(page, 'Consigli di classe');
  await expect(page.getByRole('heading', { name: 'Consigli di classe', exact: true })).toBeVisible();
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await expect(picker).toHaveValue('');
  await picker.selectOption({ label: CLASS_NAME });
  const grade = page.locator('input[aria-label^="Voto di ingresso per"]');
  await expect(grade).toHaveCount(1);
  await expect(grade).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salva valutazioni di ingresso' })).toBeDisabled();

  await grade.fill('8,5');
  await expect(page.getByText('Modifiche non ancora salvate.')).toBeVisible();
  await navigate(page, 'Oggi');
  const guard = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Rimani nei Consigli' }).click();
  await expect(grade).toHaveValue('8,5');

  await page.getByRole('button', { name: 'Salva valutazioni di ingresso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Valutazioni di ingresso salvate nell’archivio' })).toBeVisible();
  await expect(page.getByText('Con voto')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Riepilogo delle fasce di ingresso' })).toContainText('Alta · 8,5–10');

  await navigate(page, 'Oggi');
  const confirmation = page.getByRole('alertdialog').filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Torna a Oggi' }).click();
  }
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: CLASS_NAME });
  await expect(grade).toHaveValue('8.5');
});


test('CDC-01: legacy JSON import, council decision, encrypted export and restore', async ({ page }) => {
  const fs = require('node:fs');
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#vault-password').fill('cdc-01-import-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();

  const legacy = {
    app: 'registro-docente', version: 2,
    settings: { school: 'Istituto sintetico', year: '2026/27', teacher: 'Docente',
      subject: 'Tecnologia', theme: 'cyan' },
    classes: [{
      id: 'legacy-c', name: '2C Legacy',
      students: [{ id: 'legacy-student', name: 'Alfa Uno' }],
      grades: [{ id: 'legacy-grade', studentId: 'legacy-student', date: '2026-10-10',
        type: 'test', period: 'Q1', title: 'Prova ingresso', value: '8.5' }],
      behaviors: []
    }]
  };

  await navigate(page, 'Privacy');
  await page.locator('input[type=file]').setInputFiles({
    name: 'legacy-sintetico.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy))
  });
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: '2C Legacy' });
  const row = page.getByRole('row', { name: /Alfa Uno/ });
  // In privacy mode the name is masked; the average and vote input remain class-scoped.
  await expect(page.getByRole('cell', { name: '8,5', exact: true })).toBeVisible();
  const vote = page.locator('input[aria-label^="Voto di ingresso per"]');
  await vote.fill('7');
  await page.getByRole('button', { name: 'Salva valutazioni di ingresso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Valutazioni di ingresso salvate nell’archivio' })).toBeVisible();

  await navigate(page, 'Privacy');
  await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill('Backup!2026');
  await page.getByPlaceholder('Ripeti la password').fill('Backup!2026');
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Cifra e Scarica File' }).click();
  const download = await downloadReady;
  const savedPath = await download.path();
  const encryptedBuffer = fs.readFileSync(savedPath);
  const encrypted = JSON.parse(encryptedBuffer.toString('utf8'));
  expect(encrypted.privacy_protocol).toBe('REGISTRO_DOCENTE_AES_GCM_256');
  expect(encrypted.ciphertext).toBeTruthy();
  expect(encryptedBuffer.toString('utf8')).not.toContain('legacy-student');

  await page.locator('input[type=file]').setInputFiles({
    name: 'nuovo-archivio.enc.json', mimeType: 'application/json', buffer: encryptedBuffer
  });
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill('Backup!2026');
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: '2C Legacy' });
  await expect(vote).toHaveValue('7');
  await expect(page.getByRole('cell', { name: '8,5', exact: true })).toBeVisible();
});
