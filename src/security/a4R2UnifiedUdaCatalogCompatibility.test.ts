import { describe, expect, test } from 'bun:test';
import { buildTeachingUdaCatalog } from '../teaching/teachingUdaCatalog';
import type { ClassData, UdaRecord } from '../types';

function classData(id: string, name: string): ClassData {
  return { id, name, students: [], grades: [], behaviors: [] };
}

function localUda(className: string): UdaRecord {
  return {
    id: 'local-aic-07',
    title: 'Agricoltura come sistema tecnologico AIC-07',
    className,
    hours: 8,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 2
  };
}

describe('A4-R2B unified UDA catalog preserves A4-R2A local class authority', () => {
  test('a local UDA keeps its unique exact real-class binding even when the class name is not semantically parsable', () => {
    const className = '2C Sintetica AIC-07';
    const catalog = buildTeachingUdaCatalog({
      localUdas: [localUda(className)],
      acceptedProjections: [],
      classReconciliation: {},
      classes: [classData('class-aic-07', className)]
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: 'local-aic-07',
      origin: 'registro',
      classId: 'class-aic-07',
      classLabel: className,
      className,
      writableByRegistro: true
    });
  });
});
