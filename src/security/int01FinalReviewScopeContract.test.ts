import { describe, expect, test } from 'bun:test';
import { classScopedUdaMutationAllowed } from '../context/udaClassScope';
import type { UdaRecord } from '../types';

const uda = (id: string, className: string): UdaRecord => ({
  id, title: id, className, period: 'Q1', hours: 6, startMonth: 0,
  durationMonths: 1, description: '', competencies: '', authenticTask: '',
  rubricLevels: { av: '', in: '', ba: '', pa: '' }, dependencies: [], lessons: []
});

describe('INT-01 Final Independent Review repair — class isolation and shared UDA focus', () => {
  test('allows editing active-class UDA while preserving other classes', () => {
    const original = [uda('A', '2Z'), uda('B', '3Z')];
    const modified = [{ ...original[0]!, title: 'A changed' }, original[1]!];
    expect(classScopedUdaMutationAllowed(original, modified, '2Z')).toBe(true);
  });

  test('rejects editing, deleting, creating or moving a UDA outside the active class', () => {
    const original = [uda('A', '2Z'), uda('B', '3Z')];
    expect(classScopedUdaMutationAllowed(original,
      [original[0]!, { ...original[1]!, title: 'B changed' }], '2Z')).toBe(false);
    expect(classScopedUdaMutationAllowed(original, [original[0]!], '2Z')).toBe(false);
    expect(classScopedUdaMutationAllowed(original,
      [...original, uda('C', '3Z')], '2Z')).toBe(false);
    expect(classScopedUdaMutationAllowed(original,
      [{ ...original[0]!, className: '3Z' }, original[1]!], '2Z')).toBe(false);
  });

  test('preserves historical unscoped cross-class workflows without active class', () => {
    const original = [uda('A', '2Z'), uda('B', '3Z')];
    expect(classScopedUdaMutationAllowed(original,
      [{ ...original[0]!, title: 'changed' }, { ...original[1]!, title: 'changed' }], null)).toBe(true);
  });

  test('legacy Gantt locks effective read scope and secondary class dropdown', async () => {
    const legacy = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(legacy).toContain('const scopedUdas = currentClassName');
    expect(legacy).toContain('const effectiveClassFilter = currentClassName || classFilter');
    expect(legacy).toContain('value={effectiveClassFilter}');
    expect(legacy).toContain('disabled={Boolean(currentClassName)}');
    expect(legacy).toContain('classScopedUdaMutationAllowed(');
  });

  test('Analysis forwards explicit selection back into the single App UDA focus', async () => {
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const analysis = workspace.slice(
      workspace.indexOf("{activeView === 'analysis' && ("),
      workspace.indexOf("{isCreateOpen && (", workspace.indexOf("{activeView === 'analysis' && ("))
    );
    expect(analysis).toContain('currentClassName={currentClassName}');
    expect(analysis).toContain('teachingFocus={teachingFocus}');
    expect(analysis).toContain('teachingContext={teachingContext}');
    expect(analysis).toContain('onTeachingFocusChange={onTeachingFocusChange}');
  });
});
