import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-02 conduct UI contract', () => {
  test('materializes one dedicated conduct presentation component', () => {
    expect(existsSync('src/components/ConductLessonPanel.tsx')).toBe(true);
  });

  test('keeps the in-lesson surface compact, explicit and session-only', async () => {
    if (!existsSync('src/components/ConductLessonPanel.tsx')) return;
    const panel = await source('src/components/ConductLessonPanel.tsx');

    expect(panel).toContain("import React, { useState } from 'react';");
    expect(panel).toContain("import type { ConductContextResolution } from '../conduct/conductSession';");
    expect(panel).toContain('Oggi · Conduci');
    expect(panel).toContain('Stai conducendo con');
    expect(panel).toContain('Adesso');
    expect(panel).toContain('Materiali');
    expect(panel).toContain('Verifica / attività');
    expect(panel).toContain('Apri UDA');
    expect(panel).toContain('Chiedi supporto');
    expect(panel).toContain('Vai a Registra');
    expect(panel).toContain('Nota rapida');
    expect(panel).toContain('Temporanea — non ancora registrata');
    expect(panel).toContain("useState('')");
    expect(panel).toContain('<textarea');
    expect(panel).toContain('Privacy Shield');
    expect(panel).toContain("privacyShieldActive ? 'Attivo' : 'Disattivo'");
    expect(panel).toContain('onTogglePrivacyShield');
    expect(panel).toContain('min-h-[44px]');

    for (const forbidden of [
      'secureStorage',
      'saveAppData',
      'commitAppDataMutation',
      'commitUdasMutation',
      'commitProfessionalMemoryMutation'
    ]) {
      expect(panel).not.toContain(forbidden);
    }
  });

  test('renders only resolver-owned lesson context and fails visibly neutral on ambiguity', async () => {
    if (!existsSync('src/components/ConductLessonPanel.tsx')) return;
    const panel = await source('src/components/ConductLessonPanel.tsx');

    expect(panel).toContain("context.status === 'resolved'");
    expect(panel).toContain('context.activityLabel');
    expect(panel).toContain('context.udaTitle');
    expect(panel).toContain('context.objective');
    expect(panel).toContain("context.status === 'ambiguous'");
    expect(panel).toContain('Scegli la UDA da usare');
    expect(panel).toContain("context.status === 'class-only'");
    expect(panel).toContain('Nessuna attività univoca già disponibile');
  });

  test('delegates every durable or specialist action instead of implementing it locally', async () => {
    if (!existsSync('src/components/ConductLessonPanel.tsx')) return;
    const panel = await source('src/components/ConductLessonPanel.tsx');

    expect(panel).toContain('onNavigateLibrary');
    expect(panel).toContain('onNavigateAssessment');
    expect(panel).toContain('onNavigateUda');
    expect(panel).toContain('onOpenCopilot');
    expect(panel).toContain('onGoToRecord');
    expect(panel).toContain('onDismiss');
  });
});
