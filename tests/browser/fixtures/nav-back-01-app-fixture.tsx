import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/App';
import type { ClassData, Grade, Student } from '../../../src/types';
import type { SecureAppSnapshot, SecureAppStorage } from '../../../src/security/secureAppStorage';
import '../../../src/index.css';

/** Actual App navigation and professional views, but ONLY with synthetic data.
 * Storage is deliberately inert: these tests cannot persist real records.
 */
const students: Student[] = [
  { id: 'fittizio-studente-01', name: 'Persona Fittizia Uno' },
  { id: 'fittizio-studente-02', name: 'Persona Fittizia Due' },
];

const grades: Grade[] = students.map((student, i) => ({
  id: `fittizio-voto-${i + 1}`,
  batchId: 'fittizio-lotto',
  studentId: student.id,
  date: '2026-11-06',
  period: 'Q1' as const,
  title: 'Esercizio sintetico',
  type: 'test' as const,
  value: i === 0 ? '8' : '7'
}));

const syntheticClass: ClassData = {
  id: 'classe-fittizia-a',
  name: '3ª A – Prova sintetica',
  students, grades, behaviors: []
};

const initialSnapshot = {
  appData: { classes: [syntheticClass], currentClassId: null },
  udas: [],
  customTests: {},
  submissions: [],
  meta: { changes: 0, lastBackup: null }
} as unknown as SecureAppSnapshot;

// Safe for read-only UI journeys; no password, accounts, external services or writes.
const inertStorage = {} as SecureAppStorage;

window.history.replaceState({ tab: 'home', classId: null }, '', window.location.pathname);
createRoot(document.getElementById('root')!).render(
  <App
    initialSnapshot={initialSnapshot}
    secureStorage={inertStorage}
    onFactoryReset={async () => {}}
    headerSecurity={{
      autoLockMinutes: 15,
      onAutoLockChange: () => {},
      onLock: () => {}
    }}
  />
);
