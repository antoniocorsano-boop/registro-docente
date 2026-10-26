import { describe, expect, test } from 'bun:test';
import type { UdaRecord } from '../types';
import {
  resolveLaunchTeachingContext,
  type CopilotLaunchContext,
  type LibraryCopilotLaunchRequest
} from './copilotLaunchContext';

const udas: UdaRecord[] = [
  {
    id: 'uda-energia',
    title: 'Energia e trasformazioni',
    className: '3C',
    hours: 12,
    period: 'Q1',
    startMonth: 1,
    durationMonths: 2,
    lessons: [
      {
        id: 'lesson-centrale',
        date: '2026-10-26',
        topic: 'La centrale elettrica',
        hours: 1,
        activityType: 'teoria'
      }
    ]
  },
  {
    id: 'uda-materiali',
    title: 'Materiali',
    className: '2C',
    hours: 10,
    period: 'Q1',
    startMonth: 0,
    durationMonths: 2,
    lessons: [
      {
        id: 'lesson-legno',
        date: '2026-10-20',
        topic: 'Il legno',
        hours: 1,
        activityType: 'laboratorio'
      }
    ]
  }
];

function request(context: CopilotLaunchContext): LibraryCopilotLaunchRequest {
  return { nonce: 1, context };
}

describe('single contextual Copilot launch context', () => {
  test('resolves source + UDA + lesson only when the lesson belongs to the requested UDA', () => {
    expect(resolveLaunchTeachingContext(request({
      surface: 'library',
      sourceId: 'source-1',
      className: '3C',
      udaId: 'uda-energia',
      lessonId: 'lesson-centrale'
    }), udas)).toEqual({
      udaId: 'uda-energia',
      className: '3C',
      period: 'Q1',
      lessonId: 'lesson-centrale',
      activityType: 'teoria'
    });

    expect(resolveLaunchTeachingContext(request({
      surface: 'library',
      udaId: 'uda-materiali',
      lessonId: 'lesson-centrale'
    }), udas)).toBeNull();
  });

  test('resolves an UDA-only launch without inventing a lesson', () => {
    expect(resolveLaunchTeachingContext(request({
      surface: 'uda',
      className: '3C',
      udaId: 'uda-energia'
    }), udas)).toEqual({
      udaId: 'uda-energia',
      className: '3C',
      period: 'Q1'
    });
  });

  test('fails closed for stale UDA or lesson references and for metadata-only launches', () => {
    expect(resolveLaunchTeachingContext(request({ surface: 'library', udaId: 'missing' }), udas)).toBeNull();
    expect(resolveLaunchTeachingContext(request({ surface: 'lesson', udaId: 'uda-energia', lessonId: 'missing' }), udas)).toBeNull();
    expect(resolveLaunchTeachingContext(request({ surface: 'home', className: '3C' }), udas)).toBeNull();
    expect(resolveLaunchTeachingContext(null, udas)).toBeNull();
  });

  test('launch context is metadata-only and has no source payload or student-data fields', () => {
    const context: CopilotLaunchContext = {
      surface: 'class-dashboard',
      className: '3C',
      udaId: 'uda-energia',
      lessonId: 'lesson-centrale',
      sourceId: 'source-1'
    };

    expect(Object.keys(context).sort()).toEqual([
      'className',
      'lessonId',
      'sourceId',
      'surface',
      'udaId'
    ]);
    const serialized = JSON.stringify(context);
    for (const forbidden of ['payload', 'student', 'grade', 'behavior', 'extractedText', 'dataUrl']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
