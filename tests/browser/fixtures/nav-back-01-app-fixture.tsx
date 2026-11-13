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

// Opt-in synthetic roster for visual evidence; ordinary navigation fixtures remain unchanged.
const visualRoster = new URLSearchParams(window.location.search).get('visualRoster');
const rosterSize = visualRoster === '25' ? 25 : visualRoster === '8' ? 8 : 2;
for (let i = students.length; i < rosterSize; i++) {
  const n = String(i + 1).padStart(2, '0');
  students.push({ id: `fittizio-studente-${n}`, name: `Persona Fittizia ${n}` });
}

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
if (rosterSize > 2) {
  students.forEach((student, i) => grades.push({
    id: `fittizio-voto-q2-${i + 1}`, batchId: 'fittizio-lotto-q2', studentId: student.id,
    date: '2026-11-10', period: 'Q2', title: 'Esercizio sintetico Q2', type: 'test', value: i % 2 ? '6' : '9'
  }));
}

if(new URLSearchParams(window.location.search).get('pdfRoster')==='1') {
  grades.forEach(g=>{g.title='Proprietà dei materiali: esercizio';});
  for(let i=1;i<=45;i++)grades.push({id:'pdf-'+i,studentId:students[0].id,date:'2026-11-12',period:'Q1',title:'RIGA-'+String(i).padStart(3,'0')+' attività sintetica',type:i%2?'test':'disegno',value:i===3?'NC':'8'});
  grades.push({id:'pdf-peer',studentId:students[1].id,date:'2026-11-12',period:'Q1',title:'Scelta dei materiali per un oggetto',type:'orale',value:'6'});
}
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
  meta: { changes: new URLSearchParams(window.location.search).get('matrixWrite')==='1'?9:0, lastBackup: null }
} as unknown as SecureAppSnapshot;

// Safe for read-only UI journeys; no password, accounts, external services or writes.
const inertStorage = (new URLSearchParams(window.location.search).get('matrixWrite')==='1'?{
  saveAppDataAndMeta:async(data:unknown,meta:unknown)=>{(window as any).__matrixWrites=((window as any).__matrixWrites||0)+1;if((window as any).__matrixFail)throw Error('Synthetic write failure');if((window as any).__matrixHold)await new Promise<void>(resolve=>{(window as any).__finishMatrixWrite=resolve;});(window as any).__matrixSaved=structuredClone(data);(window as any).__matrixMeta=structuredClone(meta);}
}:{}) as unknown as SecureAppStorage;

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
