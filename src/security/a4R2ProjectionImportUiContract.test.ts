import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { previewDocenteOsTeachingProjection } from '../planning/docenteOsTeachingProjection';
import {
  bindAcceptedDocenteOsTeachingProjection,
  reconcileDocenteOsTeachingProjectionClasses
} from '../planning/docenteOsProjectionReconciliation';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panelURL = new URL('../components/planning/DocenteOsProjectionPanel.tsx', import.meta.url);
const fixture = () => JSON.parse(read('../../docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json'));

describe('A4-R2B Task 7 — Local Docente OS projection preview and explicit commit', () => {
  test('exposes a collapsed local-only preview, never an automatic acceptance', () => {
    expect(existsSync(panelURL)).toBe(true);
    if (!existsSync(panelURL)) return;
    const source = read('../components/planning/DocenteOsProjectionPanel.tsx');
    expect(source).toContain('Importa da Docente OS');
    expect(source).toContain('<details');
    expect(source).toContain('type="file"');
    expect(source).toContain('accept="application/json,.json"');
    expect(source).toContain('await file.text()');
    expect(source).toContain('previewDocenteOsTeachingProjection');
    expect(source).toContain('reconcileDocenteOsTeachingProjectionClasses');
    expect(source).toContain('findAcceptedDocenteOsTeachingProjectionForSlot');
    expect(source).toContain('preview.provenance.sourceCommit');
    expect(source).toContain('projection.generatedAt');
    expect(source).toContain('projection.schoolYear');
    expect(source).toContain('projection.disciplineName');
    expect(source).toContain('Riconciliazione classi');
    expect(source).toContain("item.status === 'resolved'");
    expect(source).toContain('disabled={!canAccept || isAccepting}');
    expect(source).toContain('await onAccept(preview.projection)');
    expect(source).toContain('setSuccessMessage(');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('localStorage');
  });

  test('keeps class-first Programmazione and its dirty draft guard while wiring secondary import', () => {
    const view = read('../components/planning/PlanningProfileView.tsx');
    const app = read('../App.tsx');
    expect(view).toContain('<PlanningProfileEditor');
    expect(view).toContain('onRegisterDraftGuard={registerEditorGuard}');
    expect(view).toContain('<DocenteOsProjectionPanel');
    expect(view).toContain('onAccept={acceptProjection}');
    expect(view).toContain('editorGuardRef.current?.hasUnsavedChanges()');
    expect(view).toContain('return onAcceptDocenteOsProjection(payload)');
    expect(view).toContain('planning={planning}');
    expect(view).toContain('classes={classes}');
    expect(app).toContain('onAcceptDocenteOsProjection={handleAcceptDocenteOsTeachingProjection}');
    expect(app).toContain('planning={planning}');
    expect(app).toContain('classes={appData.classes}');
  });

  test('revalidates exact current classes INSIDE serialized commit before binding', () => {
    const app = read('../App.tsx');
    const start = app.indexOf('const handleAcceptDocenteOsTeachingProjection = useCallback');
    const end = app.indexOf('const commitLibraryMutation = useCallback', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);
    const commitIndex = handler.indexOf('commitPlanningMutation(current => {');
    const reconcileIndex = handler.indexOf('reconcileDocenteOsTeachingProjectionClasses');
    const checkIndex = handler.indexOf("reconciliation.some(item => item.status !== 'resolved')");
    const bindIndex = handler.indexOf('return bindAcceptedDocenteOsTeachingProjection');
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(reconcileIndex).toBeGreaterThan(commitIndex);
    expect(checkIndex).toBeGreaterThan(reconcileIndex);
    expect(bindIndex).toBeGreaterThan(checkIndex);
  });

  test('runtime rejects unresolved and ambiguous identities before any accepted projection', () => {
    const parsed = previewDocenteOsTeachingProjection(fixture());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const classes of [
      [{ id: 'other-class', name: '1C' }],
      [{ id: 'class-1a', name: '1A' }, { id: 'duplicate-1a', name: '1ª A' }]
    ]) {
      const reconciliation = reconcileDocenteOsTeachingProjectionClasses(parsed.projection, classes);
      expect(reconciliation.some(item => item.status !== 'resolved')).toBe(true);
      expect(() => bindAcceptedDocenteOsTeachingProjection(
        createEmptyPlanningState(), parsed.projection, reconciliation,
        { status: 'accepted', acceptedAt: '2026-11-08T14:00:00.000Z' }
      )).toThrow('Riconciliazione classi Docente OS incompleta');
    }
  });
});
