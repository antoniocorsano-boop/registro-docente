import { describe, expect, test } from 'bun:test';
import {
  isAssessmentUdaForClass,
  isAssessmentUdaSelectionAllowed,
  normalizeAssessmentClassName
} from './assessmentUdaScope';

const classes = ['3ª A - Secondaria I Grado', '3ª B - Secondaria I Grado'];
const udas = [
  { id: 'uda-a1', className: '3ª A' },
  { id: 'uda-a2', className: '3ª A - Secondaria I Grado' },
  { id: 'uda-b', className: '3ª B' },
  { id: 'uda-aa', className: '3ª AA' },
  { id: 'uda-primary', className: '3ª A - Primaria' }
];

describe('INT-02/S1: fail-closed UDA class scope', () => {
  test('retains explicit full label and matches historical short UDA unambiguously', () => {
    expect(normalizeAssessmentClassName('3ª A - Secondaria I Grado')).toBe('3a - secondaria i grado');
    expect(normalizeAssessmentClassName('3ª A – Secondaria I Grado')).toBe('3a - secondaria i grado');
    expect(isAssessmentUdaForClass(udas[0], classes[0], classes)).toBe(true);
    expect(isAssessmentUdaForClass(udas[1], classes[0], classes)).toBe(true);
    expect(isAssessmentUdaForClass(udas[2], classes[0], classes)).toBe(false);
    expect(isAssessmentUdaForClass(udas[3], classes[0], classes)).toBe(false);
    expect(isAssessmentUdaForClass(udas[4], classes[0], classes)).toBe(false);
  });

  test('same short code across different school orders is ambiguous', () => {
    const twoOrders = ['3ª A - Primaria', '3ª A - Secondaria I Grado'];
    expect(isAssessmentUdaForClass({ className: '3ª A' }, twoOrders[1], twoOrders)).toBe(false);
    expect(isAssessmentUdaForClass({ className: '3ª A - Primaria' }, twoOrders[1], twoOrders)).toBe(false);
    expect(isAssessmentUdaForClass({ className: '3ª A - Secondaria I Grado' }, twoOrders[1], twoOrders)).toBe(true);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, twoOrders[1], twoOrders)).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-primary', udas, twoOrders[1], twoOrders)).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a2', udas, twoOrders[1], twoOrders)).toBe(true);
  });

  test('missing, repeated or unidentified class contexts reject associations', () => {
    expect(isAssessmentUdaForClass(udas[0], '', classes)).toBe(false);
    expect(isAssessmentUdaForClass({ className: '' }, classes[0], classes)).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, '', classes)).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, classes[0], [classes[0], classes[0]])).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, classes[0], [])).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, '3ª C - Secondaria I Grado', classes)).toBe(false);
  });

  test('no association remains valid; foreign and deleted UDA are rejected', () => {
    expect(isAssessmentUdaSelectionAllowed('', udas, classes[0], classes)).toBe(true);
    expect(isAssessmentUdaSelectionAllowed(undefined, udas, classes[0], classes)).toBe(true);
    expect(isAssessmentUdaSelectionAllowed('uda-a1', udas, classes[0], classes)).toBe(true);
    expect(isAssessmentUdaSelectionAllowed('uda-b', udas, classes[0], classes)).toBe(false);
    expect(isAssessmentUdaSelectionAllowed('deleted', udas, classes[0], classes)).toBe(false);
  });
});
