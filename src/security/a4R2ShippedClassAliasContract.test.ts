import { describe, expect, test } from 'bun:test';
import type { ClassData, UdaRecord } from '../types';
import { parseLowerSecondaryClassSemanticKey } from '../teaching/classIdentity';
import {
  buildTeacherFirstTeachingCatalog,
  udasForCanonicalClass
} from '../copilot/teacherFirstTeachingCatalog';
import { resolveTeacherFirstRequest } from '../copilot/teacherFirstRequest';

const realClass = (id: string, name: string): ClassData => ({ id, name } as ClassData);
const uda = (id: string, className: string): UdaRecord => ({ id, title: id, className } as UdaRecord);

describe('A4-R2A shipped class and alias compatibility', () => {
  test('the shipped decorated lower-secondary class label keeps its semantic identity', () => {
    expect(parseLowerSecondaryClassSemanticKey('3ª A - Secondaria I Grado')).toBe('3:A');
  });

  test('an untouched shipped class can see its legacy short-label UDA without inventing a new class id', () => {
    const legacy = uda('uda-3a', '3ª A');
    const catalog = buildTeacherFirstTeachingCatalog({
      classes: [realClass('class-3a-shipped', '3ª A - Secondaria I Grado')],
      udas: [legacy]
    });

    expect(catalog.classes).toHaveLength(1);
    expect(catalog.classes[0]?.classId).toBe('class-3a-shipped');
    expect(catalog.classes[0]?.label).toBe('3ª A - Secondaria I Grado');
    expect(udasForCanonicalClass(catalog, 'class-3a-shipped').map(item => item.id)).toEqual(['uda-3a']);
  });

  test('spacing and ordinal spellings resolve to the canonical first class without dropping another requested class', () => {
    expect(resolveTeacherFirstRequest('Attività per 3 A e 3C', ['3A', '3 A', '3ª A', '3C']).classCandidates)
      .toEqual(['3A', '3C']);
    expect(resolveTeacherFirstRequest('Attività per 3ª A e 3C', ['3A', '3 A', '3ª A', '3C']).classCandidates)
      .toEqual(['3A', '3C']);
  });
});
