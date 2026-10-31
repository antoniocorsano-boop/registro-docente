const { expect } = require('@playwright/test');

const TEACHER_FIRST_GOAL_LABELS = Object.freeze({
  prepare: 'Preparare un’attività',
  review: 'Rivedere qualcosa',
  link: 'Collegare a una UDA',
  material: 'Lavorare su un materiale'
});

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

async function expectDirectCopilotLaunch(composer, { intent, contextText, sourceCard } = {}) {
  await expect(composer).toBeVisible();
  await expect(composer.getByTestId('teacher-first-copilot-entry')).toHaveCount(0);
  await expect(composer.getByTestId('teacher-first-existing-bindings')).toHaveCount(0);
  await expect(composer.getByLabel('Fonte della Biblioteca')).toHaveCount(0);
  await expect(composer.getByLabel('Che cosa vuoi farne?')).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Mostra le possibilità', exact: true })).toHaveCount(0);
  if (!sourceCard) throw new Error('La verifica del lancio diretto richiede la card sorgente.');
  const sourceId = await sourceCard.getAttribute('data-source-id');
  expect(sourceId, 'source id della card').toBeTruthy();
  await expect(composer).toHaveAttribute('data-source-id', sourceId);
  if (contextText) await expect(composer).toContainText(contextText);

  if (intent === 'prepare') {
    await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  } else if (intent === 'review') {
    await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  } else if (intent === 'link') {
    await expect(composer.getByTestId('library-copilot-link-action')).toBeVisible();
  } else {
    throw new Error(`Intent diretto non supportato nel test: ${intent}`);
  }
  return composer;
}

async function configureNeutralCopilotContext(composer, {
  goal = 'review',
  className,
  udaTitle,
  lessonTopic = null,
  sourceTitle
}) {
  const goalLabel = TEACHER_FIRST_GOAL_LABELS[goal];
  if (!goalLabel) throw new Error(`Obiettivo teacher-first non supportato nel test: ${goal}`);
  await composer.getByRole('button', { name: goalLabel, exact: true }).click();

  if (className) {
    const classChoice = composer.getByTestId('teacher-first-class-choice');
    await expect(classChoice).toBeVisible();
    await classChoice.getByRole('button', { name: className, exact: true }).click();
  }

  if (udaTitle || lessonTopic) {
    const contextSelect = composer.getByTestId('library-copilot-context-select');
    await expect(contextSelect).toBeVisible();
    const options = await contextSelect.locator('option').evaluateAll(nodes => nodes.map(node => ({
      value: node.value,
      text: node.textContent || ''
    })));
    const target = options.find(option => option.value
      && (!className || option.text.includes(className))
      && (lessonTopic ? option.text.includes(lessonTopic) : option.text.includes(udaTitle)));
    expect(target, `Contesto Copilota non trovato: ${className || ''} · ${udaTitle || ''}${lessonTopic ? ` · ${lessonTopic}` : ''}`).toBeTruthy();
    await contextSelect.selectOption(target.value);
    await expect(contextSelect.locator('option:checked')).toContainText(lessonTopic || udaTitle);
  }

  if (sourceTitle) {
    const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
    await expect(sourceSelect).toBeVisible();
    await sourceSelect.selectOption({ label: sourceTitle });
    await expect(sourceSelect.locator('option:checked')).toHaveText(sourceTitle);
  }

  await expect(composer.getByLabel('Che cosa vuoi farne?')).toBeVisible();
  return composer;
}

module.exports = {
  revealMaterialSourceSelect,
  expectExistingCopilotBindings,
  expectDirectCopilotLaunch,
  configureNeutralCopilotContext
};
