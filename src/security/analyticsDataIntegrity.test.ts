import { describe, expect, test } from 'bun:test';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

function between(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return '';
  return text.slice(start, end);
}

describe('ANALYTICS-01 fail-closed data integrity', () => {
  test('class sufficiency rate remains unavailable when there are no valid averages', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');
    const suffRateBlock = between(analytics, 'const suffRate', '// Level counts');

    expect(suffRateBlock).toContain(': null;');
    expect(suffRateBlock).not.toContain(': 0;');
    expect(analytics).toContain("{suffRate === null ? '—' : `${suffRate}%`}");
    expect(analytics).toContain("suffRate === null ? 'Nessun dato'");
  });

  test('class level distribution renders an empty state instead of synthetic zero percentages', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).not.toContain('const totalAssessedStudents = validAvgs.length || 1;');
    expect(analytics).toContain('validAvgs.length === 0 ? (');
    expect(analytics).toContain('Nessun dato disponibile per la distribuzione dei livelli.');
  });

  test('scrutiny and printable export classify missing averages as unavailable', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).toContain('displayTotal === null ? (');
    expect(analytics).toContain('Non disponibile');
    expect(analytics).toContain("exportTotal === null ? 'Non disponibile'");
    expect(analytics).not.toContain("m.totalWeightedAvg !== null && m.totalWeightedAvg >= 6 ? 'Idoneo' : 'A Rischio'");
  });

  test('student competency dimensions never use general-average or numeric fallbacks', async () => {
    const report = await source('src/components/StudentReportView.tsx');
    const competencyProfile = between(
      report,
      'function calcStudentCompetencyProfile',
      'export const StudentReportView'
    );
    const udaRadar = between(report, '// 2. Per-UDA Radar Data', 'const activeRadarData');

    expect(competencyProfile).not.toContain('const fallback =');
    expect(competencyProfile).not.toMatch(/\?\?\s*(?:Math\.|[0-9])/);
    expect(competencyProfile).toContain('studentScore: stemStudentScore');
    expect(competencyProfile).toContain('classScore: stemClassScore');
    expect(udaRadar).not.toContain('?? 7.0');
    expect(udaRadar).not.toContain('fallbackScore');
  });

  test('radar synthesis, level counts and strengths require at least three evidenced dimensions', async () => {
    const report = await source('src/components/StudentReportView.tsx');

    expect(report).toContain(
      'const evaluatedCompetencyData = competencyRadarData.filter(c => c.studentScore !== null);'
    );
    expect(report).toContain(
      'const hasReliableCompetencyProfile = evaluatedCompetencyData.length >= 3;'
    );
    expect(report).toContain(
      'const bestCompetency = hasReliableCompetencyProfile ? sortedStrengths[0] : null;'
    );
    expect(report).toContain(
      'const growthCompetency = hasReliableCompetencyProfile ? sortedStrengths[sortedStrengths.length - 1] : null;'
    );
    expect(report).toContain('Dati insufficienti per costruire un profilo attendibile');
  });

  test('class headline level counters stay unavailable when no student has a valid average', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).toContain("{validAvgs.length === 0 ? '—' : levelCounts.AV}");
    expect(analytics).toContain("{validAvgs.length === 0 ? '—' : levelCounts.PA}");
  });

  test('a generic quiz is not sufficient evidence of digital competence', async () => {
    const report = await source('src/components/StudentReportView.tsx');
    const digitalBlock = between(
      report,
      '// 2. Competenze Digitali & CAD',
      '// 3. Educazione Civica & Sostenibilità'
    );

    expect(digitalBlock).not.toContain("g.type === 'test' ||");
  });

});
