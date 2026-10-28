import { describe, expect, test } from 'bun:test';
import {
  buildCopilotContextProjection,
  type BuildCopilotContextProjectionInput
} from '../copilot/contextProjection';

const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();

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

  test('App maps teacher work surfaces without treating an ambient UDA tab as an explicit UDA context', () => {
    expect(appSource).toContain("activeTab === 'home' ? 'home'");
    expect(appSource).toContain("activeTab === 'dashboard' ? 'class-dashboard'");
    expect(appSource).toContain("activeTab === 'biblioteca' ? 'library'");
    expect(appSource).toContain("activeTab === 'uda-gantt' ? 'other-teacher-surface'");
    expect(appSource).toContain("activeTab === 'programmazione' ? 'planning'");
    expect(appSource).toContain("activeTab === 'verifiche-online' ? 'online-tests'");
    expect(appSource).toContain("activeTab === 'voti' ? 'evaluations'");
    expect(appSource).toContain("activeTab === 'tabellone' ? 'evaluations'");
    expect(appSource).toContain(": 'other-teacher-surface'");
    expect(appSource).toContain('className: currentClass?.name');
    expect(appSource).not.toContain('ambientCopilotContext = { student');
    expect(appSource).not.toContain('ambientCopilotContext = { grades');
    expect(appSource).not.toContain('ambientCopilotContext = { behaviors');
  });

  test('explicit launch context can promote an ambient generic surface to its real UDA surface', async () => {
    const module = await import('../copilot/contextProjection') as Record<string, unknown>;
    expect(typeof module.resolveCopilotProjectionSurface).toBe('function');
    if (typeof module.resolveCopilotProjectionSurface !== 'function') return;
    const resolveSurface = module.resolveCopilotProjectionSurface as (input: {
      ambientSurface?: string;
      launchSurface?: string;
      hasExplicitTeachingTarget: boolean;
    }) => string;

    expect(resolveSurface({
      ambientSurface: 'other-teacher-surface',
      launchSurface: 'uda',
      hasExplicitTeachingTarget: true
    })).toBe('uda');
    expect(resolveSurface({
      ambientSurface: 'other-teacher-surface',
      launchSurface: 'lesson',
      hasExplicitTeachingTarget: true
    })).toBe('lesson');
    expect(resolveSurface({
      ambientSurface: 'other-teacher-surface',
      launchSurface: 'uda',
      hasExplicitTeachingTarget: false
    })).toBe('other-teacher-surface');
  });

  test('Composer derives remote routing from the unified projection and binds it into stale-result identity', () => {
    expect(composerSource).toContain('buildCopilotContextProjection');
    expect(composerSource).toContain('resolveCopilotProjectionSurface');
    expect(composerSource).toContain('buildAgentRoutingRequestFromProjection');
    expect(composerSource).not.toContain('function agentRoutingSurface');
    expect(composerSource).toContain('copilotContextProjection');
    expect(composerSource).toContain('copilotContextFingerprint');
    expect(composerSource).toContain('contextProjection: copilotContextProjection');
    expect(composerSource).toContain('buildAgentRoutingRequestFromProjection(normalizedObjective, copilotContextProjection)');
  });
});
