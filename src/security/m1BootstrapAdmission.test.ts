import { describe, expect, test } from 'bun:test';
import { decideVaultBootstrap } from './secureAppStorage';

/**
 * M1-B1 causal RED contract: an absent metadata record is not sufficient
 * evidence that it is safe to offer creation of a new professional archive.
 *
 * These tests run on the actual bootstrap decision, not a missing experimental
 * module. They use no existing user data, files, secrets or real archive.
 * The next GREEN must also make the real Root collect this evidence safely,
 * before it opens or creates any IndexedDB structures.
 */
const firstObservation = {
  metadataState: null as null,
  hasLegacyData: false,
  indexedDbAvailable: true,
  webCryptoAvailable: true
};

describe('M1-B1 archive admission: preserve a previously established archive', () => {
  test('permits explicit first setup when origin is genuinely new', () => {
    expect(decideVaultBootstrap(firstObservation)).toBe('SETUP_REQUIRED');
  });

  test('rejects new setup when metadata disappeared but the archive was established', () => {
    const observation = { ...firstObservation, archivePreviouslyEstablished: true };
    expect(decideVaultBootstrap(observation)).toBe('ERROR');
  });

  test('rejects new setup when a physical archive is incomplete', () => {
    const observation = { ...firstObservation, physicalArchiveStatus: 'incomplete' as const };
    expect(decideVaultBootstrap(observation)).toBe('ERROR');
  });

  test('rejects new setup when physical archive inventory cannot be verified', () => {
    const observation = { ...firstObservation, physicalArchiveStatus: 'unverifiable' as const };
    expect(decideVaultBootstrap(observation)).toBe('ERROR');
  });
});
