import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01H UDA queued action integrity', () => {
  test('distinct UDA actions serialize behind text saves without overwriting either intent', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const boundary = sectionBetween(source, '// Quick toast message inside UdaGanttView', '// Embedding configuration');
    const textQueue = sectionBetween(boundary, 'const queueUdaTextMutation', 'const commitUdaViewMutation');
    const actionQueue = boundary.slice(boundary.indexOf('const commitUdaViewMutation'));

    expect(source).toContain("import { createUdaSnapshotMutation } from '../persistence/udaSnapshotMutation';");
    expect(boundary).toContain('udaCommittedSnapshotRef');

    expect(textQueue).toContain('const mutation = createUdaSnapshotMutation(udas, nextUdas);');
    expect(textQueue).toContain('nextUdas = mutation(udaCommittedSnapshotRef.current);');
    expect(textQueue).toContain('.then(() => onSaveUdas(nextUdas));');
    expect(textQueue).not.toContain('udaMutationPendingRef.current = true;');

    expect(actionQueue).not.toContain('if (udaMutationPendingRef.current) return false;');
    expect(actionQueue).toContain('const mutation = createUdaSnapshotMutation(udas, nextUdas);');
    expect(actionQueue).toContain('const actionTask = udaTextMutationTailRef.current');
    expect(actionQueue).toContain('nextUdas = mutation(udaCommittedSnapshotRef.current);');
    expect(actionQueue).toContain('udaTextMutationTailRef.current = actionTask.catch(() => undefined);');
    expect(actionQueue).toContain('await actionTask;');
    expect(boundary).toContain('udaActionMutationDepthRef');
    expect(actionQueue).toContain('udaActionMutationDepthRef.current += 1;');
    expect(actionQueue).toContain('udaActionMutationDepthRef.current = Math.max(0, udaActionMutationDepthRef.current - 1);');
  });

  test('queue reseeding uses the latest rendered UDA snapshot instead of an async handler stale closure', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const boundary = sectionBetween(source, '// Quick toast message inside UdaGanttView', '// Embedding configuration');

    expect(boundary).toContain('const udaLatestSnapshotRef = useRef(udas);');
    expect(boundary).toContain('udaLatestSnapshotRef.current = udas;');
    expect(boundary.match(/udaCommittedSnapshotRef\.current = udaLatestSnapshotRef\.current;/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(boundary).not.toContain('udaCommittedSnapshotRef.current = udas;');
  });

  test('relative UDA date controls freeze while an action save is pending', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();

    expect(source).toContain('disabled={isSavingUda}');
    expect(source).toContain('disabled={start <= 0 || isSavingUda}');
    expect(source).toContain('disabled={start + duration >= 10 || isSavingUda}');
    expect(source).toContain('disabled={(u.startMonth || 0) <= 0 || isSavingUda}');
    expect(source).toContain('disabled={u.durationMonths <= 1 || isSavingUda}');
    expect(source).toContain('disabled={(u.startMonth || 0) + u.durationMonths >= 10 || isSavingUda}');
  });
});