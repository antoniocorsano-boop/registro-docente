import { describe, expect, test } from 'bun:test';
import {
  resolveTeachingFocusForClass,
  keepTeachingFocusForClass,
  transitionTeachingFocusForTab
} from '../context/teachingFocus';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';

const local: TeachingUdaCandidate = {
  id: 'uda-2c', origin: 'registro', classId: 'class-2c',
  className: '2C', classLabel: '2C', title: 'Agricoltura',
  period: 'Q1', periodLabel: 'Q1', plannedHours: 8, sourceRef: 'uda-2c',
  writableByRegistro: true,
  lessons: [{ id: 'lesson-1', date: '2026-11-03', topic: 'Il suolo', hours: 1, activityType: 'teoria' }]
};
const other: TeachingUdaCandidate = {
  ...local, id: 'uda-3c', classId: 'class-3c', className: '3C', classLabel: '3C'
};
const projected: TeachingUdaCandidate = {
  ...local, id: 'docente-os:uda-2c', origin: 'docente-os',
  writableByRegistro: false, lessons: [], sourceRef: 'external-ref'
};
const catalog = [local, other, projected] as const;
const resolve = (focus: { udaId: string; lessonId?: string } | null, currentClassId: string | null = 'class-2c') =>
  resolveTeachingFocusForClass({ focus, currentClassId, catalog });

describe('INT-01 session teaching focus', () => {
  test('absence is an explicit unavailable state', () => {
    expect(resolve(null)).toEqual({ status: 'unavailable', reason: 'FOCUS_MISSING' });
  });
  test('requires an explicit current class', () => {
    expect(resolve({ udaId: local.id }, null)).toEqual({
      status: 'unavailable', reason: 'CLASS_CONTEXT_MISSING'
    });
  });
  test('resolves a registered UDA with real class identity and write authority', () => {
    expect(resolve({ udaId: local.id })).toEqual({
      status: 'resolved', reason: 'RESOLVED',
      context: { udaId: local.id, className: '2C', period: 'Q1',
        udaOrigin: 'registro', writableByRegistro: true }
    });
  });
  test('fails closed for wrong-class or missing UDA', () => {
    expect(resolve({ udaId: other.id })).toEqual({
      status: 'unavailable', reason: 'CLASS_MISMATCH'
    });
    expect(resolve({ udaId: 'missing' })).toEqual({
      status: 'unavailable', reason: 'UDA_NOT_FOUND'
    });
  });
  test('only resolves a lesson that actually belongs to the Registro UDA', () => {
    const good = resolve({ udaId: local.id, lessonId: 'lesson-1' });
    expect(good.status).toBe('resolved');
    if (good.status === 'resolved') {
      expect(good.context.lessonId).toBe('lesson-1');
      expect(good.context.activityType).toBe('teoria');
    }
    expect(resolve({ udaId: local.id, lessonId: 'missing' })).toEqual({
      status: 'unavailable', reason: 'LESSON_NOT_FOUND'
    });
  });
  test('projected UDA is readable but never invents a local lesson', () => {
    expect(resolve({ udaId: projected.id })).toEqual({
      status: 'resolved', reason: 'RESOLVED',
      context: { udaId: projected.id, className: '2C', period: 'Q1',
        udaOrigin: 'docente-os', writableByRegistro: false }
    });
    expect(resolve({ udaId: projected.id, lessonId: 'lesson-1' })).toEqual({
      status: 'unavailable', reason: 'PROJECTED_UDA_LESSON_UNSUPPORTED'
    });
  });
  test('explicit class switch removes the previous focus', () => {
    expect(keepTeachingFocusForClass({ udaId: local.id }, 'class-3c', catalog)).toBeNull();
    expect(keepTeachingFocusForClass({ udaId: local.id }, 'class-2c', catalog))
      .toEqual({ udaId: local.id });
  });
  test('navigation retains focus only between Programmazione and UDA', () => {
    expect(transitionTeachingFocusForTab({ udaId: local.id }, 'class-2c', 'programmazione', catalog))
      .toEqual({ udaId: local.id });
    expect(transitionTeachingFocusForTab({ udaId: local.id }, 'class-2c', 'uda-gantt', catalog))
      .toEqual({ udaId: local.id });
    expect(transitionTeachingFocusForTab({ udaId: local.id }, 'class-2c', 'voti', catalog))
      .toBeNull();
  });
});
