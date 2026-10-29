import { describe, expect, test } from 'bun:test';
import type { ClassData, UdaRecord } from '../types';
import {
  buildTeacherFirstTeachingCatalog,
  udasForCanonicalClass
} from '../copilot/teacherFirstTeachingCatalog';

const realClass = (id: string, name: string): ClassData => ({ id, name } as ClassData);
const uda = (id: string, className: string): UdaRecord => ({ id, title: id, className } as UdaRecord);

describe('A4-R2A PREDEPLOY teacher-first catalog contract', () => {
  test('a legacy 1ª A UDA belongs to the unique real 1A class without becoming a duplicate class choice', () => {
    const legacy = uda('uda-legacy', '1ª A');
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-1a', '1A'), realClass('class-1c', '1C')],
      udas: [legacy]
    });

    expect(catalog.classes.map(entry => entry.label)).toEqual(['1A', '1C']);
    expect(udasForCanonicalClass(catalog, 'class-1a').map(item => item.id)).toEqual(['uda-legacy']);
  });

  test('a semantic collision between two real class ids is fail-closed', () => {
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-3a-compact', '3A'), realClass('class-3a-ordinal', '3ª A')],
      udas: [uda('uda-3a', '3A')]
    });

    expect(catalog.ambiguities).toHaveLength(1);
    expect(catalog.classes).toHaveLength(0);
    expect(udasForCanonicalClass(catalog, 'class-3a-compact')).toEqual([]);
  });
});
