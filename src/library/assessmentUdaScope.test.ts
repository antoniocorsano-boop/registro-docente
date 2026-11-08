import { describe, expect, test } from 'bun:test';
import {
  isAssessmentUdaForClass,
  isAssessmentUdaSelectionAllowed,
  normalizeAssessmentClassName
} from './assessmentUdaScope';

const udas = [
  { id: 'uda-a1', className: '3ª A' },
  { id: 'uda-a2', className: '3ª A' },
  { id: 'uda-b', className: '3ª B' },
  { id: 'uda-aa', className: '3ª AA' }
];

describe('INT-02/S1: UDA class scope', () => {
  test('matches long and short names for the same class only', () => {
    expect(normalizeAssessmentClassName('3ª A - Secondaria I Grado')).toBe('3a');
    expect(normalizeAssessmentClassName('3ª A – Secondaria I Grado')).toBe('3a');
    expect(isAssessmentUdaForClass(udas[0], '3ª A - Secondaria I Grado')).toBe(true);
    expect(isAssessmentUdaForClass(udas[2], '3ª A - Secondaria I Grado')).toBe(false);
    expect(isAssessmentUdaForClass(udas[3], '3ª A')).toBe(false);
  });

  test('unknown and empty class context must fail closed', () => {
    expect(isAssessmentUdaForClass(udas[0], '')).toBe(false);
    expect(isAssessmentUdaForClass({className: ''}, '3ª A')).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, '')).toBe(false);
  });

  test('no association is allowed; foreign or deleted UDA is rejected', () => {
    expect(isAssessmentUdaSelectionAllowed('', udas, '3ª A')).toBe(true);
    expect(isAssessmentUdaSelectionAllowed(undefined, udas, '3ª A')).toBe(true);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, '3ª A - Secondaria I Grado')).toBe(true);
    expect(isAssessmentUdaSelectionAllowed('uda-b', udas, '3ª A - Secondaria I Grado')).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('deleted', udas, '3ª A')).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-b', udas, '3ª B - Secondaria I Grado')).toBe(true);
  });
});
