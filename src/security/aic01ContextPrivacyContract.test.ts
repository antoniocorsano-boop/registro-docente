import { describe, expect, test } from 'bun:test';
import {
  buildCopilotContextProjection,
  type BuildCopilotContextProjectionInput
} from '../copilot/contextProjection';

describe('AIC-01 remote context privacy contract', () => {
  test('remote routing request is derived only from the allowlisted professional projection', async () => {
    const module = await import('../library/agentIntent') as Record<string, unknown>;
    expect(typeof module.buildAgentRoutingRequestFromProjection).toBe('function');
    if (typeof module.buildAgentRoutingRequestFromProjection !== 'function') return;

    const untrustedLocalInput = {
      surface: 'evaluations',
      className: '3C',
      udaId: 'uda-energia',
      assessmentId: 'assessment-energia',
      studentName: 'Mario Rossi',
      studentId: 'student-001',
      grade: 7.5,
      behavior: 'nota disciplinare',
      studentAverage: 6.75
    } as BuildCopilotContextProjectionInput & Record<string, unknown>;

    const context = buildCopilotContextProjection(untrustedLocalInput);
    expect(Object.keys(context).sort()).toEqual([
      'assessmentId',
      'className',
      'schema',
      'surface',
      'udaId'
    ]);

    const buildRequest = module.buildAgentRoutingRequestFromProjection as (
      message: string,
      context: typeof context
    ) => unknown;
    const request = buildRequest('Rivedi questa attività nel contesto corrente', context);

    expect(request).toEqual({
      schema: 'registro.agent-routing-request/v1',
      message: 'Rivedi questa attività nel contesto corrente',
      context: {
        surface: 'other-teacher-surface',
        hasCurrentClass: true,
        hasCurrentUda: true,
        hasSelectedSource: false
      },
      explicitTeacherSubmission: true
    });

    const serialized = JSON.stringify(request);
    for (const forbidden of [
      'Mario Rossi',
      'student-001',
      '7.5',
      'nota disciplinare',
      '6.75',
      'studentName',
      'studentId',
      'grade',
      'behavior',
      'studentAverage',
      'assessmentId',
      'uda-energia',
      '3C'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
