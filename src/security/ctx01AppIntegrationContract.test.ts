import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();

describe('CTX-01 App professional-context integration', () => {
  test('derives ambient Copilot metadata through the canonical professional context', () => {
    expect(appSource).toContain("from './context/professionalContext'");
    expect(appSource).toContain('resolveProfessionalContext({');
    expect(appSource).toContain('toCopilotContextProjection(');
    expect(appSource).toContain('currentClass: currentClass ? { id: currentClass.id, name: currentClass.name } : null');
    expect(appSource).not.toContain('const ambientCopilotContext: CopilotLaunchContext = {\n    surface:');
  });

  test('keeps the existing surface vocabulary while routing through CTX-01', () => {
    expect(appSource).toContain("activeTab === 'home' ? 'home'");
    expect(appSource).toContain("activeTab === 'dashboard' ? 'class-dashboard'");
    expect(appSource).toContain("activeTab === 'biblioteca' ? 'library'");
    expect(appSource).toContain("activeTab === 'programmazione' ? 'planning'");
    expect(appSource).toContain("activeTab === 'verifiche-online' ? 'online-tests'");
    expect(appSource).toContain("activeTab === 'voti' ? 'evaluations'");
  });

  test('does not leak student evidence into the professional context input', () => {
    const start = appSource.indexOf('resolveProfessionalContext({');
    const end = appSource.indexOf('});', start);
    const contextInput = appSource.slice(start, end + 3);

    expect(start).toBeGreaterThan(-1);
    expect(contextInput).not.toContain('student');
    expect(contextInput).not.toContain('grades');
    expect(contextInput).not.toContain('behaviors');
  });

  test('preserves neutral entry instead of restoring persisted class authority', () => {
    expect(appSource).toContain('// Navigation context is session-only: never reactivate a persisted class on entry.');
    expect(appSource).toContain('currentClassId: null');
  });
});