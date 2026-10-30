import { describe, expect, test } from 'bun:test';
import {
  parseLowerSecondaryClassSemanticKey,
  resolveCanonicalRegistroClass
} from '../teaching/classIdentity';

describe('A4-R2A PREDEPLOY canonical class identity contract', () => {
  test('treats 1A and 1ª A as one semantic class while keeping the real Registro id authoritative', () => {
    expect(parseLowerSecondaryClassSemanticKey('1A')).toBe('1:A');
    expect(parseLowerSecondaryClassSemanticKey('1ª A')).toBe('1:A');
    expect(resolveCanonicalRegistroClass('1ª A', [
      { id: 'class-1a', name: '1A' },
      { id: 'class-1c', name: '1C' }
    ])).toMatchObject({
      status: 'resolved',
      semanticKey: '1:A',
      classId: 'class-1a',
      label: '1A'
    });
  });

  test('fails closed when two real class ids share one semantic key', () => {
    const result = resolveCanonicalRegistroClass('3ª A', [
      { id: 'class-3a-1', name: '3A' },
      { id: 'class-3a-2', name: '3ª A' }
    ]);
    expect(result.status).toBe('ambiguous');
  });
});
