const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const candidateSha = process.env.CANDIDATE_SHA || 'unknown';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'online-01-qualification-only';

test.setTimeout(60000);

async function installSubmissionInjection(context) {
  await context.addInitScript(() => {
    const subtle = globalThis.crypto.subtle;
    const proto = Object.getPrototypeOf(subtle);
    const originalEncrypt = proto.encrypt;
    const decoder = new TextDecoder();
    const state = {
      mode: 'pass',
      attempts: 0,
      submissionIds: [],
      payloadSizes: [],
      release: null
    };

    Object.defineProperty(globalThis, '__online01Injection', {
      configurable: true,
      value: state
    });

    Object.defineProperty(proto, 'encrypt', {
      configurable: true,
      writable: true,
      value: function (algorithm, key, data) {
        let additionalData = '';
        try {
          if (algorithm && algorithm.additionalData) {
            additionalData = decoder.decode(new Uint8Array(algorithm.additionalData));
          }
        } catch {}

        if (additionalData.includes(':submissions:')) {
          state.attempts += 1;
          try {
            const payload = JSON.parse(decoder.decode(new Uint8Array(data)));
            const latest = Array.isArray(payload) ? payload[payload.length - 1] : null;
            state.submissionIds.push(latest?.id ?? null);
            state.payloadSizes.push(Array.isArray(payload) ? payload.length : -1);
          } catch {
            state.submissionIds.push(null);
            state.payloadSizes.push(-1);
          }

          if (state.mode === 'delay') {
            state.mode = 'pass';
            return new Promise((resolve, reject) => {
              state.release = () => {
                state.release = null;
                Promise.resolve(originalEncrypt.call(this, algorithm, key, data)).then(resolve, reject);
              };
            });
          }

          if (state.mode === 'fail-once') {
            state.mode = 'pass';
            return Promise.reject(new Error('ONLINE-01 injected submission failure'));
          }
        }

        return originalEncrypt.call(this, algorithm, key, data);
      }
    });
  });
}

