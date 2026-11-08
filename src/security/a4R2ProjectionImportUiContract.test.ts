import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { previewDocenteOsTeachingProjection } from '../planning/docenteOsTeachingProjection';
import { bindAcceptedDocenteOsTeachingProjection, reconcileDocenteOsTeachingProjectionClasses } from '../planning/docenteOsProjectionReconciliation';

const panelUrl = new URL('../components/planning/DocenteOsProjectionPanel.tsx', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const readPanel = () => existsSync(panelUrl) ? readFileSync(panelUrl, 'utf8') : '';

describe('A4-R2B projection import/preview UI contract', () => {
  test('materializes the secondary Docente OS projection panel', () => {
    expect(existsSync(panelUrl)).toBe(true);
    const panel = readPanel();
    expect(panel).toContain('Importa da Docente OS');
    expect(panel).toContain('<details');
  });

  test('keeps JSON acquisition local and validates before building the preview', () => {
    const panel = readPanel();
    expect(panel).toContain('type="file"');
    expect(panel).toContain('accept="application/json,.json"');
    expect(panel).toContain('await file.text()');
    expect(panel).toContain('JSON.parse');
    expect(panel).toContain('previewDocenteOsTeachingProjection');
    expect(panel).not.toContain('fetch(');
  });

  test('shows provenance, teaching scope, counts and class reconciliation in teacher language', () => {
    const panel = readPanel();
    expect(panel).toContain('projection.provenance.sourceCommit');
    expect(panel).toContain('projection.generatedAt');
    expect(panel).toContain('projection.schoolYear');
    expect(panel).toContain('projection.disciplineName');
    expect(panel).toContain('projection.classes.length');
    expect(panel).toContain('udaCount');
    expect(panel).toContain('reconcileDocenteOsTeachingProjectionClasses');
    expect(panel).toContain('Riconciliazione classi');
    expect(panel).toContain('Associata');
    expect(panel).toContain('Ambigua');
    expect(panel).toContain('Non associata');
  });

  test('uses the previous accepted slot mapping and blocks acceptance until every class is resolved', () => {
    const panel = readPanel();
    expect(panel).toContain('findAcceptedDocenteOsTeachingProjectionForSlot');
    expect(panel).toContain("item.status === 'resolved'");
    expect(panel).toContain('disabled={!canAccept || isAccepting}');
    expect(panel).toContain('Accetta e salva la proiezione');
  });

  test('reports success only after the durable App acceptance promise resolves', () => {
    const panel = readPanel();
    const awaitIndex = panel.indexOf('await onAccept(preview.projection)');
    const successIndex = panel.indexOf('setSuccessMessage(');
    expect(awaitIndex).toBeGreaterThanOrEqual(0);
    expect(successIndex).toBeGreaterThan(awaitIndex);
    expect(panel).toContain('isAccepting');
  });

  test('keeps technical validation taxonomy behind a compact disclosure rather than the default viewport', () => {
    const panel = readPanel();
    expect(panel).toContain('<summary>Dettagli tecnici</summary>');
    expect(panel).toContain('validationCode');
    expect(panel).not.toContain('DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1');
    expect(panel).not.toContain('READ_ONLY_PROJECTION');
  });

  test('wires the panel through Programmazione to the existing commit-first App handler', () => {
    const view = read('../components/planning/PlanningProfileView.tsx');
    const app = read('../App.tsx');

    expect(view).toContain('DocenteOsProjectionPanel');
    expect(view).toContain('planning={planning}');
    expect(view).toContain('classes={classes}');
    expect(view).toContain('onAccept={onAcceptDocenteOsProjection}');
    expect(app).toContain('onAcceptDocenteOsProjection={handleAcceptDocenteOsTeachingProjection}');
    expect(app).toContain('planning={planning}');
    expect(app).toContain('classes={appData.classes}');
  });

  test('rechecks class resolution inside the serialized commit and refuses stale unresolved authority', () => {
    const app = read('../App.tsx');
    const start = app.indexOf('const handleAcceptDocenteOsTeachingProjection = useCallback');
    const end = app.indexOf('const commitLibraryMutation = useCallback', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);
    const reconcileIndex = handler.indexOf('reconcileDocenteOsTeachingProjectionClasses');
    const guardIndex = handler.indexOf("reconciliation.some(item => item.status !== 'resolved')");
    const bindIndex = handler.indexOf('return bindAcceptedDocenteOsTeachingProjection');

    expect(reconcileIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeGreaterThan(reconcileIndex);
    expect(bindIndex).toBeGreaterThan(guardIndex);
    expect(handler).toContain('Riconciliazione classi Docente OS incompleta');
  });
});
describe('A4-R2B import safety regressions', () => {
  test('preview association is recalculated against current class authority', () => {
    const panel = readPanel();
    expect(panel).toContain('useMemo(');
    expect(panel).toContain('reconcileDocenteOsTeachingProjectionClasses');
    expect(panel).toContain('[preview, planning, classes]');
    expect(panel).toContain("reconciliation.every(item => item.status === 'resolved')");
  });

  test('binding refuses unresolved or ambiguous class mappings even when their entries are present', () => {
    const fixture = JSON.parse(read('../../docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json'));
    const parsed = previewDocenteOsTeachingProjection(fixture);
    if (!parsed.ok) throw new Error(parsed.code);
    for (const classes of [
      [{ id: 'wrong-class', name: '3C' }],
      [{ id: 'one', name: '1A' }, { id: 'two', name: '1ª A' }]
    ]) {
      const reconciliation = reconcileDocenteOsTeachingProjectionClasses(parsed.projection, classes);
      expect(reconciliation.some(item => item.status !== 'resolved')).toBe(true);
      expect(() => bindAcceptedDocenteOsTeachingProjection(
        createEmptyPlanningState(),
        parsed.projection,
        reconciliation,
        { status: 'accepted', acceptedAt: '2026-11-08T13:00:00.000Z' }
      )).toThrow('Riconciliazione classi Docente OS incompleta');
    }
  });
});
