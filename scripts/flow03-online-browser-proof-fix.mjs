import fs from 'node:fs';

const path = 'tests/browser/flow-03-registra.spec.cjs';
let source = fs.readFileSync(path, 'utf8');
const needle = `async function openOnlineOutcomesFromRecord(page, record) {\n  await record.getByRole('button', { name: 'Esiti verifica online', exact: true }).click();\n  await expect(page.getByRole('button', { name: 'Importa Voti nel Registro', exact: true })).toBeVisible();\n  const classSelect = page.getByLabel('Classe Destinataria', { exact: true });\n  await expect(classSelect).toHaveValue(CLASS_NAME);\n  await assertSelectedClassStillVisible(page);\n  await assertNoAutomaticMutation(page);\n}`;
const replacement = `async function openOnlineOutcomesFromRecord(page, record) {\n  await record.getByRole('button', { name: 'Esiti verifica online', exact: true }).click();\n  await expect(page.getByRole('button', { name: 'Importa Voti nel Registro', exact: true })).toBeVisible();\n  await assertSelectedClassStillVisible(page);\n  await assertNoAutomaticMutation(page);\n\n  await page.getByRole('button', { name: /Condivisione Padlet/ }).click();\n  const classSelect = page.getByLabel('Classe Destinataria', { exact: true });\n  await expect(classSelect).toHaveValue(CLASS_NAME);\n  await assertNoAutomaticMutation(page);\n}`;
const first = source.indexOf(needle);
if (first < 0) throw new Error('PATCH_MARKER_MISSING:online-browser-proof');
if (source.indexOf(needle, first + needle.length) >= 0) throw new Error('PATCH_MARKER_AMBIGUOUS:online-browser-proof');
source = source.slice(0, first) + replacement + source.slice(first + needle.length);
fs.writeFileSync(path, source);
console.log('FLOW-03 online browser proof fixed');
