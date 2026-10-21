import { describe, expect, test } from 'bun:test';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

function invocation(sourceText: string, componentName: string): string {
  const start = sourceText.indexOf(`<${componentName}`);
  if (start < 0) return '';
  const end = sourceText.indexOf('/>', start);
  return end < 0 ? sourceText.slice(start) : sourceText.slice(start, end + 2);
}

describe('PRIVACY-01 fail-closed teacher identity display', () => {
  test('starts Privacy Shield active for every application session and never restores a disabled state', async () => {
    const app = await source('src/App.tsx');

    expect(app).toMatch(
      /const \[isPrivacyShieldActive, setIsPrivacyShieldActive\] = useState<boolean>\(true\);/
    );
    expect(app).not.toContain('registro_privacy_shield_active');
  });

  test('privacy-aware components default to masked identities when the prop is omitted', async () => {
    const paths = [
      'src/components/EvaluationsView.tsx',
      'src/components/BehaviorsView.tsx',
      'src/components/AnalyticsView.tsx',
      'src/components/MatrixView.tsx',
      'src/components/ClassComparisonBarChart.tsx',
      'src/components/StudentGradesTimelineChart.tsx'
    ];

    for (const path of paths) {
      const text = await source(path);
      expect(text, path).toContain('isPrivacyShieldActive = true');
      expect(text, path).not.toContain('isPrivacyShieldActive = false');
    }
  });

  test('student report receives the shield and masks selector, narrative and radar labels', async () => {
    const app = await source('src/App.tsx');
    const report = await source('src/components/StudentReportView.tsx');

    expect(invocation(app, 'StudentReportView')).toContain(
      'isPrivacyShieldActive={isPrivacyShieldActive}'
    );
    expect(report).toContain('isPrivacyShieldActive?: boolean;');
    expect(report).toContain('isPrivacyShieldActive = true');
    expect(report).toContain('formatStudentNameWithPrivacy');
    expect(report).not.toMatch(/\{s\.name\}\s*<\/option>/);
    expect(report).not.toContain('<b>{currentStudent.name}</b>');
    expect(report).not.toContain('name={currentStudent.name}');
  });

  test('analytics screen and print/export never render a raw student name when the shield is active', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).not.toMatch(/<td[^>]*>\{m\.student\.name\}<\/td>/);
    expect(analytics).toContain(
      'formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)'
    );
  });

  test('student management receives the shield and masks displayed and confirmation identities', async () => {
    const app = await source('src/App.tsx');
    const management = await source('src/components/StudentsManagementView.tsx');

    expect(invocation(app, 'StudentsManagementView')).toContain(
      'isPrivacyShieldActive={isPrivacyShieldActive}'
    );
    expect(management).toContain('isPrivacyShieldActive?: boolean;');
    expect(management).toContain('isPrivacyShieldActive = true');
    expect(management).toContain('formatStudentNameWithPrivacy');
    expect(management).not.toMatch(/>\{student\.name\}<\/span>/);
    expect(management).not.toContain('${student.name}');
  });

  test('teacher-facing online submissions receive the shield and mask student identities', async () => {
    const app = await source('src/App.tsx');
    const online = await source('src/components/VerificheOnlineView.tsx');

    expect(invocation(app, 'VerificheOnlineView')).toContain(
      'isPrivacyShieldActive={isPrivacyShieldActive}'
    );
    expect(online).toContain('isPrivacyShieldActive?: boolean;');
    expect(online).toContain('isPrivacyShieldActive = true');
    expect(online).toContain('formatStudentNameWithPrivacy');
    expect(online).not.toMatch(/>\{sub\.name\}<\/td>/);
  });
});
