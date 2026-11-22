/**
 * AUDIT-PRE-01 / AP-01 — deterministic synthetic concurrency contract.
 *
 * No installed vault, real teacher data, network access or migration.
 * The synchronous transaction owner below models the real add-if-empty
 * guarantee in IndexedDbVaultStore.claimInitialMetadata. Browser qualification
 * remains necessary to establish the real IndexedDB behavior.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SecureVault } from './secureVault';
import type { VaultMetadataV1 } from './vaultTypes';
import type { VaultStore } from './vaultStore';

type Shared = {
  metadata: VaultMetadataV1 | null;
  records: number;
  reads: number;
  release: () => void;
  bothRead: Promise<void>;
};

function sharedState(records = 0): Shared {
  let release!: () => void;
  const bothRead = new Promise<void>(resolve => { release = resolve; });
  return { metadata: null, records, reads: 0, release, bothRead };
}

function storeFor(shared: Shared) {
  const store = {
    async getMetadata(): Promise<VaultMetadataV1 | null> {
      shared.reads++;
      if (shared.reads === 2) shared.release();
      // Force two separate creators to read the same initially empty state.
      if (shared.records === 0) await shared.bothRead;
      return shared.metadata;
    },
    async putMetadata(): Promise<void> {
      throw new Error('AP-01: the non-atomic metadata.put route is forbidden for initial reservation.');
    },
    async claimInitialMetadata(candidate: VaultMetadataV1): Promise<void> {
      if (candidate.state !== 'STAGING' || shared.metadata !== null || shared.records !== 0) {
        throw new Error('AP-01: archive belongs to another creator or contains records.');
      }
      // This synchronous decision represents the single readwrite IDB
      // transaction implemented by the production claimInitialMetadata.
      shared.metadata = candidate;
    }
  };
  return store as typeof store & VaultStore;
}

describe('AUDIT-PRE-01 / AP-01: initial vault authority', () => {
  test('the real application root supplies the atomic reservation port', () => {
    const root = readFileSync('src/components/SecureRegistroRoot.tsx', 'utf8');
    const runtime = root.match(/const getRuntime = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/)?.[1];
    expect(runtime).toBeDefined();
    expect(runtime).toMatch(/new SecureVault\(store,\s*metadata => store\.claimInitialMetadata\(metadata\)\)/);
    expect(runtime).not.toContain('new SecureVault(storeRef.current)');
  });

  test('two creators that both observed empty storage cannot both reserve it', async () => {
    const shared = sharedState();
    const firstStore = storeFor(shared), secondStore = storeFor(shared);
    const first = new SecureVault(firstStore, metadata => firstStore.claimInitialMetadata(metadata));
    const second = new SecureVault(secondStore, metadata => secondStore.claimInitialMetadata(metadata));
    const outcomes = await Promise.allSettled([
      first.createStaging('synthetic-first-passphrase'),
      second.createStaging('synthetic-second-passphrase')
    ]);
    expect(shared.reads).toBe(2);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect(shared.metadata?.state).toBe('STAGING');
    expect([first.isUnlocked(), second.isUnlocked()].filter(Boolean)).toHaveLength(1);
    expect(shared.records).toBe(0);
  });

  test('an orphaned physical record without metadata cannot be overwritten by setup', async () => {
    const shared = sharedState(1);
    const store = storeFor(shared);
    const creator = new SecureVault(store, metadata => store.claimInitialMetadata(metadata));
    await expect(creator.createStaging('synthetic-password')).rejects.toThrow(/archive belongs/);
    expect(shared.metadata).toBeNull();
    expect(shared.records).toBe(1);
    expect(creator.isUnlocked()).toBe(false);
  });
});
