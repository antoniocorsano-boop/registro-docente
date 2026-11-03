import { describe, expect, test } from 'bun:test';

const mandatoryImpactPaths = [
  'src/planning/planningFrameResolver.ts',
  'src/library/planningContextBridge.ts',
  'src/context/teachingFocus.ts',
  'src/context/professionalContext.ts',
  'src/components/DidacticContinuityBar.tsx',
  'src/components/planning/PlanningProfileView.tsx',
  'src/components/planning/PlanningProfileEditor.tsx',
  'src/components/UdaGanttView.tsx',
  'src/components/UdaWorkspaceView.tsx',
  'src/App.tsx',
  'src/security/int01PlanningFrameContract.test.ts',
  'src/security/int01TeachingFocusContract.test.ts',
  'src/security/int01ProfessionalContextContract.test.ts',
  'src/security/int01AppContextContract.test.ts',
  'src/security/int01DidacticContinuityUiContract.test.ts',
  'src/security/int01QualificationContract.test.ts',
  'tests/browser/int-01-didactic-continuity.spec.cjs',
  '.github/workflows/browser-qualification.yml'
];
const mandatoryContracts = [
  'src/security/int01PlanningFrameContract.test.ts',
  'src/security/int01TeachingFocusContract.test.ts',
  'src/security/int01ProfessionalContextContract.test.ts',
  'src/security/int01AppContextContract.test.ts',
  'src/security/int01DidacticContinuityUiContract.test.ts',
  'src/security/int01QualificationContract.test.ts'
];

describe('INT-01-I01 qualification invariant', () => {
  test('covers the domain, presentation, App, privacy and browser boundaries', async () => {
    const registry = JSON.parse(await Bun.file('qualification/invariants.v1.json').text());
    const invariant = registry.invariants.find((item: { id: string }) => item.id === 'INT-01-I01');
    expect(invariant).toBeDefined();
    expect(invariant.owner).toBe('INT-01');
    for (const path of mandatoryImpactPaths) expect(invariant.impactPaths).toContain(path);
    for (const path of mandatoryContracts) expect(invariant.tests).toContain(path);
    expect(invariant.browserSmoke).toContain('tests/browser/int-01-didactic-continuity.spec.cjs');
    expect(invariant.statement).toMatch(/class.first|class-first/i);
    expect(invariant.statement).toMatch(/fail.closed|fail-closed/i);
    expect(invariant.statement).toMatch(/session.only|session-only/i);
    expect(invariant.statement).toMatch(/read.only|read-only/i);
  });
  test('dedicated Chromium journey is part of the authoritative Browser Qualification', async () => {
    const workflow = await Bun.file('.github/workflows/browser-qualification.yml').text();
    expect(workflow).toContain('cp tests/browser/int-01-didactic-continuity.spec.cjs');
    expect(workflow).toContain('Run INT-01 Chromium qualification');
    expect(workflow).toContain('int-01-didactic-continuity.spec.cjs');
  });
});
