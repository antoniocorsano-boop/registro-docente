import { describe, expect, test } from 'bun:test';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';

function requireEnqueueTask(coordinator: ReturnType<typeof createDurableMutationCoordinator>) {
  const enqueueTask = (coordinator as unknown as {
    enqueueTask?: <T>(task: () => Promise<T> | T) => Promise<T>;
  }).enqueueTask;

  expect(typeof enqueueTask).toBe('function');
  return enqueueTask!.bind(coordinator);
}

describe('PERSIST-01H serialized application task contract', () => {
  test('serialized task waits for an earlier mutation before reading committed state', async () => {
    const coordinator = createDurableMutationCoordinator();
    const enqueueTask = requireEnqueueTask(coordinator);
    let committed = 0;
    let releasePersist!: () => void;
    const persistGate = new Promise<void>(resolve => { releasePersist = resolve; });

    const mutation = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => persistGate,
      publish: candidate => { committed = candidate; }
    });

    const checkpoint = enqueueTask(() => committed);

    await Promise.resolve();
    expect(committed).toBe(0);

    releasePersist();
    await expect(mutation).resolves.toBe(1);
    await expect(checkpoint).resolves.toBe(1);
  });

  test('mutation enqueued after a serialized task waits for the task', async () => {
    const coordinator = createDurableMutationCoordinator();
    const enqueueTask = requireEnqueueTask(coordinator);
    const events: string[] = [];
    let committed = 0;
    let releaseTask!: () => void;
    const taskGate = new Promise<void>(resolve => { releaseTask = resolve; });

    const task = enqueueTask(async () => {
      events.push('task:start');
      await taskGate;
      events.push('task:end');
    });

    const mutation = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => { events.push('mutation:persist'); },
      publish: candidate => {
        committed = candidate;
        events.push('mutation:publish');
      }
    });

    await Promise.resolve();
    expect(events).toEqual(['task:start']);

    releaseTask();
    await task;
    await expect(mutation).resolves.toBe(1);
    expect(events).toEqual(['task:start', 'task:end', 'mutation:persist', 'mutation:publish']);
  });

  test('rejected serialized task does not poison later mutation', async () => {
    const coordinator = createDurableMutationCoordinator();
    const enqueueTask = requireEnqueueTask(coordinator);
    let committed = 7;
    const sentinel = new Error('checkpoint failed');

    const task = enqueueTask(async () => { throw sentinel; });
    const mutation = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => undefined,
      publish: candidate => { committed = candidate; }
    });

    await expect(task).rejects.toBe(sentinel);
    await expect(mutation).resolves.toBe(8);
    expect(committed).toBe(8);
  });
});
