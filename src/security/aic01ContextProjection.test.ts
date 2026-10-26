import { describe, expect, test } from 'bun:test';
import {
  buildCopilotContextProjection,
  toRemoteRoutingProjection
} from '../copilot/contextProjection';

describe('AIC-01 unified Copilot context projection', () => {
  test('keeps evaluation context professional locally and collapses it to the safe remote surface', () => {
    const context = buildCopilotContextProjection({
      surface: 'evaluations',
      className: '3C',
      udaId: 'uda-energia',
      lessonId: 'lesson-centrale',
      planningProfileId: 'planning-2026-27',
      assessmentId: 'assessment-energia'
    });

    expect(context).toEqual({
      schema: 'registro.copilot-context/v1',
      surface: 'evaluations',
      className: '3C',
      udaId: 'uda-energia',
      lessonId: 'lesson-centrale',
      planningProfileId: 'planning-2026-27',
      assessmentId: 'assessment-energia'
    });

    expect(toRemoteRoutingProjection(context)).toEqual({
      surface: 'other-teacher-surface',
      hasCurrentClass: true,
      hasCurrentUda: true,
      hasSelectedSource: false
    });
  });

  test('preserves explicitly supported planning and library routing surfaces', () => {
    const planning = buildCopilotContextProjection({
      surface: 'planning',
      className: '3C',
      planningProfileId: 'planning-2026-27'
    });
    expect(toRemoteRoutingProjection(planning)).toEqual({
      surface: 'planning',
      hasCurrentClass: true,
      hasCurrentUda: false,
      hasSelectedSource: false
    });

    const library = buildCopilotContextProjection({
      surface: 'library',
      sourceId: 'source-centrale'
    });
    expect(toRemoteRoutingProjection(library)).toEqual({
      surface: 'library',
      hasCurrentClass: false,
      hasCurrentUda: false,
      hasSelectedSource: true
    });
  });

  test('does not invent missing UDA or source targets', () => {
    const context = buildCopilotContextProjection({
      surface: 'online-tests',
      className: '3C',
      udaId: null,
      sourceId: null
    });

    expect(context.udaId).toBeUndefined();
    expect(context.sourceId).toBeUndefined();
    expect(toRemoteRoutingProjection(context)).toEqual({
      surface: 'other-teacher-surface',
      hasCurrentClass: true,
      hasCurrentUda: false,
      hasSelectedSource: false
    });
  });
});
