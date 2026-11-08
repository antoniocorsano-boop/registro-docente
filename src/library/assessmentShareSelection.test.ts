import { describe, expect, test } from 'bun:test';
import { resolveAssessmentShareTarget } from './assessmentShareSelection';

const classes = [
  { id: 'a', name: '3ª A - Secondaria I Grado' },
  { id: 'b', name: '3ª B - Secondaria I Grado' }
];
const tests = {
  energia: { id: 'energia', title: 'Energia', questions: [] },
  materiali: { id: 'materiali', title: 'Materiali', questions: [] }
};

const resolve = (className: string, testId: string, classList: typeof classes = classes) =>
  resolveAssessmentShareTarget({
    className, testId, classes: classList, tests
  });

describe('INT-02/S2a — condivisione e simulazione con scelta esplicita', () => {
  test('nessuna classe, nessun test, o un solo campo: nessun target', () => {
    expect(resolve('', '').status).toBe('needs-selection');
    expect(resolve('', 'energia').status).toBe('needs-selection');
    expect(resolve(classes[0].name, '').status).toBe('needs-selection');
  });

  test('selezione esplicita valida usa gli identificativi esatti', () => {
    expect(resolve(classes[1].name, 'materiali')).toEqual({
      status: 'ready',
      target: { className: classes[1].name, testId: 'materiali' }
    });
  });

  test('classe eliminata, etichetta ambigua, test cancellato o identificativo fittizio falliscono chiusi', () => {
    expect(resolve('3ª C - Secondaria I Grado', 'energia').status).toBe('unavailable');
    expect(resolve(classes[0].name, 'energy-not-in-catalogue').status).toBe('unavailable');
    expect(resolve(classes[0].name, 'energia', [classes[0], { id: 'other', name: classes[0].name }]).status)
      .toBe('unavailable');
    expect(resolve(classes[1].name, 'energia', [classes[0]]).status).toBe('unavailable');
  });

  test('non interpreta un test o una classe per posizione nel catalogo', () => {
    const reordered = {
      materiali: tests.materiali,
      energia: tests.energia
    };
    expect(resolveAssessmentShareTarget({
      className: '', testId: '', classes: [...classes].reverse(), tests: reordered
    }).status).toBe('needs-selection');
  });
});
