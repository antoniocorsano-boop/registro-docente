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
  const drawer = page.locator('#registro-navigation-drawer');
  const brand = page.getByTestId('header01-brand-navigation');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return bounds ? bounds.x + bounds.width : 0;
  }).toBeLessThanOrEqual(1);
}

// Shared browser-laboratory gate. DOMContentLoaded is not evidence that the
// encrypted Vault has finished opening. Never click through a protected UI.
async function awaitVaultWorkspace(page, vaultPassword, {
  requireHome = false, requireUnlock = false, timeout = 30000
} = {}) {
  const lockedHeading = page.getByRole('heading', { name: 'Sblocca Registro', exact: true });
  const homeHeading = page.getByRole('heading', { name: 'Le mie classi', exact: true });
  const readyNavigation = navigationButton(page).first();
  const state = async () => {
    if (await lockedHeading.isVisible()) return 'locked';
    if (await readyNavigation.isVisible() && await readyNavigation.evaluate(element =>
      !element.closest('[inert], [aria-hidden="true"]') &&
      !element.matches(':disabled, [aria-disabled="true"]')
    )) return 'ready';
    return 'loading';
  };
  await expect.poll(state, { timeout,
    message: 'Vault must expose its public lock screen or interactive navigation'
  }).not.toBe('loading');
  // A full reload of an established archive must prove fresh authentication.
  // Generic readiness is also used after an independently authenticated entry.
  if (requireUnlock) await expect(lockedHeading).toBeVisible({ timeout });
  if (requireUnlock || await lockedHeading.isVisible()) {
    const input = page.locator('#vault-password');
    await expect(input).toBeVisible({ timeout });
    await input.fill(vaultPassword, { timeout });
    await page.getByRole('button', { name: 'Sblocca Registro', exact: true }).click({ timeout });
    await expect(lockedHeading).toBeHidden({ timeout });
  }
  await expect.poll(state, { timeout,
    message: 'Vault unlock must expose interactive navigation, not a protected surface'
  }).toBe('ready');
  // Some tests deliberately require a neutral Home; UX navigation tests
  // instead inspect whether a class context was restored on reload.
  if (requireHome) await expect(homeHeading).toBeVisible({ timeout });
}

async function reloadVaultAndUnlock(page, vaultPassword, options = {}) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await awaitVaultWorkspace(page, vaultPassword, { ...options, requireUnlock: true });
}

// A full document navigation also starts a new Vault lifecycle. The caller
// cannot weaken the requirement to observe and complete real authentication.
async function gotoVaultAndUnlock(page, url, vaultPassword, options = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await awaitVaultWorkspace(page, vaultPassword, { ...options, requireUnlock: true });
}

module.exports = {
  navigationButton, privacyButton, settleOggiNavigation, closeMobileDrawerWithEscape,
  awaitVaultWorkspace, reloadVaultAndUnlock, gotoVaultAndUnlock
};
