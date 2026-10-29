import { describe, expect, test } from 'bun:test';
import type { ClassData, UdaRecord } from '../types';
import {
  buildTeacherFirstTeachingCatalog,
  udasForCanonicalClass
} from './teacherFirstTeachingCatalog';

const realClass = (id: string, name: string): ClassData => ({ id, name } as ClassData);
const uda = (id: string, className: string): UdaRecord => ({ id, title: id, className } as UdaRecord);

describe('A4-R2A teacher-first canonical teaching catalog', () => {
  test('keeps real Registro classes selectable once and reconciles a legacy ordinal UDA label', () => {
    const legacy = uda('uda-legacy', '1ª A');
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-1a', '1A'), realClass('class-1c', '1C')],
      udas: [legacy]
    });

    expect(catalog.classes.map(entry => ({ id: entry.classId, label: entry.label }))).toEqual([
      { id: 'class-1a', label: '1A' },
      { id: 'class-1c', label: '1C' }
    ]);
    expect(catalog.classes.flatMap(entry => entry.aliases)).toContain('1ª A');
    expect(catalog.classes.some(entry => entry.label === '1ª A')).toBe(false);
    expect(udasForCanonicalClass(catalog, 'class-1a')).toEqual([legacy]);
  });

  test('fails closed when two real class ids share a semantic key', () => {
    const legacy = uda('uda-3a', '3 A');
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-3a-compact', '3A'), realClass('class-3a-ordinal', '3ª A')],
      udas: [legacy]
    });

    expect(catalog.classes).toEqual([]);
    expect(catalog.ambiguities).toHaveLength(1);
    expect(catalog.ambiguities[0]?.semanticKey).toBe('3:A');
    expect(catalog.ambiguities[0]?.classIds.slice().sort()).toEqual([
      'class-3a-compact',
      'class-3a-ordinal'
    ]);
    expect(udasForCanonicalClass(catalog, 'class-3a-compact')).toEqual([]);
    expect(udasForCanonicalClass(catalog, 'class-3a-ordinal')).toEqual([]);
  });

  test('preserves unsupported legacy labels as unresolved instead of inventing a class target', () => {
    const orphan = uda('uda-orphan', 'prima A gruppo');
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-1a', '1A')],
      udas: [orphan]
    });

    expect(catalog.classes.map(entry => entry.classId)).toEqual(['class-1a']);
    expect(catalog.unresolvedUdaIds).toEqual(['uda-orphan']);
    expect(udasForCanonicalClass(catalog, 'class-1a')).toEqual([]);
  });
});
