const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'https://registro-docente.ai.studio';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../ux-audit-evidence');
const candidateSha = process.env.CANDIDATE_SHA || 'unknown';
const vaultPassword = 'ux-trust-01-audit-only';
const CLASS_NAME = '3ª A - Secondaria I Grado';
const STUDENT_TEST = "A cosa serve l'energia";

test.setTimeout(180000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function unlockVault(page, expectedHeading = 'Le mie classi') {
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible();
}

async function disablePrivacyShield(page) {
  const activeShield = page.getByRole('button', { name: /LIM Shield Attivo/ });
  if (await activeShield.isVisible().catch(() => false)) {
    await activeShield.click();
  }
}

function primaryWorkflowButton(page, label) {
  const all = page.getByRole('button', { name: label, exact: true });
  return all.last();
}

async function openDrawerDestination(page, label) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const button = page.getByRole('button', { name: label, exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.waitForTimeout(250);
}

async function selectFirstClass(page) {
  const classHeading = page.getByRole('heading', { name: CLASS_NAME, exact: true, level: 4 });
  await expect(classHeading).toBeVisible();
  await classHeading.click();
  await expect(page.getByRole('button', { name: 'Riepilogo', exact: true })).toBeVisible();
  await page.waitForTimeout(200);
}

async function visibleAuditMetrics(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const controls = [...document.querySelectorAll('button,a,input,select,textarea')]
      .filter(isVisible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        return {
          tag: el.tagName.toLowerCase(),
          name,
          width: Math.round(r.width),
          height: Math.round(r.height),
          x: Math.round(r.x),
          y: Math.round(r.y)
        };
      });

    const fixed = [...document.querySelectorAll('*')]
      .filter((el) => isVisible(el) && ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          position: getComputedStyle(el).position,
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
          zIndex: getComputedStyle(el).zIndex
        };
      });

    const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
      .filter(isVisible)
      .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180));

    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      scroll: {
        bodyWidth: document.body.scrollWidth,
        rootWidth: document.documentElement.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        rootHeight: document.documentElement.scrollHeight
      },
      horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth + 1,
      smallControls: controls.filter((c) => c.width < 44 || c.height < 44),
      fixedOrSticky: fixed,
      headings
    };
  });
}

async function captureSurface(page, report, step, name, mode) {
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const prefix = `${String(step).padStart(2, '0')}-${mode}-${name}`;
  await page.screenshot({ path: path.join(evidenceDir, `${prefix}-full.png`), fullPage: true });
  await page.screenshot({ path: path.join(evidenceDir, `${prefix}-top.png`), fullPage: false });

  if (mode === 'mobile') {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(evidenceDir, `${prefix}-bottom.png`), fullPage: false });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  report.push({ step, name, mode, ...(await visibleAuditMetrics(page)) });
}

async function auditTeacherApp(browser, viewport, mode) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const report = [];
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await setupFreshVault(page);
  await captureSurface(page, report, 1, 'home-classes', mode);

  await selectFirstClass(page);
  await disablePrivacyShield(page);
  await captureSurface(page, report, 2, 'class-summary', mode);

  const primary = [
    ['Valutazioni', 'evaluations'],
    ['Comportamento', 'behaviors'],
    ['Tabellone', 'matrix'],
    ['Analisi', 'analytics']
  ];
  let step = 3;
  for (const [label, slug] of primary) {
    await primaryWorkflowButton(page, label).click();
    await page.waitForTimeout(220);
    await captureSurface(page, report, step++, slug, mode);
  }

  const drawer = [
    ['Storico prove', 'history'],
    ['Scheda alunno', 'student-report'],
    ['Gestione alunni', 'students-management'],
    ['Verifiche online', 'online-tests'],
    ['UDA', 'uda'],
    ['Impostazioni', 'settings'],
    ['Privacy', 'privacy']
  ];

  for (const [label, slug] of drawer) {
    await openDrawerDestination(page, label);
    await captureSurface(page, report, step++, slug, mode);
  }

  // Header/privacy affordance with shield active, to inspect the live state explicitly.
  const shieldButton = page.getByRole('button', { name: /Privacy LIM|LIM Shield Attivo/ });
  if (await shieldButton.isVisible().catch(() => false)) {
    const title = await shieldButton.getAttribute('title');
    if (title && !(await page.getByRole('button', { name: /LIM Shield Attivo/ }).isVisible().catch(() => false))) {
      await shieldButton.click();
    }
  }
  await captureSurface(page, report, step++, 'privacy-shield-active', mode);

  await fs.writeFile(
    path.join(evidenceDir, `ux-trust-01-${mode}-report.json`),
    JSON.stringify({ candidateSha, baseURL, mode, viewport, report, pageErrors, consoleErrors }, null, 2)
  );

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
}

test('UX-TRUST-01 full teacher-app audit — mobile 390x844', async ({ browser }) => {
  await auditTeacherApp(browser, { width: 390, height: 844 }, 'mobile');
});

test('UX-TRUST-01 full teacher-app audit — desktop 1280x900', async ({ browser }) => {
  await auditTeacherApp(browser, { width: 1280, height: 900 }, 'desktop');
});

test('UX-TRUST-01 student portal audit — mobile and desktop', async ({ browser }) => {
  const variants = [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1280, height: 900 }]
  ];
  const report = [];

  for (const [mode, viewport] of variants) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await setupFreshVault(page);
    await page.goto(`${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(CLASS_NAME)}`, { waitUntil: 'domcontentloaded' });
    await unlockVault(page, STUDENT_TEST);
    await captureSurface(page, report, mode === 'mobile' ? 20 : 21, 'student-portal-start', mode);
    await context.close();
  }

  await fs.writeFile(
    path.join(evidenceDir, 'ux-trust-01-student-portal-report.json'),
    JSON.stringify({ candidateSha, baseURL, report }, null, 2)
  );
});
