const { test, expect } = require('@playwright/test');
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const upload = {
  name: 'classe.csv', mimeType: 'text/csv',
  buffer: Buffer.from('Cognome e Nome\nAlfa Ada\nalfa ada\nSERRA LIA\n'),
};

async function openFixture(page, reject = false) {
  await page.route('**/r106-fixture*', async route => {
    const response = await route.fetch({ url: base + '/' });
    const html = await response.text();
    await route.fulfill({ response, body: html.replace('/src/main.tsx', '/tests/browser/fixtures/r106-student-import.fixture.tsx') });
  });
  await page.goto(base + '/r106-fixture' + (reject ? '?reject' : ''));
}

async function chooseFile(page, accept) {
  const messages = [];
  page.on('dialog', async dialog => {
    messages.push(dialog.message());
    if (dialog.type() === 'confirm' && !accept) await dialog.dismiss();
    else await dialog.accept();
  });
  await page.locator('input[type=file]').setInputFiles(upload);
  await expect.poll(() => messages[0]).toMatch(/1 nuovo nominativo.*Classe sintetica/);
  await expect(page.locator('input[type=file]')).toBeEnabled();
  return messages;
}

test('annullare la conferma non tenta il salvataggio', async ({ page }) => {
  await openFixture(page);
  const messages = await chooseFile(page, false);
  await expect(page.getByLabel('Tentativi di salvataggio')).toHaveText('0');
  await expect(page.getByText('Alfa Ada', { exact: true })).toHaveCount(0);
  expect(messages).toHaveLength(1);
});

test('il rifiuto del commit non aggiunge alunni e non annuncia un successo', async ({ page }) => {
  await openFixture(page, true);
  const messages = await chooseFile(page, true);
  await expect(page.getByLabel('Tentativi di salvataggio')).toHaveText('1');
  await expect(page.getByText('Alfa Ada', { exact: true })).toHaveCount(0);
  expect(messages).toHaveLength(2);
  expect(messages[1]).toMatch(/non salvata/);
});

test('la conferma importa una sola volta ed esclude i nominativi già presenti', async ({ page }) => {
  await openFixture(page);
  const messages = await chooseFile(page, true);
  await expect(page.getByLabel('Tentativi di salvataggio')).toHaveText('1');
  await expect(page.getByText('Alfa Ada', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Serra Lia', { exact: true })).toHaveCount(1);
  expect(messages[1]).toMatch(/Aggiunti 1/);
});
