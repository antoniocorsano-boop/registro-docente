import { describe, expect, test } from 'bun:test';
import {
  parseLowerSecondaryClassSemanticKey,
  resolveCanonicalRegistroClass
} from './classIdentity';

describe('A4-R2A canonical lower-secondary class identity', () => {
  test('parses supported compact and ordinal class labels to the same semantic key', () => {
    for (const label of ['1A', '1 A', '1ª A', '1a', ' 1ª   a ']) {
      expect(parseLowerSecondaryClassSemanticKey(label)).toBe('1:A');
    }
    for (const label of ['3A', '3ª A']) {
      expect(parseLowerSecondaryClassSemanticKey(label)).toBe('3:A');
    }
  });

  test('rejects labels that do not encode one unambiguous lower-secondary grade and section', () => {
    for (const label of ['', 'prima A gruppo', '4A', '1AB', '1-A-extra', 'classe 1 A']) {
      expect(parseLowerSecondaryClassSemanticKey(label)).toBeNull();
    }
  });

  test('resolves a variant label to the single real Registro class id', () => {
    expect(resolveCanonicalRegistroClass('1ª A', [
      { id: 'class-1a', name: '1A' },
      { id: 'class-1c', name: '1C' }
    ])).toEqual({
      status: 'resolved',
      semanticKey: '1:A',
      classId: 'class-1a',
      label: '1A',
      aliases: ['1ª A', '1A']
    });
  });

  test('returns ambiguous when two real class ids share the same semantic key', () => {
    const result = resolveCanonicalRegistroClass('3A', [
      { id: 'class-3a-compact', name: '3A' },
      { id: 'class-3a-ordinal', name: '3ª A' }
    ]);

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') throw new Error('expected ambiguous resolution');
    expect(result.semanticKey).toBe('3:A');
    expect(result.candidates.map(candidate => candidate.classId).sort()).toEqual([
      'class-3a-compact',
      'class-3a-ordinal'
    ]);
  });

  test('returns unresolved when the source label cannot be parsed or has no real class candidate', () => {
    expect(resolveCanonicalRegistroClass('prima A gruppo', [
      { id: 'class-1a', name: '1A' }
    ])).toEqual({ status: 'unresolved', sourceLabel: 'prima A gruppo', semanticKey: null });

    expect(resolveCanonicalRegistroClass('2C', [
      { id: 'class-1a', name: '1A' }
    ])).toEqual({ status: 'unresolved', sourceLabel: '2C', semanticKey: '2:C' });
  });
});
