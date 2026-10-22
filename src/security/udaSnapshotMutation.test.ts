import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import { createUdaSnapshotMutation } from '../persistence/udaSnapshotMutation';

function uda(id: string, title = id, dependencies: string[] = []): UdaRecord {
  return {
    id,
    title,
    className: '2C',
    hours: 10,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 1,
    dependencies
  };
}

describe('PERSIST-01 UDA snapshot mutation intent', () => {
  test('two deletes derived from the same stale snapshot both survive FIFO application', () => {
    const a = uda('a');
    const b = uda('b');
    const base = [a, b];

    const deleteA = createUdaSnapshotMutation(base, [b]);
    const deleteB = createUdaSnapshotMutation(base, [a]);

    const afterA = deleteA(base);
    const afterB = deleteB(afterA);

    expect(afterA.map(item => item.id)).toEqual(['b']);
    expect(afterB).toEqual([]);
  });

  test('independent edits from one stale snapshot do not restore older values', () => {
    const a = uda('a', 'A');
    const b = uda('b', 'B');
    const base = [a, b];

    const editA = createUdaSnapshotMutation(base, [{ ...a, title: 'A1' }, b]);
    const editB = createUdaSnapshotMutation(base, [a, { ...b, title: 'B1' }]);

    const result = editB(editA(base));

    expect(result.map(item => [item.id, item.title])).toEqual([
      ['a', 'A1'],
      ['b', 'B1']
    ]);
  });

  test('cloned but unchanged survivors do not overwrite a prior committed edit', () => {
    const a = uda('a', 'A');
    const b = uda('b', 'B', ['a']);
    const base = [a, b];

    const editB = createUdaSnapshotMutation(base, [a, { ...b, title: 'B1' }]);
    const deleteAFromStaleBase = createUdaSnapshotMutation(base, [{ ...b, dependencies: [] }]);

    const result = deleteAFromStaleBase(editB(base));

    expect(result).toEqual([{ ...b, title: 'B1', dependencies: [] }]);
  });

  test('two dependency removals from the same stale UDA snapshot both survive FIFO application', () => {
    const item = uda('u', 'U', ['a', 'b']);
    const base = [item];

    const removeA = createUdaSnapshotMutation(base, [{ ...item, dependencies: ['b'] }]);
    const removeB = createUdaSnapshotMutation(base, [{ ...item, dependencies: ['a'] }]);

    const result = removeB(removeA(base));

    expect(result[0].dependencies).toEqual([]);
  });

  test('two lesson removals from the same stale UDA snapshot both survive FIFO application', () => {
    const lessonA = { id: 'la', date: '2026-10-01', topic: 'A', hours: 1 };
    const lessonB = { id: 'lb', date: '2026-10-02', topic: 'B', hours: 1 };
    const item: UdaRecord = { ...uda('u'), lessons: [lessonA, lessonB] };
    const base = [item];

    const removeA = createUdaSnapshotMutation(base, [{ ...item, lessons: [lessonB] }]);
    const removeB = createUdaSnapshotMutation(base, [{ ...item, lessons: [lessonA] }]);

    const result = removeB(removeA(base));

    expect(result[0].lessons).toEqual([]);
  });

  test('App converts UDA snapshots into execution-time mutations', async () => {
    const source = await Bun.file('src/App.tsx').text();

    expect(source).toContain("import { createUdaSnapshotMutation } from './persistence/udaSnapshotMutation';");
    expect(source).toContain('const commitUdasMutation = useCallback((derive: (current: UdaRecord[]) => UdaRecord[])');
    expect(source).toContain('const mutation = createUdaSnapshotMutation(udasRef.current, newUdas);');
    expect(source).toContain('return commitUdasMutation(mutation).then(() => undefined);');
  });
});
