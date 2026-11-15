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
  /** Permanently close admission and await settlement of already admitted work. */
  sealAndDrain(): Promise<void>;
}

export function createDurableMutationCoordinator(): DurableMutationCoordinator {
  let tail: Promise<void> = Promise.resolve();
  let sealed = false;
  const admissionError = () => new Error('Sessione in chiusura: nessuna nuova modifica accettata.');

  return {
    enqueue<T>(mutation: DurableMutation<T>): Promise<T> {
      if (sealed) return Promise.reject(admissionError());
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
      if (sealed) return Promise.reject(admissionError());
      const run = tail.then(task, task);
      tail = run.then(() => undefined, () => undefined);
      return run;
    },

    sealAndDrain(): Promise<void> {
      sealed = true;
      // Settlement is not a success receipt: each admitted caller retains
      // its own result. A later unlock must create a fresh coordinator.
      return tail;
    }
  };
}
