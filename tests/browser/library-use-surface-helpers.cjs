const { expect } = require('@playwright/test');

const LIBRARY_USE_ACTION_LABELS = Object.freeze({
  prepare: 'Prepara un’attività',
  review: 'Rivedi nel contesto',
  link: 'Collega alla UDA'
});

const PROFESSIONAL_CLASSIFICATION_LABEL = 'Classifica come materiale professionale';
const ORIGINAL_CONFIRM_SLOT = '__registroLibraryUseOriginalConfirm';

async function ensureLibraryOtherActionsOpen(card) {
  const disclosure = card.getByTestId('library-source-other-actions');
  if (!(await disclosure.isVisible().catch(() => false))) return;
  if (!(await disclosure.evaluate(element => element.open))) {
    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
  }
}

async function selectLibraryUseTarget(card, { udaTitle, lessonTopic = null }) {
  // Source-first assessment is primary. Historical UDA/lesson actions remain
  // under an explicit disclosure, including on subsequent Copilota returns.
  await ensureLibraryOtherActionsOpen(card);
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

async function completeProfessionalClassificationIfRequired(card) {
  const gate = card.getByTestId('library-professional-classification-gate');
  if (!(await gate.isVisible().catch(() => false))) return;

  const composerCount = await card.evaluate(() => document.querySelectorAll('[data-testid="library-copilot-composer"]').length);
  expect(composerCount, 'Copilota non deve aprirsi prima della classificazione professionale').toBe(0);

  await card.evaluate(slot => {
    window[slot] = window.confirm;
    window.confirm = () => true;
  }, ORIGINAL_CONFIRM_SLOT);

  try {
    await gate.getByRole('button', { name: PROFESSIONAL_CLASSIFICATION_LABEL, exact: true }).click();
    await expect(gate).toBeHidden();
  } finally {
    await card.evaluate(slot => {
      const originalConfirm = window[slot];
      if (typeof originalConfirm === 'function') window.confirm = originalConfirm;
      delete window[slot];
    }, ORIGINAL_CONFIRM_SLOT);
  }
}

function libraryUseAction(card, intent, { autoClassify = true } = {}) {
  const label = LIBRARY_USE_ACTION_LABELS[intent];
  if (!label) throw new Error(`Intent Biblioteca non supportato nel test: ${intent}`);
  const action = card.getByRole('button', { name: label, exact: true });
  if (!autoClassify) return action;

  return new Proxy(action, {
    get(target, property) {
      if (property === 'click') {
        return async (...args) => {
          await ensureLibraryOtherActionsOpen(card);
          await target.click(...args);
          await completeProfessionalClassificationIfRequired(card);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

module.exports = {
  LIBRARY_USE_ACTION_LABELS,
  ensureLibraryOtherActionsOpen,
  selectLibraryUseTarget,
  completeProfessionalClassificationIfRequired,
  libraryUseAction
};
