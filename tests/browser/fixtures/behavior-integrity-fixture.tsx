import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BehaviorsView } from '../../../src/components/BehaviorsView';
import type { ClassData, BehaviorRecord } from '../../../src/types';
import { today } from '../../../src/utils';
import { applyObservationChanges } from '../../../src/behavior/observationChanges';
import '../../../src/index.css';

// Synthetic classroom only. Both classes deliberately share a synthetic id
// to ensure context—not an id alone—controls the draft.
const initialDate = today();
const otherDate = '2025-01-15';
function makeClass(id: string, count: number): ClassData {
  return {
    id, name: 'Classe sintetica ' + id,
    students: Array.from({length: count}, (_, i) => ({
      id: 'synthetic-' + (i+1), name: 'Persona Fittizia ' + (i+1)
    })),
    grades: [],
    behaviors: [
      {id:id+'-existing-today', studentId:'synthetic-1', date:initialDate, status:id==='A'?'Costruttivo 👍':'Disattento ❌', note:'Nota sintetica conservata'},
      {id:id+'-existing-other', studentId:'synthetic-1', date:otherDate, status:'Distratto ⚠️', note:'Nota di altra giornata'}
    ]
  };
}
function Fixture() {
  const [classId,setClassId]=useState('A');
  const [count,setCount]=useState(8);
  const [privacy,setPrivacy]=useState(true);
  const [saved,setSaved]=useState<BehaviorRecord[]>([]);
  const [calls,setCalls]=useState(0);
  const [fail,setFail]=useState(false);
  const [pending,setPending]=useState(false);
  const [archive,setArchive]=useState<Record<string,BehaviorRecord[]>>({});
  const c=makeClass(classId,count);
  c.behaviors=archive[classId]??c.behaviors;
  async function save(records:BehaviorRecord[]) {
    setCalls(n=>n+1);
    setPending(true);
    try {
      await new Promise(resolve=>setTimeout(resolve,350));
      if(fail) throw Error('synthetic failure');
      setSaved(records);
      setArchive(old=>({...old,[classId]:applyObservationChanges({...c,behaviors:old[classId]??c.behaviors},records).behaviors}));
    } finally { setPending(false); }
  }
  return <div className="p-3 min-h-screen text-slate-100 bg-[var(--background)]">
    <div className="flex flex-wrap gap-2 text-xs">
      <button data-testid="fixture-class" onClick={()=>setClassId(v=>v==='A'?'B':'A')}>Cambia classe</button>
      <button data-testid="fixture-count" onClick={()=>setCount(v=>v===8?25:8)}>8 / 25</button>
      <button data-testid="fixture-privacy" onClick={()=>setPrivacy(v=>!v)}>Privacy</button>
      <button data-testid="fixture-fail" onClick={()=>setFail(v=>!v)}>Errore simulato</button>
    </div>
    <output data-testid="fixture-calls">{calls}</output>
    <output data-testid="fixture-pending">{String(pending)}</output>
    <output data-testid="fixture-saved" hidden>{JSON.stringify(saved)}</output>
    <BehaviorsView currentClass={c} isPrivacyShieldActive={privacy} onSaveBehaviors={save}/>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
