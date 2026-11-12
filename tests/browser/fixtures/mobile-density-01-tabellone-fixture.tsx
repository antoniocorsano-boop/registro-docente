import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MatrixView } from '../../../src/components/MatrixView';
import { AnalyticsView } from '../../../src/components/AnalyticsView';
import { DEFAULT_SETTINGS } from '../../../src/utils';
import type { ClassData, Grade, Student } from '../../../src/types';
import '../../../src/index.css';

/** Purely synthetic classroom; zero account, local Vault, persisted or real data. */
function buildSyntheticClass(id: string, count: number): ClassData {
  const students: Student[] = Array.from({ length: count }, (_, index) => ({
    id: `${id}-student-${index + 1}`,
    name: `Persona Fittizia ${String(index + 1).padStart(2, '0')}`,
  }));
  const grades: Grade[] = students.flatMap((student, i) => [
    {
      id: `${student.id}-q1`,
      batchId: `${id}-prova-q1`,
      studentId: student.id,
      date: '2026-10-10',
      period: 'Q1' as const,
      title: 'Prova sintetica primo periodo',
      type: 'verifica' as const,
      value: String(6 + (i % 4)),
    },
    {
      id: `${student.id}-q2`,
      batchId: `${id}-prova-q2`,
      studentId: student.id,
      date: '2026-11-01',
      period: 'Q2' as const,
      title: 'Prova sintetica secondo periodo',
      type: 'test' as const,
      value: String(5 + (i % 5)),
    },
  ]);
  return { id, name: 'Classe sintetica', students, grades, behaviors: [] };
}

function Fixture() {
  const [count, setCount] = useState<8 | 25>(8);
  const [classId, setClassId] = useState('classe-test-a');
  const [privateNames, setPrivateNames] = useState(true);
  const [openedReport, setOpenedReport] = useState<string>('nessuno');
  const currentClass = useMemo(() => buildSyntheticClass(classId, count), [classId, count]);
  return (
    <div className="min-h-screen bg-[var(--background)] p-3 text-slate-100">
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" data-testid="fixture-toggle-privacy" onClick={() => setPrivateNames(x => !x)}>
          {privateNames ? 'Mostra nominativi di prova' : 'Proteggi nominativi di prova'}
        </button>
        <button type="button" data-testid="fixture-25" onClick={() => setCount(25)}>25 alunni</button>
        <button type="button" data-testid="fixture-8" onClick={() => setCount(8)}>8 alunni</button>
        <button type="button" data-testid="fixture-change-class" onClick={() => setClassId(id => id.endsWith('-a') ? 'classe-test-b' : 'classe-test-a')}>Cambia classe</button>
      </div>
      <p data-testid="fixture-report" className="text-xs text-slate-400">Scheda aperta: {openedReport}</p>
      {new URLSearchParams(window.location.search).get('view') === 'analytics' ? (
        <AnalyticsView currentClass={currentClass} settings={DEFAULT_SETTINGS}
          onOpenStudentReport={setOpenedReport} isPrivacyShieldActive={privateNames} />
      ) : <MatrixView
        currentClass={currentClass}
        onOpenStudentReport={setOpenedReport}
        isPrivacyShieldActive={privateNames}
      />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
