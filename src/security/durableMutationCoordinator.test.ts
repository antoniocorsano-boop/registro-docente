import { describe, expect, test } from 'bun:test';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';

describe('PERSIST-01 durable mutation coordinator', () => {
  test('publishes only after persistence resolves', async () => {
    const coordinator = createDurableMutationCoordinator();
    let committed = 0;
    const events: string[] = [];
    let releasePersist!: () => void;
    const persistGate = new Promise<void>(resolve => { releasePersist = resolve; });

    const pending = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => {
        events.push('persist:start');
        await persistGate;
        events.push('persist:end');
      },
      publish: candidate => {
        committed = candidate;
        events.push('publish');
      },
      afterCommit: () => events.push('afterCommit')
    });

    await Promise.resolve();
    expect(committed).toBe(0);
    expect(events).toEqual(['persist:start']);

    releasePersist();
    await expect(pending).resolves.toBe(1);
    expect(committed).toBe(1);
    expect(events).toEqual(['persist:start', 'persist:end', 'publish', 'afterCommit']);
  });

  test('reads committed state when queued work starts', async () => {
    const coordinator = createDurableMutationCoordinator();
    let committed = 0;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });

    const first = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => firstGate,
      publish: candidate => { committed = candidate; }
    });

    const second = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => undefined,
      publish: candidate => { committed = candidate; }
    });

    releaseFirst();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(committed).toBe(2);
  });

  test('does not publish a rejected candidate and later work still runs', async () => {
    const coordinator = createDurableMutationCoordinator();
    let committed = 4;
    let firstPublished = false;

    const first = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 10,
      persist: async () => { throw new Error('vault locked'); },
      publish: candidate => {
        firstPublished = true;
        committed = candidate;
      }
    });

    const second = coordinator.enqueue({
      getCommitted: () => committed,
      derive: previous => previous + 1,
      persist: async () => undefined,
      publish: candidate => { committed = candidate; }
    });

    await expect(first).rejects.toThrow('vault locked');
    expect(firstPublished).toBe(false);
    await expect(second).resolves.toBe(5);
    expect(committed).toBe(5);
  });

  test('caller receives the original persistence error', async () => {
    const coordinator = createDurableMutationCoordinator();
    const sentinel = new Error('sentinel persistence failure');

    const result = coordinator.enqueue({
      getCommitted: () => 1,
      derive: previous => previous + 1,
      persist: async () => { throw sentinel; },
      publish: () => { throw new Error('must not publish'); }
    });

    await expect(result).rejects.toBe(sentinel);
  });
});
