import { describe, expect, test } from 'bun:test';
import { classScopedUdaMutationAllowed, udaBelongsToActiveClass, buildUdaDeletionSnapshot, hasForeignUdaDependencyOn } from '../context/udaClassScope';
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
  test('resolves stored short labels against the active shipped canonical class, without guessing ambiguous aliases', () => {
    const classes = [
      { id: 'class-3a', name: '3ª A - Secondaria I Grado' },
      { id: 'class-3b', name: '3ª B - Secondaria I Grado' }
    ];
    expect(udaBelongsToActiveClass('3ª A', '3ª A - Secondaria I Grado', classes)).toBe(true);
    expect(udaBelongsToActiveClass('3A', '3ª A - Secondaria I Grado', classes)).toBe(true);
    expect(udaBelongsToActiveClass('3ª B', '3ª A - Secondaria I Grado', classes)).toBe(false);
    const original = [uda('A', '3ª A'), uda('B', '3ª B')];
    expect(classScopedUdaMutationAllowed(original,
      [{ ...original[0]!, title: 'changed' }, original[1]!], '3ª A - Secondaria I Grado', classes)).toBe(true);
    expect(classScopedUdaMutationAllowed(original,
      [original[0]!, { ...original[1]!, title: 'changed' }], '3ª A - Secondaria I Grado', classes)).toBe(false);
    const ambiguous = [...classes, { id: 'duplicate', name: '3A' }];
    expect(udaBelongsToActiveClass('3ª A', '3ª A - Secondaria I Grado', ambiguous)).toBe(false);
  });

  test('workspace and legacy visual scopes include canonical aliases and never fall back to all classes', async () => {
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const legacy = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(workspace).toContain("udaBelongsToActiveClass(uda.className, currentClassName, classes)");
    expect(workspace).toContain('classScopedUdaMutationAllowed(udas, nextUdas, currentClassName, classes)');
    expect(legacy).toContain("udaBelongsToActiveClass(uda.className, currentClassName, classes)");
    expect(legacy).toContain('const scopedUdas = currentClassName');
    expect(legacy).toContain('classScopedUdaMutationAllowed(');
    expect(legacy).toContain('const effectiveClassFilter = currentClassName || classFilter');
    expect(legacy).toContain('value={effectiveClassFilter}');
    expect(legacy).toContain('disabled={Boolean(currentClassName)}');
  });

  test('analysis gets the focus callback but must not reopen a prior dossier automatically', async () => {
    const workspace = await Bun.file('src/components/UdaWorkspaceView.tsx').text();
    const start = workspace.indexOf("{activeView === 'analysis' && (");
    const end = workspace.indexOf("{isCreateOpen && (", start);
    const analysis = workspace.slice(start, end);
    expect(analysis).toContain('onTeachingFocusChange={onTeachingFocusChange}');
    expect(analysis).toContain('autoOpenTeachingFocus={false}');
  });

  test('publishing a Gantt selection does not open a second modal over the chosen sheet', async () => {
    const legacy = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(legacy).toContain('locallyPublishedFocusIdRef.current = uda.id');
    expect(legacy).toContain('locallyPublishedFocusIdRef.current === teachingFocus.udaId');
    expect(legacy).toContain('autoOpenTeachingFocus');
  });

  test('the legacy creation flow binds its initial and changed class to currentClassName', async () => {
    const legacy = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(legacy).toContain("useState(currentClassName || classes[0]?.name || '3ª A')");
    expect(legacy).toContain('setNewClass(currentClassName);');
    expect(legacy).toContain("currentClassName && newClass !== currentClassName");
    expect(legacy).toContain('disabled={Boolean(currentClassName)}');
  });

  test('deleting an active-class UDA preserves unrelated historical records without dependencies', () => {
    const local = uda('own', '2Z');
    const foreign = { ...uda('other', '3Z'), dependencies: undefined };
    const original = [local, foreign];
    const next = buildUdaDeletionSnapshot(original, 'own');
    expect(next).toEqual([foreign]);
    expect(next[0]).toBe(foreign);
    expect(next[0]!.dependencies).toBeUndefined();
    expect(classScopedUdaMutationAllowed(original, next, '2Z')).toBe(true);
  });

  test('deletion removes a real dependency only from its owner and refuses foreign mutation', () => {
    const local = uda('own', '2Z');
    const localDependent = { ...uda('local-dependent', '2Z'), dependencies: ['own'] };
    const foreign = { ...uda('foreign', '3Z'), dependencies: undefined };
    const original = [local, localDependent, foreign];
    const next = buildUdaDeletionSnapshot(original, 'own');
    expect(next[0]!.dependencies).toEqual([]);
    expect(next[1]).toBe(foreign);
    expect(classScopedUdaMutationAllowed(original, next, '2Z')).toBe(true);

    const foreignDependent = { ...uda('foreign-dependent', '3Z'), dependencies: ['own'] };
    expect(classScopedUdaMutationAllowed(
      [local, foreignDependent],
      buildUdaDeletionSnapshot([local, foreignDependent], 'own'),
      '2Z'
    )).toBe(false);
  });

  test('class-first cascade refuses foreign dependencies without presenting their UDA data', () => {
    const local = { ...uda('A', '2Z'), dependencies: [] };
    const localChild = { ...uda('A-child', '2Z'), dependencies: ['A'] };
    const foreignChild = { ...uda('B-child', '3Z'), dependencies: ['A-child'] };
    expect(hasForeignUdaDependencyOn([local, localChild, foreignChild], ['A', 'A-child'], '2Z')).toBe(true);
    expect(hasForeignUdaDependencyOn([local, localChild, foreignChild], ['A'], '2Z')).toBe(false);
    expect(hasForeignUdaDependencyOn([local, localChild, foreignChild], ['A', 'A-child'], null)).toBe(false);
    expect(hasForeignUdaDependencyOn([local, localChild], ['A', 'A-child'], '2Z')).toBe(false);
  });

  test('cascade proposal is built only from active-class records and stops at foreign-linked edges', async () => {
    const gantt = await Bun.file('src/components/UdaGanttView.tsx').text();
    const start = gantt.indexOf('const handleRequestDateChange = (');
    const end = gantt.indexOf('// Apply cascade shift proposal', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const handler = gantt.slice(start, end);
    expect(handler).toContain('const parent = scopedUdas.find(');
    expect(handler).toContain('computeCascadeShifts(udaId, clampedStart, clampedDuration, scopedUdas)');
    expect(handler).toContain('hasForeignUdaDependencyOn(');
    expect(handler).toContain('showStatus(');
    expect(handler).not.toContain('computeCascadeShifts(udaId, clampedStart, clampedDuration, udas)');
  });

});
