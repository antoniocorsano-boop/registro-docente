export interface DurableMutation<T> {
  getCommitted: () => T;
  derive: (committed: T) => T;
  persist: (candidate: T, previous: T) => Promise<void>;
  publish: (candidate: T, previous: T) => void;
  afterCommit?: (candidate: T, previous: T) => void;
}

export interface DurableMutationCoordinator {
  enqueue<T>(mutation: DurableMutation<T>): Promise<T>;
  enqueueTask<T>(task: () => Promise<T> | T): Promise<T>;
}

export function createDurableMutationCoordinator(): DurableMutationCoordinator {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(mutation: DurableMutation<T>): Promise<T> {
      const run = tail.then(async () => {
        const previous = mutation.getCommitted();
        const candidate = mutation.derive(previous);
        await mutation.persist(candidate, previous);
        mutation.publish(candidate, previous);
        mutation.afterCommit?.(candidate, previous);
        return candidate;
      }, async () => {
        const previous = mutation.getCommitted();
        const candidate = mutation.derive(previous);
        await mutation.persist(candidate, previous);
        mutation.publish(candidate, previous);
        mutation.afterCommit?.(candidate, previous);
        return candidate;
      });

      tail = run.then(() => undefined, () => undefined);
      return run;
    },

    enqueueTask<T>(task: () => Promise<T> | T): Promise<T> {
      const run = tail.then(task, task);
      tail = run.then(() => undefined, () => undefined);
      return run;
    }
  };
}
