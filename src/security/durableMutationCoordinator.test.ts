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

describe('SEC-SESSION-01 mutation admission boundary', () => {
  test('seals synchronously, drains only already admitted mutations and tasks', async () => {
    const coordinator = createDurableMutationCoordinator();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let committed = 0;
    const first = coordinator.enqueue({
      getCommitted: () => committed, derive: value => value + 1,
      persist: () => pending, publish: value => { committed = value; }
    });
    const checkpoint = coordinator.enqueueTask(() => committed);
    const drain = coordinator.sealAndDrain();
    let settled = false;
    void drain.then(() => { settled = true; });
    await expect(coordinator.enqueueTask(() => { throw new Error('must not execute'); }))
      .rejects.toThrow('Sessione in chiusura');
    await expect(coordinator.enqueue({
      getCommitted: () => committed, derive: () => 100,
      persist: async () => { throw new Error('must not execute'); },
      publish: value => { committed = value; }
    })).rejects.toThrow('Sessione in chiusura');
    expect(settled).toBe(false);
    expect(committed).toBe(0);
    release();
    await expect(first).resolves.toBe(1);
    await expect(checkpoint).resolves.toBe(1);
    await drain;
    expect(settled).toBe(true);
    expect(committed).toBe(1);
    expect(coordinator.sealAndDrain()).toBe(drain);
    await expect(coordinator.enqueueTask(() => 2)).rejects.toThrow('Sessione in chiusura');
  });

  test('drain means settlement, never turns a failed write into success', async () => {
    const coordinator = createDurableMutationCoordinator();
    const failure = new Error('archive write failed');
    let published = false;
    const task = coordinator.enqueue({
      getCommitted: () => 0, derive: () => 1,
      persist: async () => { throw failure; },
      publish: () => { published = true; }
    });
    const drain = coordinator.sealAndDrain();
    await expect(task).rejects.toBe(failure);
    await drain;
    expect(published).toBe(false);
    const newSession = createDurableMutationCoordinator();
    await expect(newSession.enqueueTask(() => 'fresh')).resolves.toBe('fresh');
    await expect(coordinator.enqueueTask(() => 'stale')).rejects.toThrow('Sessione in chiusura');
  });
});

describe('SEC-SESSION-01 temporary admission suspension', () => {
  test('preserves admitted work, rejects new tasks, permits only settled one-use resumption', async () => {
    const c = createDurableMutationCoordinator();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const task = c.enqueueTask(async () => { await gate; return 'saved'; });
    const lease = c.pauseAndDrain();
    expect(c.pauseAndDrain()).toBe(lease);
    expect(lease.resume()).toBe(false);
    await expect(c.enqueueTask(() => 'forbidden')).rejects.toThrow();
    release();
    await expect(task).resolves.toBe('saved');
    await lease.drained;
    expect(lease.resume()).toBe(true);
    expect(lease.resume()).toBe(false);
    await expect(c.enqueueTask(() => 'new')).resolves.toBe('new');
    const second = c.pauseAndDrain();
    await second.drained;
    expect(lease.resume()).toBe(false);
    expect(second.resume()).toBe(true);
  });
  test('permanent closure invalidates temporary suspension', async () => {
    const c = createDurableMutationCoordinator();
    const lease = c.pauseAndDrain();
    await c.sealAndDrain();
    await lease.drained;
    expect(lease.resume()).toBe(false);
    await expect(c.enqueueTask(() => 'forbidden')).rejects.toThrow();
  });
  test('a failed admitted operation settles but never becomes successful', async () => {
    const c = createDurableMutationCoordinator();
    const pending = c.enqueueTask(() => { throw Error('synthetic failure'); });
    const lease = c.pauseAndDrain();
    await expect(pending).rejects.toThrow('synthetic failure');
    await lease.drained;
    expect(lease.resume()).toBe(true);
  });
});
