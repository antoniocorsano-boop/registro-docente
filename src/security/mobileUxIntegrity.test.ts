import { describe, expect, test } from 'bun:test';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe('UX-MOBILE-01 responsive core contracts', () => {
  test('mobile header primary actions expose 44px touch targets', async () => {
    const navbar = await source('src/components/Navbar.tsx');

    expect(navbar).toContain('min-h-[44px] min-w-[44px]');
    expect(navbar).toContain('aria-label={saveIndicatorText}');
    expect(navbar).toContain('md:hidden fixed bottom-0');
  });

  test('narrow header compacts the brand before controls can overflow', async () => {
    const navbar = await source('src/components/Navbar.tsx');

    expect(navbar).toContain('className="hidden sm:block font-bold text-base');
  });

  test('analytics primary controls remain usable without horizontal page overflow', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).toContain('w-full sm:w-auto min-h-[44px]');
    expect(analytics).toContain('grid grid-cols-1 sm:grid-cols-2');
    expect(analytics).toContain('min-h-[44px]');
  });

  test('scrutiny provides a dedicated mobile presentation instead of shrinking the desktop table', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).toContain('data-testid="mobile-analytics-student-detail"');
    expect(analytics).toContain('className="md:hidden group rounded-lg');
    expect(analytics).toContain('className="hidden md:block overflow-x-auto');
    expect(analytics).toContain('onClick={() => onOpenStudentReport(m.student.id)}');
  });

  test('student report selector and radar mode controls meet mobile touch sizing', async () => {
    const report = await source('src/components/StudentReportView.tsx');

    expect(report).toContain('min-h-[44px]');
    expect(report).toContain('w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2');
  });

  test('student radar container scales down on narrow screens without fixed desktop minimum height', async () => {
    const report = await source('src/components/StudentReportView.tsx');

    expect(report).toContain('min-h-[300px] sm:min-h-[340px]');
    expect(report).toContain('height={280}');
  });

  test('tabellone provides dedicated teacher-first mobile cards while preserving the desktop matrix', async () => {
    const matrix = await source('src/components/MatrixView.tsx');

    expect(matrix).toContain('Mobile student cards');
    expect(matrix).toContain('className="md:hidden space-y-3"');
    expect(matrix).toContain('className="hidden md:block overflow-x-auto');
    expect(matrix).toContain('min-h-[44px]');
    expect(matrix).toContain('Voti recenti');
    expect(matrix).toContain('Medie per tipologia');
    expect(matrix).toContain('Medie periodo');
    expect(matrix).toContain('onClick={() => onOpenStudentReport(s.id)}');
  });
});