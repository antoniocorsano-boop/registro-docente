from pathlib import Path

files = [
    Path('tests/browser/today-01-home-oggi-router.spec.cjs'),
    Path('tests/browser/flow-01-prepara.spec.cjs'),
    Path('tests/browser/flow-02-conduci.spec.cjs'),
]

old = """async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}
"""
new = """async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
}
"""

for path in files:
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: helper anchor count={text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
