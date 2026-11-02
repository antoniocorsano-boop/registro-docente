import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { UdaRecord } from '../types';

const MODULE_URL = new URL('../conduct/conductSession.ts', import.meta.url);
const MODULE_PATH = fileURLToPath(MODULE_URL);

const moduleExists = () => existsSync(MODULE_PATH);

const loadModule = async () => {
  if (!moduleExists()) return null;
  return import('../conduct/conductSession');
};

const uda = (overrides: Partial<UdaRecord>): UdaRecord => ({
  id: 'uda-default',
  title: 'UDA default',
  className: '2ª C',
  hours: 10,
  period: 'Q1',
  startMonth: 1,
  durationMonths: 2,
  lessons: [],
  ...overrides
});

describe('FLOW-02 conduct context contract', () => {
  test('materializes one focused conduct-session resolver', () => {
    expect(moduleExists()).toBe(true);
  });

  test('resolves one unique lesson dated today across matching class UDAs', async () => {
    const mod = await loadModule();
    if (!mod) return;

    const result = mod.resolveConductContext({
      className: '2ª C',
      todayIsoDate: '2026-11-02',
      udas: [
        uda({ id: 'uda-a', title: 'Energia', lessons: [{ id: 'lesson-a', date: '2026-11-02', topic: 'Trasformazioni di energia', hours: 1, notes: 'Obiettivo: riconoscere le trasformazioni.' }] }),
        uda({ id: 'uda-b', title: 'Materiali', lessons: [{ id: 'lesson-b', date: '2026-11-05', topic: 'Polimeri', hours: 1 }] })
      ]
    });

    expect(result).toEqual({
      status: 'resolved',
      className: '2ª C',
      udaId: 'uda-a',
      udaTitle: 'Energia',
      lessonId: 'lesson-a',
      activityLabel: 'Trasformazioni di energia',
      objective: 'Obiettivo: riconoscere le trasformazioni.'
    });
  });

  test('falls back to the single class UDA without inventing a lesson', async () => {
    const mod = await loadModule();
    if (!mod) return;

    const result = mod.resolveConductContext({
      className: ' 2ª C ',
      todayIsoDate: '2026-11-02',
      udas: [uda({ id: 'uda-one', title: 'Agricoltura', lessons: [{ id: 'future', date: '2026-11-09', topic: 'Sistemi agricoli', hours: 1 }] })]
    });

    expect(result).toEqual({
      status: 'resolved',
      className: '2ª C',
      udaId: 'uda-one',
      udaTitle: 'Agricoltura',
      activityLabel: 'Agricoltura'
    });
    expect('lessonId' in result).toBe(false);
  });

  test('returns class-only when no class UDA exists', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.resolveConductContext({
      className: '3ª A',
      todayIsoDate: '2026-11-02',
      udas: [uda({ className: '2ª C' })]
    })).toEqual({ status: 'class-only', className: '3ª A' });
  });

  test('fails closed when multiple class UDAs are equally plausible', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.resolveConductContext({
      className: '2ª C',
      todayIsoDate: '2026-11-02',
      udas: [uda({ id: 'a', title: 'A' }), uda({ id: 'b', title: 'B' })]
    })).toEqual({ status: 'ambiguous', className: '2ª C' });
  });

  test('fails closed when more than one lesson matches the same class and date', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.resolveConductContext({
      className: '2ª C',
      todayIsoDate: '2026-11-02',
      udas: [
        uda({ id: 'a', lessons: [{ id: 'la', date: '2026-11-02', topic: 'A', hours: 1 }] }),
        uda({ id: 'b', lessons: [{ id: 'lb', date: '2026-11-02', topic: 'B', hours: 1 }] })
      ]
    })).toEqual({ status: 'ambiguous', className: '2ª C' });
  });

  test('uses exact class matching after trimming only', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.resolveConductContext({
      className: '2C',
      todayIsoDate: '2026-11-02',
      udas: [uda({ className: '2ª C' })]
    })).toEqual({ status: 'class-only', className: '2C' });
  });
});