async function setupFreshVault(page, targetURL = baseURL) {
  await page.goto(targetURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
}

async function unlockVault(page) {
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
}

function studentPortalURL(className = 'CLASSE-URL-NON-VALIDA') {
  return `${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(className)}`;
}

function classSelect(page) {
  return page.locator('label').filter({ hasText: /^Classe$/ }).locator('..').locator('select');
}

async function startQuiz(page, studentName) {
  await expect(page.getByRole('heading', { name: "A cosa serve l'energia" })).toBeVisible();
  await page.getByPlaceholder('es. Rossi Maria').fill(studentName);
  await page.getByRole('button', { name: /Inizia Flashcard/ }).click();
  await expect(page.getByText('Domanda 1 di 10', { exact: true })).toBeVisible();
}

async function answerThroughFinalQuestion(page) {
  for (let question = 1; question <= 10; question += 1) {
    await expect(page.getByText(`Domanda ${question} di 10`, { exact: true })).toBeVisible();
    await page.locator('button.w-full.text-left').first().click();
    if (question < 10) {
      await page.getByRole('button', { name: /Prossima Scheda/ }).click();
    }
  }
  await expect(page.getByRole('button', { name: /Completa e Consegna/ })).toBeVisible();
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  return metrics;
}

async function openTeacherDestination(page, label) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

test('ONLINE-01 pending submit is truthful and non-reentrant — mobile 390x844', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installSubmissionInjection(context);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await setupFreshVault(page, studentPortalURL());
  await expect(page.getByRole('heading', { name: "A cosa serve l'energia" })).toBeVisible();
  await startQuiz(page, 'Studente Sintetico Mobile');
  await answerThroughFinalQuestion(page);

  await page.evaluate(() => { globalThis.__online01Injection.mode = 'delay'; });
  const submit = page.getByRole('button', { name: /Completa e Consegna/ });
  await submit.dblclick();
  await expect(page.getByRole('button', { name: 'Salvataggio...' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toHaveCount(0);
  await page.waitForTimeout(400);

  const pendingEvidence = await page.evaluate(() => ({
    attempts: globalThis.__online01Injection.attempts,
    ids: [...globalThis.__online01Injection.submissionIds],
    payloadSizes: [...globalThis.__online01Injection.payloadSizes]
  }));
  expect(pendingEvidence.attempts).toBe(1);

  await page.screenshot({
    path: path.join(evidenceDir, 'online-01-mobile-390x844-pending.png'),
    fullPage: true
  });

  await page.evaluate(() => globalThis.__online01Injection.release());
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();

  const finalInjection = await page.evaluate(() => ({
    attempts: globalThis.__online01Injection.attempts,
    ids: [...globalThis.__online01Injection.submissionIds],
    payloadSizes: [...globalThis.__online01Injection.payloadSizes]
  }));
  expect(finalInjection.attempts).toBe(1);
  expect(finalInjection.payloadSizes).toEqual([1]);

  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();
  await openTeacherDestination(page, 'Verifiche online');
  const resultsTab = page.getByRole('button', { name: 'Esiti & Item Analysis (1)', exact: true });
  await expect(resultsTab).toBeVisible();
  await resultsTab.click();
  await expect(page.getByRole('heading', { name: 'Consegne Ricevute dagli Alunni (1)', exact: true })).toBeVisible();

  const overflow = await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(evidenceDir, 'online-01-mobile-390x844-success.png'),
    fullPage: true
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  await fs.writeFile(
    path.join(evidenceDir, 'online-01-mobile-390x844.json'),
    JSON.stringify({
      candidateSha,
      result: 'PASS',
      viewport: { width: 390, height: 844 },
      pendingEvidence,
      finalInjection,
      overflow,
      consoleErrors,
      pageErrors
    }, null, 2)
  );

  await context.close();
});

test('ONLINE-01 failure preserves retry identity and classes are register-derived — desktop 1280x800', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await installSubmissionInjection(context);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await setupFreshVault(page, baseURL);
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept('Classe Sintetica ONLINE-01'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: Classe Sintetica ONLINE-01' })).toBeVisible();

  await page.goto(studentPortalURL(), { waitUntil: 'domcontentloaded' });
  await unlockVault(page);
  await expect(page.getByRole('heading', { name: "A cosa serve l'energia" })).toBeVisible();

  const select = classSelect(page);
  const options = await select.locator('option').allTextContents();
  expect(options).toContain('Classe Sintetica ONLINE-01');
  expect(await select.inputValue()).toBe(options[0]);
  expect(await select.inputValue()).not.toBe('CLASSE-URL-NON-VALIDA');
  await select.selectOption({ label: 'Classe Sintetica ONLINE-01' });

  await startQuiz(page, 'Studente Sintetico Desktop');
  await answerThroughFinalQuestion(page);

  await page.evaluate(() => { globalThis.__online01Injection.mode = 'fail-once'; });
  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('alert')).toContainText('Consegna non salvata. Riprova o avvisa il docente.');
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toHaveCount(0);
  await expect(page.getByText('Domanda 10 di 10', { exact: true })).toBeVisible();

  const afterFailure = await page.evaluate(() => ({
    attempts: globalThis.__online01Injection.attempts,
    ids: [...globalThis.__online01Injection.submissionIds],
    payloadSizes: [...globalThis.__online01Injection.payloadSizes]
  }));
  expect(afterFailure.attempts).toBe(1);

  await page.screenshot({
    path: path.join(evidenceDir, 'online-01-desktop-1280x800-failure.png'),
    fullPage: true
  });

  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();

  const afterRetry = await page.evaluate(() => ({
    attempts: globalThis.__online01Injection.attempts,
    ids: [...globalThis.__online01Injection.submissionIds],
    payloadSizes: [...globalThis.__online01Injection.payloadSizes]
  }));
  expect(afterRetry.attempts).toBe(2);
  expect(afterRetry.ids[0]).toBeTruthy();
  expect(afterRetry.ids[1]).toBe(afterRetry.ids[0]);
  expect(afterRetry.payloadSizes).toEqual([1, 1]);

  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();
  await openTeacherDestination(page, 'Verifiche online');
  const resultsTab = page.getByRole('button', { name: 'Esiti & Item Analysis (1)', exact: true });
  await expect(resultsTab).toBeVisible();
  await resultsTab.click();
  await expect(page.getByRole('heading', { name: 'Consegne Ricevute dagli Alunni (1)', exact: true })).toBeVisible();

  const overflow = await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(evidenceDir, 'online-01-desktop-1280x800-success.png'),
    fullPage: true
  });

  const expectedConsoleErrors = consoleErrors.filter(message =>
    message.includes('Secure submission save failed') && message.includes('ONLINE-01 injected submission failure')
  );
  const unexpectedConsoleErrors = consoleErrors.filter(message => !expectedConsoleErrors.includes(message));
  expect(expectedConsoleErrors.length).toBeGreaterThanOrEqual(1);
  expect(unexpectedConsoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  await fs.writeFile(
    path.join(evidenceDir, 'online-01-desktop-1280x800.json'),
    JSON.stringify({
      candidateSha,
      result: 'PASS',
      viewport: { width: 1280, height: 800 },
      registerDerivedClasses: options,
      afterFailure,
      afterRetry,
      overflow,
      expectedConsoleErrors,
      unexpectedConsoleErrors,
      pageErrors
    }, null, 2)
  );

  await context.close();
});
