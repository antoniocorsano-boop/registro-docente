import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const closedDisclosureContaining = (text: string, label: string) => {
  const firstDetailsIndex = text.indexOf('<details');
  expect(firstDetailsIndex).toBeGreaterThanOrEqual(0);

  const labelIndex = text.indexOf(label, firstDetailsIndex);
  expect(labelIndex).toBeGreaterThan(firstDetailsIndex);

  const detailsIndex = text.lastIndexOf('<details', labelIndex);
  const closeIndex = text.indexOf('</details>', labelIndex);
  expect(detailsIndex).toBeGreaterThanOrEqual(0);
  expect(closeIndex).toBeGreaterThan(labelIndex);

  const openingEnd = text.indexOf('>', detailsIndex);
  expect(openingEnd).toBeGreaterThan(detailsIndex);
  const openingTag = text.slice(detailsIndex, openingEnd + 1);
  expect(openingTag).not.toMatch(/\bopen\b/);

  return text.slice(detailsIndex, closeIndex + '</details>'.length);
};

describe('P2-DENSITY-01 progressive disclosure', () => {
  test('analytics keeps primary decisions visible and collapses secondary analysis by default', async () => {
    const analytics = await source('components/AnalyticsView.tsx');
    const advanced = closedDisclosureContaining(analytics, 'Approfondimenti analitici');
    const primary = analytics.replace(advanced, '');

    expect(advanced).toContain('Fasce analitiche della media');
    expect(advanced).toContain('<StudentGradesTimelineChart');
    expect(advanced).toContain('<ClassComparisonBarChart');

    expect(primary).toContain('Analisi medie & fasce analitiche');
    expect(primary).toContain('Tasso Sufficienza');
    expect(primary).toContain('Indicatori di media: ponderata & confronto aritmetico');
    expect(primary).toContain('Prospetto di lavoro docente');
  });

  test('student report places deep evidence sections behind independent closed disclosures', async () => {
    const report = await source('components/StudentReportView.tsx');

    const profile = closedDisclosureContaining(report, 'Profilo interno di evidenze');
    const uda = closedDisclosureContaining(report, 'Dossier UDA');
    const grades = closedDisclosureContaining(report, 'Elenco valutazioni');
    const behaviors = closedDisclosureContaining(report, 'Comportamenti e partecipazione');

    expect(profile).toContain('<RadarChart');
    expect(uda).toContain('studentUdaDossier.map');
    expect(grades).toContain('grades.length === 0');
    expect(behaviors).toContain('studentBehaviors.length === 0');
  });

  test('student selector and summary remain before the first progressive disclosure', async () => {
    const report = await source('components/StudentReportView.tsx');
    const firstDisclosure = report.indexOf('<details');
    const selector = report.indexOf('Scheda Alunno & Profilo delle Competenze');

    expect(selector).toBeGreaterThanOrEqual(0);
    expect(firstDisclosure).toBeGreaterThan(selector);
  });
});
