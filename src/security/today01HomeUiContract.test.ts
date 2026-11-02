import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('TODAY-01 Home task-first contract', () => {
  test('exposes Oggi as the four-action professional starting point', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain("import type { TodayAction } from '../today/todayRouter';");
    expect(home).toContain('onStartTodayAction: (action: TodayAction) => void;');
    expect(home).toContain('pendingTodayAction: TodayAction | null;');
    expect(home).toContain('onCancelTodayAction: () => void;');
    expect(home).toContain('Oggi');
    expect(home).toContain('Prepara');
    expect(home).toContain('Conduci');
    expect(home).toContain('Registra');
    expect(home).toContain('Rivedi');
  });

  test('routes each Oggi action explicitly and keeps touch targets usable', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain("onClick={() => onStartTodayAction('prepare')}");
    expect(home).toContain("onClick={() => onStartTodayAction('conduct')}");
    expect(home).toContain("onClick={() => onStartTodayAction('record')}");
    expect(home).toContain("onClick={() => onStartTodayAction('review')}");
    expect(home).toContain('min-h-[44px]');
  });

  test('requires explicit class choice for a pending task and offers cancellation', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('pendingTodayAction');
    expect(home).toContain('scegli una classe');
    expect(home).toContain('onCancelTodayAction');
    expect(home).toContain('Annulla');
    expect(home).toContain("setActiveView('classes')");
    expect(home).toContain('onSelectClass(classData.id)');
  });

  test('preserves expert Home access instead of replacing it with a second dashboard', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('Classi');
    expect(home).toContain('Sintesi');
    expect(home).toContain('Confronto');
    expect(home).toContain("type HomeViewMode = 'classes' | 'summary' | 'comparison';");
    expect(home).toContain("activeView === 'summary'");
    expect(home).toContain("activeView === 'comparison'");
  });
});