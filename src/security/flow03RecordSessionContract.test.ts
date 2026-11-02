import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConductContextResolution } from '../conduct/conductSession';

const MODULE_URL = new URL('../recording/recordSession.ts', import.meta.url);
const MODULE_PATH = fileURLToPath(MODULE_URL);

const moduleExists = () => existsSync(MODULE_PATH);
const loadModule = async () => moduleExists() ? import('../recording/recordSession') : null;

const resolvedContext: ConductContextResolution = {
  status: 'resolved',
  className: '2ª C',
  udaId: 'uda-agri',
  udaTitle: 'Agricoltura come sistema tecnologico',
  lessonId: 'lesson-1',
  activityLabel: 'Analisi del sistema agricolo',
  objective: 'Riconoscere input, processi e output.'
};

describe('FLOW-03 recording session contract', () => {
  test('materializes one pure FLOW-03 recording-session module', () => {
    expect(moduleExists()).toBe(true);
  });

  test('copies only safe resolved professional context and normalizes the staged note', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.buildRecordSession({
      classId: 'class-2c',
      className: '2ª C',
      conductContext: resolvedContext,
      stagedNote: '  La classe ha completato il plastico.  '
    })).toEqual({
      context: {
        classId: 'class-2c',
        className: '2ª C',
        udaId: 'uda-agri',
        udaTitle: 'Agricoltura come sistema tecnologico',
        lessonId: 'lesson-1',
        activityLabel: 'Analisi del sistema agricolo'
      },
      stagedNote: 'La classe ha completato il plastico.',
      status: 'choose'
    });
  });

  test('keeps ambiguous and class-only conduct context class-only', async () => {
    const mod = await loadModule();
    if (!mod) return;

    for (const conductContext of [
      { status: 'ambiguous', className: '2ª C' },
      { status: 'class-only', className: '2ª C' }
    ] as ConductContextResolution[]) {
      expect(mod.buildRecordSession({
        classId: 'class-2c',
        className: '2ª C',
        conductContext,
        stagedNote: '   '
      })).toEqual({
        context: { classId: 'class-2c', className: '2ª C' },
        status: 'choose'
      });
    }
  });

  test('fails closed when conduct context belongs to another class', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(() => mod.buildRecordSession({
      classId: 'class-2c',
      className: '2ª C',
      conductContext: { ...resolvedContext, className: '3ª A' }
    })).toThrow('RECORD_CLASS_MISMATCH');
  });

  test('routes each evidence kind to the existing authoritative specialist surface', async () => {
    const mod = await loadModule();
    if (!mod) return;

    expect(mod.routeForRecordEvidence('evaluation')).toEqual({ kind: 'tab', tab: 'voti' });
    expect(mod.routeForRecordEvidence('behaviour')).toEqual({ kind: 'tab', tab: 'comportamenti' });
    expect(mod.routeForRecordEvidence('online-outcomes')).toEqual({ kind: 'tab', tab: 'verifiche-online' });
    expect(mod.routeForRecordEvidence('lesson-log')).toEqual({ kind: 'tab', tab: 'uda-gantt' });
  });

  test('moves through choose, editing and saved only through explicit session helpers', async () => {
    const mod = await loadModule();
    if (!mod) return;

    const base = mod.buildRecordSession({ classId: 'class-2c', className: '2ª C' });
    const editing = mod.setRecordEvidenceKind(base, 'evaluation');
    expect(editing.status).toBe('editing');
    expect(editing.evidenceKind).toBe('evaluation');

    const changed = mod.updateRecordStagedNote(editing, ' Osservazione da rivedere ');
    expect(changed.stagedNote).toBe('Osservazione da rivedere');
    expect(changed.status).toBe('editing');

    const saved = mod.markRecordSessionSaved(changed);
    expect(saved.status).toBe('saved');
    expect(saved.evidenceKind).toBe('evaluation');
  });
});
