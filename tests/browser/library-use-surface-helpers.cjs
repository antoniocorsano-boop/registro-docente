const { expect } = require('@playwright/test');

const LIBRARY_USE_ACTION_LABELS = Object.freeze({
  prepare: 'Prepara un’attività',
  review: 'Rivedi nel contesto',
  link: 'Collega alla UDA'
});

async function selectLibraryUseTarget(card, { udaTitle, lessonTopic = null }) {
  const changeContext = card.getByRole('button', { name: 'Cambia', exact: true });
  if (await changeContext.isVisible().catch(() => false)) await changeContext.click();

  const targetSelect = card.getByLabel('Dove vuoi usarlo?');
  await expect(targetSelect).toBeVisible();
  const options = await targetSelect.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: node.value,
    text: node.textContent || ''
  })));
  const target = options.find(option => option.value
    && option.text.includes(udaTitle)
    && (lessonTopic ? option.text.includes(lessonTopic) : option.text.includes('Intera UDA')));
  expect(target, `Target didattico non trovato: ${udaTitle}${lessonTopic ? ` · ${lessonTopic}` : ''}`).toBeTruthy();
  await targetSelect.selectOption(target.value);
  await expect(targetSelect.locator('option:checked')).toContainText(lessonTopic || udaTitle);
  return targetSelect;
}

function libraryUseAction(card, intent) {
  const label = LIBRARY_USE_ACTION_LABELS[intent];
  if (!label) throw new Error(`Intent Biblioteca non supportato nel test: ${intent}`);
  return card.getByRole('button', { name: label, exact: true });
}

module.exports = {
  LIBRARY_USE_ACTION_LABELS,
  selectLibraryUseTarget,
  libraryUseAction
};
