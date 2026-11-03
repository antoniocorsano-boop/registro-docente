from pathlib import Path

path = Path('tests/browser/flow-03-registra.spec.cjs')
text = path.read_text(encoding='utf-8')

# Add a focused desktop FLOW-03B post-record journey using the existing qualified helpers.
anchor = """});
});

test.describe('FLOW-03 direct Registra manual UDA qualification', () => {
"""
block = """});
});

test.describe('FLOW-03B desktop post-record UX qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps backup maintenance quiet and contextualizes Rivedi after an evaluation save', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await prepareScenario(page, 'flow-03b-desktop-review');

    const conduct = await openConductFromOggi(page);
    const record = await handoffConductToRecord(page, conduct);
    const overview = page.locator('[data-testid="flow03b-class-overview"]');
    const floatingCopilot = page.locator('[data-testid="library-copilot-trigger"]');
    await expect(overview).toHaveJSProperty('open', false);
    await expect(floatingCopilot).toBeHidden();
    await expect(record.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();

    const mission = await openEvaluationFromRecord(page, record);
    await expect(mission.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();
    await expect(floatingCopilot).toBeHidden();

    await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Valutazione FLOW-03B');
    await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
    await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();

    const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
    await expect(savedRecord).toContainText('Registrazione completata');
    await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
    await expect(overview).toHaveJSProperty('open', true);
    await expect(floatingCopilot).toBeVisible();

    await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();
    const review = page.getByRole('region', { name: 'Continua: Rivedi' });
    await expect(review).toContainText('Prima destinazione consigliata: Tabellone.');
    const labels = (await review.locator('button').allTextContents())
      .map(label => label.trim())
      .filter(label => ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno'].includes(label));
    expect(labels).toEqual(['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']);
    await page.screenshot({ path: evidencePath('flow-03b-desktop-review.png'), fullPage: true });
    expect(pageErrors).toEqual([]);
  });
});

test.describe('FLOW-03 direct Registra manual UDA qualification', () => {
"""
if text.count(anchor) != 1:
    raise SystemExit(f'desktop insertion anchor count={text.count(anchor)}')
text = text.replace(anchor, block, 1)

mobile_marker = "test.describe('FLOW-03 mobile qualification', () => {"
if text.count(mobile_marker) != 1:
    raise SystemExit(f'mobile describe marker count={text.count(mobile_marker)}')
prefix, mobile = text.split(mobile_marker, 1)

# Strengthen the existing primary mobile journey at the moment Registra becomes active.
anchor = """  const record = await handoffConductToRecord(page, conduct);
  await assertSelectedClassStillVisible(page);
  await assertNoHorizontalOverflow(page);
"""
replacement = """  const record = await handoffConductToRecord(page, conduct);
  const flow03bOverview = page.locator('[data-testid="flow03b-class-overview"]');
  const flow03bFloatingCopilot = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(flow03bOverview).toHaveJSProperty('open', false);
  await expect(flow03bFloatingCopilot).toBeHidden();
  const flow03bInlineCopilot = record.getByRole('button', { name: 'Copilota', exact: true });
  await expect(flow03bInlineCopilot).toBeVisible();
  const flow03bInlineCopilotBox = await flow03bInlineCopilot.boundingBox();
  expect(flow03bInlineCopilotBox).not.toBeNull();
  expect(flow03bInlineCopilotBox.height).toBeGreaterThanOrEqual(44);
  await assertSelectedClassStillVisible(page);
  await assertNoHorizontalOverflow(page);
"""
if mobile.count(anchor) != 1:
    raise SystemExit(f'mobile active anchor count={mobile.count(anchor)}')
mobile = mobile.replace(anchor, replacement, 1)

# Verify specialist mission keeps Copilota inline and floating trigger absent.
anchor = """  const mission = await assertRecordMission(page, 'Attività / nota UDA');
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();
"""
replacement = """  const mission = await assertRecordMission(page, 'Attività / nota UDA');
  await expect(mission.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();
  await expect(flow03bFloatingCopilot).toBeHidden();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();
"""
if mobile.count(anchor) != 1:
    raise SystemExit(f'mobile mission anchor count={mobile.count(anchor)}')
mobile = mobile.replace(anchor, replacement, 1)

# Once saved, the active-task focus must end and the ambient UI must return.
anchor = """  await expect(savedRecord).toContainText('Registrazione completata');
  await expect(savedRecord.getByRole('button', { name: 'Rivedi', exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
"""
replacement = """  await expect(savedRecord).toContainText('Registrazione completata');
  await expect(savedRecord.getByRole('button', { name: 'Rivedi', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
  await expect(flow03bOverview).toHaveJSProperty('open', true);
  await expect(flow03bFloatingCopilot).toBeVisible();
  await assertNoHorizontalOverflow(page);
"""
if mobile.count(anchor) != 1:
    raise SystemExit(f'mobile saved anchor count={mobile.count(anchor)}')
mobile = mobile.replace(anchor, replacement, 1)

# Lesson-log review should prioritize UDA context, without automatic navigation.
anchor = """  const review = page.getByRole('region', { name: 'Continua: Rivedi' });
  await expect(review).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-mobile-review.png'), fullPage: true });
"""
replacement = """  const review = page.getByRole('region', { name: 'Continua: Rivedi' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Prima destinazione consigliata: UDA e diario.');
  const flow03bReviewLabels = (await review.locator('button').allTextContents())
    .map(label => label.trim())
    .filter(label => ['UDA e diario', 'Tabellone', 'Analisi', 'Storico'].includes(label));
  expect(flow03bReviewLabels).toEqual(['UDA e diario', 'Tabellone', 'Analisi', 'Storico']);
  await page.screenshot({ path: evidencePath('flow-03-mobile-review.png'), fullPage: true });
"""
if mobile.count(anchor) != 1:
    raise SystemExit(f'mobile review anchor count={mobile.count(anchor)}')
mobile = mobile.replace(anchor, replacement, 1)

text = prefix + mobile_marker + mobile
path.write_text(text, encoding='utf-8')

# The dedicated temporary browser surfaces are no longer needed: coverage lives in the canonical FLOW-03 spec.
for obsolete in [
    Path('tests/browser/flow-03b-post-record-ux.spec.cjs'),
    Path('src/security/flow03bBrowserQualificationContract.test.ts'),
    Path('scripts/flow03b-browser-wire.py')
]:
    if obsolete.exists():
        obsolete.unlink()
