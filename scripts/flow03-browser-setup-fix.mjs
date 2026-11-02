import fs from 'node:fs';

const path = 'tests/browser/flow-03-registra.spec.cjs';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`PATCH_MARKER_MISSING:${label}`);
  const second = source.indexOf(needle, first + needle.length);
  if (second >= 0) throw new Error(`PATCH_MARKER_AMBIGUOUS:${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
  "  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();\n  await closePersistenceConfirmation(page);\n\n  const studentInput",
  "  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();\n  await closePersistenceConfirmationIfPresent(page);\n\n  const studentInput",
  'class-confirmation'
);

replaceOnce(
  "  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();\n  await closePersistenceConfirmation(page);\n  await expect(studentInput).toHaveValue('');",
  "  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();\n  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();\n  await closePersistenceConfirmationIfPresent(page);\n  await expect(studentInput).toHaveValue('');",
  'student-confirmation'
);

replaceOnce(
  "  await dialog.getByRole('button', { name: 'Crea UDA', exact: true }).click();\n  await closePersistenceConfirmation(page);\n  await expect(page.getByRole('status')).toContainText(`Nuova UDA \"${UDA_TITLE}\" creata con successo`);",
  "  await dialog.getByRole('button', { name: 'Crea UDA', exact: true }).click();\n  await closePersistenceConfirmationIfPresent(page);\n  await expect(page.getByRole('status')).toContainText(`Nuova UDA \"${UDA_TITLE}\" creata con successo`);",
  'uda-confirmation'
);

fs.writeFileSync(path, source);
console.log('FLOW-03 browser setup fix applied');
