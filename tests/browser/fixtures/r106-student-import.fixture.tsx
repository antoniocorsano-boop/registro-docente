import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StudentsManagementView } from '../../../src/components/StudentsManagementView';
import type { ClassData, Student } from '../../../src/types';

const roster: ClassData = {
  id: 'synthetic', name: 'Classe sintetica', students: [{ id: 'existing', name: 'Serra Lia' }],
  grades: [], behaviors: [],
};

function Fixture() {
  const [currentClass, setClass] = useState(roster);
  const [attempts, setAttempts] = useState(0);
  async function onBulkAddStudents(students: Student[]) {
    setAttempts(count => count + 1);
    if (new URLSearchParams(location.search).has('reject')) throw new Error('Synthetic durable failure');
    setClass(current => ({ ...current, students: [...current.students, ...students] }));
    return students.length;
  }
  return <>
    <output aria-label="Tentativi di salvataggio">{attempts}</output>
    <StudentsManagementView currentClass={currentClass} onBulkAddStudents={onBulkAddStudents}
      isPrivacyShieldActive={false} onAddStudent={async () => {}} onRemoveStudent={async () => {}}
      onInvertNames={async () => {}} />
  </>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
