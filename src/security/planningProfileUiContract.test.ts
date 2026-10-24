import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getFirstCycleNormativeReference } from '../planning/normative/italianFirstCycle';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('EDU-PLAN-01B teacher planning profile contract', () => {
  test('keeps the lower-secondary Technology national reference distinct from editable local allocation', () => {
    const reference = getFirstCycleNormativeReference({
      schoolOrder: 'lower_secondary',
      subjectCode: 'tecnologia',
      schoolYear: '2026/27'
    });

    expect(reference.nationalWeeklyHours).toBe(2);
    expect(reference.nationalAnnualHours).toBe(66);
    expect(reference.allocationScope).toBe('discipline');
  });

  test('keeps primary discipline hours institution-defined instead of inventing a national value', () => {
    const reference = getFirstCycleNormativeReference({
      schoolOrder: 'primary',
      subjectCode: 'tecnologia',
      schoolYear: '2026/27'
    });

    expect(reference.nationalHoursDefined).toBe(false);
    expect(reference.allocationScope).toBe('institution');
  });

  test('exposes a teacher-facing planning profile editor with real calendar, periods and capacity semantics', () => {
    const editor = read('../components/planning/PlanningProfileEditor.tsx');

    expect(editor).toContain('Programmazione didattica');
    expect(editor).toContain('Monte ore disciplinare definito dall\'istituzione scolastica');
    expect(editor).toContain('national.nationalWeeklyHours');
    expect(editor).toContain('h/settimana');
    expect(editor).toContain('national.nationalAnnualHours');
    expect(editor).toContain('h/anno');
    expect(editor).toContain('reservePercent');
    expect(editor).toContain('assessmentPeriods');
    expect(editor).toContain('weeklySlots');
    expect(editor).toContain('closureDates');
  });

  test('requires an explicit normative regime on the teacher profile before Arena can be matched', () => {
    const editor = read('../components/planning/PlanningProfileEditor.tsx');

    expect(editor).toContain('Regime normativo Arena');
    expect(editor).toContain('normativeRegime');
    expect(editor).toContain('Nessuna associazione Arena viene dedotta automaticamente');
  });

  test('wires Programmazione under teaching tools and persists only validated profiles', () => {
    const navbar = read('../components/Navbar.tsx');
    const app = read('../App.tsx');
    const types = read('../types.ts');

    expect(types).toContain("| 'programmazione'");
    expect(navbar).toContain('Programmazione didattica');
    expect(app).toContain('PlanningProfileView');
    expect(app).toContain('validateTeachingProfile');
    expect(app).toContain('commitPlanningMutation');
  });

  test('keeps Arena handoff in preview until an explicit teacher acceptance and exposes authority separately from vigency', () => {
    const panel = read('../components/planning/ArenaPlanningContextPanel.tsx');
    const view = read('../components/planning/PlanningProfileView.tsx');
    const app = read('../App.tsx');

    expect(panel).toContain('Contesto Arena');
    expect(panel).toContain('Solo anteprima');
    expect(panel).toContain('Stato di autorità');
    expect(panel).toContain('Vigenza');
    expect(panel).toContain('Fingerprint master');
    expect(panel).toContain('Commit sorgente');
    expect(panel).toContain('Accetta e collega al profilo');
    expect(panel).toContain('previewArenaPlanningContext');
    expect(view).toContain('ArenaPlanningContextPanel');
    expect(app).toContain('bindAcceptedArenaPlanningContext');
    expect(app).toContain('handleAcceptArenaPlanningContext');
  });
});
