const { expect } = require('@playwright/test');

async function revealMaterialSourceSelect(composer) {
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  const materialStart = composer.getByRole('button', { name: 'Lavorare su un materiale', exact: true });
  if (await materialStart.isVisible().catch(() => false)) {
    await materialStart.click();
  } else {
    await expect(sourceSelect).toBeVisible();
  }
  await expect(composer.getByTestId('teacher-first-material-step')).toBeVisible();
  await expect(sourceSelect).toBeVisible();
  return sourceSelect;
}

async function expectExistingCopilotBindings(composer, { sourceTitle, contextText } = {}) {
  const bindings = composer.getByTestId('teacher-first-existing-bindings');
  await expect(bindings).toBeVisible();
  if (sourceTitle) await expect(bindings).toContainText(sourceTitle);
  if (contextText) await expect(bindings).toContainText(contextText);
  await expect(composer.getByLabel('Fonte della Biblioteca')).toHaveCount(0);
  return bindings;
}

module.exports = { revealMaterialSourceSelect, expectExistingCopilotBindings };
