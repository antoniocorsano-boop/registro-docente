import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03 browser qualification contract', () => {
  test('materializes one dedicated Chromium journey', () => {
    expect(existsSync('tests/browser/flow-03-registra.spec.cjs')).toBe(true);
  });

  test('browser workflow installs and runs the dedicated FLOW-03 spec', async () => {
    const workflow = await source('.github/workflows/browser-qualification.yml');

    expect(workflow).toContain('cp tests/browser/flow-03-registra.spec.cjs .browser-tools/flow-03-registra.spec.cjs');
    expect(workflow).toContain('name: Run FLOW-03 Chromium qualification');
    expect(workflow).toContain('flow-03-registra.spec.cjs');
    expect(workflow).toContain('--output=../browser-evidence/flow-03-test-results');
  });

  test('journey covers the authoritative recording routes and explicit review continuation', async () => {
    if (!existsSync('tests/browser/flow-03-registra.spec.cjs')) return;
    const spec = await source('tests/browser/flow-03-registra.spec.cjs');

    for (const marker of [
      'Conduci → Registra → diario UDA',
      'Registra → Valutazione',
      'Registra → Comportamento',
      'Registra → Esiti verifica online',
      'Registrazione completata',
      'Rivedi',
      'Attività / nota UDA',
      'Valutazione',
      'Comportamento',
      'Esiti verifica online'
    ]) {
      expect(spec).toContain(marker);
    }
  });

  test('journey proves the Human Product UX mission continuity rework', async () => {
    if (!existsSync('tests/browser/flow-03-registra.spec.cjs')) return;
    const spec = await source('tests/browser/flow-03-registra.spec.cjs');

    for (const marker of [
      'Missione Registra per ${CLASS_NAME}',
      'Stai registrando · ${CLASS_NAME}',
      'Torna a Registra',
      'flow-03-desktop-evaluation-mission.png',
      'flow-03-desktop-return-to-record.png'
    ]) {
      expect(spec).toContain(marker);
    }
    expect(spec).toContain('await expect(mission).toBeHidden();');
  });

  test('journey proves explicit focused UDA selection and authoritative diary disclosure', async () => {
    if (!existsSync('tests/browser/flow-03-registra.spec.cjs')) return;
    const spec = await source('tests/browser/flow-03-registra.spec.cjs');

    for (const marker of [
      'Seleziona UDA per Registra',
      'Scegli questa UDA',
      'Registrazione rapida',
      'Diario della registrazione',
      'Mostra dettagli UDA',
      'Nascondi dettagli UDA',
      'flow-03-direct-focused-uda.png',
      'flow-03-mobile-focused-uda.png'
    ]) {
      expect(spec).toContain(marker);
    }
  });

  test('journey captures desktop and primary mobile 390x844 evidence', async () => {
    if (!existsSync('tests/browser/flow-03-registra.spec.cjs')) return;
    const spec = await source('tests/browser/flow-03-registra.spec.cjs');

    expect(spec).toContain("viewport: { width: 390, height: 844 }");
    for (const evidence of [
      'flow-03-desktop-record.png',
      'flow-03-desktop-evaluation-mission.png',
      'flow-03-desktop-return-to-record.png',
      'flow-03-direct-focused-uda.png',
      'flow-03-mobile-record.png',
      'flow-03-mobile-focused-uda.png',
      'flow-03-mobile-uda-saved.png',
      'flow-03-mobile-review.png'
    ]) {
      expect(spec).toContain(evidence);
    }
  });

  test('journey proves session-only draft, mobile geometry and no automatic specialist mutation', async () => {
    if (!existsSync('tests/browser/flow-03-registra.spec.cjs')) return;
    const spec = await source('tests/browser/flow-03-registra.spec.cjs');

    expect(spec).toContain('Bozza temporanea — non ancora registrata');
    expect(spec).toContain('assertNoHorizontalOverflow');
    expect(spec).toContain('assertCriticalControlsTouchSafe');
    expect(spec).toContain('assertStagedNoteTextareaUnobscured');
    expect(spec).toContain('assertNoAutomaticMutation');
    expect(spec).toContain('assertSelectedClassStillVisible');
    expect(spec).toContain('expect(pageErrors).toEqual([])');
  });
});