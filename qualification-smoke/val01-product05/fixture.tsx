/** Qualification-only browser host; copied to a detached exact-SHA checkout.
 * Synthetic data, no persistence, network, export or real student identity.
 */
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StudentReportView} from '../../../src/components/StudentReportView';
import {boardDocument,boardScope} from './val01-s6c-data';
import type {ClassData,AppSettings} from '../../../src/types';
import '../../../src/index.css';

const roster=boardScope.studentIds.map((id,i)=>({id,name:'Studente sintetico '+(i+1)}));
const currentClass={id:boardScope.classId,name:'Classe sintetica',
  students:roster,grades:[],behaviors:[],
  assessmentEvidenceV1:{version:1,documents:[{document:boardDocument,bindings:[]}]}
} as ClassData;
const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode,useWeightedAverage:false} as AppSettings;
function Qualification(){
 const [id,setId]=useState('s1');
 const [privacy,setPrivacy]=useState(true);
 return <main className="max-w-5xl mx-auto p-2 sm:p-4 min-w-0">
  <h1 className="text-base font-semibold">Laboratorio S7 — fonti sintetiche</h1>
  <button type="button" data-testid="qual-privacy-toggle" className="min-h-[48px] p-2 border rounded"
    onClick={()=>setPrivacy(x=>!x)}>{privacy?'Disattiva protezione':'Attiva protezione'}</button>
  <StudentReportView currentClass={currentClass} selectedStudentId={id} onSelectStudent={setId}
    settings={settings} udas={[]} isPrivacyShieldActive={privacy}/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Qualification/>);
