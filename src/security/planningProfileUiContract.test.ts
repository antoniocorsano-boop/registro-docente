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
    expect(editor).toContain('2 h/settimana');
    expect(editor).toContain('66 h/anno');
    expect(editor).toContain('reservePercent');
    expect(editor).toContain('assessmentPeriods');
    expect(editor).toContain('weeklySlots');
    expect(editor).toContain('closureDates');
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
});
