import { describe, expect, test } from 'bun:test';
import {
  buildMigrationInvariants,
  collectLegacySnapshot,
  sanitizeLegacySnapshot,
  validateLegacySnapshot,
  type KeyValueStorage
} from './legacyMigration';
import {
  CUSTOM_TESTS_KEY,
  META_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  UDA_KEY
} from '../utils';

class MemoryLegacyStorage implements KeyValueStorage {
  readonly removed: string[] = [];
  constructor(private readonly values = new Map<string, string>()) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.removed.push(key);
    this.values.delete(key);
  }
}

describe('SEC-1 legacy snapshot', () => {
  test('fails closed on malformed JSON without deleting legacy data', () => {
    const storage = new MemoryLegacyStorage(new Map([[STORAGE_KEY, '{not-json']])) ;

    expect(() => collectLegacySnapshot(storage)).toThrow('JSON');
    expect(storage.removed).toEqual([]);
  });

  test('accepts missing optional legacy keys and identifies present datasets', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [STORAGE_KEY, JSON.stringify({ classes: [], currentClassId: null })],
        [SETTINGS_KEY, JSON.stringify({ teacher: 'Docente' })]
      ])
    );

    const snapshot = collectLegacySnapshot(storage);
    const validation = validateLegacySnapshot(snapshot);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(snapshot.presentKeys).toEqual([STORAGE_KEY, SETTINGS_KEY]);
    expect(snapshot.customTests).toBeUndefined();
    expect(snapshot.udas).toBeUndefined();
    expect(snapshot.submissions).toBeUndefined();
    expect(snapshot.meta).toBeUndefined();
  });

  test('computes migration invariants for personal and professional datasets', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [STORAGE_KEY, JSON.stringify({
          classes: [
            {
              id: '2c',
              name: '2C',
              students: [{ id: 's1', name: 'Mario Rossi' }, { id: 's2', name: 'Anna Verdi' }],
              grades: [{ id: 'g1', studentId: 's1' }, { id: 'g2', studentId: 's2' }],
              behaviors: [{ id: 'b1', studentId: 's1' }]
            }
          ],
          currentClassId: '2c'
        })],
        [SUBMISSIONS_KEY, JSON.stringify([{ id: 'sub1' }, { id: 'sub2' }])],
        [UDA_KEY, JSON.stringify([{ id: 'u1' }])],
        [CUSTOM_TESTS_KEY, JSON.stringify({ t1: { id: 't1' } })],
        [META_KEY, JSON.stringify({ changes: 3, lastBackup: null })]
      ])
    );

    const invariants = buildMigrationInvariants(collectLegacySnapshot(storage));

    expect(invariants).toEqual({
      classes: 1,
      students: 2,
      grades: 2,
      behaviors: 1,
      submissions: 2,
      udas: 1
    });
  });

  test('strips embedding API keys without mutating the legacy snapshot', () => {
    const storage = new MemoryLegacyStorage(
      new Map([
        [SETTINGS_KEY, JSON.stringify({
          teacher: 'Docente',
          embeddingConfig: {
            provider: 'local',
            endpointUrl: 'http://127.0.0.1:8080',
            modelName: 'model.gguf',
            apiType: 'llama.cpp',
            enabled: true,
            apiKey: 'legacy-secret'
          }
        })]
      ])
    );

    const snapshot = collectLegacySnapshot(storage);
    const sanitized = sanitizeLegacySnapshot(snapshot);

    expect(sanitized.settings?.embeddingConfig?.apiKey).toBeUndefined();
    expect(snapshot.settings?.embeddingConfig?.apiKey).toBe('legacy-secret');
  });
});
