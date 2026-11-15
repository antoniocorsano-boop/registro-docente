export interface DurableMutation<T> {
  getCommitted: () => T;
  derive: (committed: T) => T;
  persist: (candidate: T, previous: T) => Promise<void>;
  publish: (candidate: T, previous: T) => void;
  afterCommit?: (candidate: T, previous: T) => void;
}

export interface SuspendedMutationLease {
  /** Settles all work admitted before suspension, without claiming success. */
  readonly drained: Promise<void>;
  /** One-use resumption, permitted only after settlement and authentication by the owner. */
  resume(): boolean;
}

export interface DurableMutationCoordinator {
  enqueue<T>(mutation: DurableMutation<T>): Promise<T>;
  enqueueTask<T>(task: () => Promise<T> | T): Promise<T>;
  /** Permanently close admission and await settlement of already admitted work. */
  sealAndDrain(): Promise<void>;
  pauseAndDrain(): SuspendedMutationLease;
}

export function createDurableMutationCoordinator(): DurableMutationCoordinator {
  let tail: Promise<void> = Promise.resolve();
  let sealed = false;
  let suspended: SuspendedMutationLease | null = null;
  const admissionError = () => new Error('Sessione in chiusura: nessuna nuova modifica accettata.');

  return {
    enqueue<T>(mutation: DurableMutation<T>): Promise<T> {
      if (sealed || suspended) return Promise.reject(admissionError());
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
      if (sealed || suspended) return Promise.reject(admissionError());
      const run = tail.then(task, task);
      tail = run.then(() => undefined, () => undefined);
      return run;
    },

    sealAndDrain(): Promise<void> {
      sealed = true;
      // Settlement is not a success receipt: each admitted caller retains
      // its own result. A later unlock must create a fresh coordinator.
      return tail;
    },

    pauseAndDrain(): SuspendedMutationLease {
      if (suspended) return suspended;
      let settled = false;
      const drained = tail.then(() => { settled = true; });
      const lease: SuspendedMutationLease = {
        drained,
        resume(): boolean {
          if (sealed || !settled || suspended !== lease) return false;
          suspended = null;
          return true;
        }
      };
      suspended = lease;
      return lease;
    }
  };
}
