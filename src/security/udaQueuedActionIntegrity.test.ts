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
    const actionQueue = sectionBetween(boundary, 'const commitUdaViewMutation', '// Embedding configuration');

    expect(source).toContain("import { createUdaSnapshotMutation } from '../persistence/udaSnapshotMutation';");
    expect(boundary).toContain('udaCommittedSnapshotRef');

    expect(textQueue).toContain('const mutation = createUdaSnapshotMutation(udas, nextUdas);');
    expect(textQueue).toContain('nextUdas = mutation(udaCommittedSnapshotRef.current);');
    expect(textQueue).toContain('.then(() => onSaveUdas(nextUdas));');
    expect(textQueue).not.toContain('udaMutationPendingRef.current = true;');

    expect(actionQueue).toContain('if (udaMutationPendingRef.current) return false;');
    expect(actionQueue).toContain('const mutation = createUdaSnapshotMutation(udas, nextUdas);');
    expect(actionQueue).toContain('const actionTask = udaTextMutationTailRef.current');
    expect(actionQueue).toContain('nextUdas = mutation(udaCommittedSnapshotRef.current);');
    expect(actionQueue).toContain('udaTextMutationTailRef.current = actionTask.catch(() => undefined);');
    expect(actionQueue).toContain('await actionTask;');
  });
});
