const { expect } = require('@playwright/test');

// Use the one visible navigation trigger: the mobile brand or desktop Menu.
function navigationButton(page) {
  return page.getByTestId('header01-brand-navigation')
    .or(page.getByRole('button', { name: 'Menu', exact: true }))
    .filter({ visible: true });
}

// Privacy Shield remains the same operation after the mobile header redesign.
function privacyButton(page) {
  return page.getByTestId('header01-privacy')
    .or(page.locator('button[title^="Privacy Shield"]'))
    .filter({ visible: true }).first();
}

// An explicit Oggi action may require confirmation on mobile; never bypass it.
async function settleOggiNavigation(page) {
  const confirmation = page.getByTestId('header01-home-confirm');
  if (await confirmation.isVisible()) {
    await expect(confirmation.getByRole('alertdialog')).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Rimani qui', exact: true })).toBeVisible();
    await confirmation.getByRole('button', { name: 'Torna a Oggi', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
  }
}

// Move focus out of a native select before testing the drawer's Escape shortcut.
async function closeMobileDrawerWithEscape(page) {
  const first = page.getByTestId('header01-go-home');
  await expect(first).toBeVisible();
  await first.focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('header01-auto-lock')).toBeHidden();
}

module.exports = { navigationButton, privacyButton, settleOggiNavigation, closeMobileDrawerWithEscape };
