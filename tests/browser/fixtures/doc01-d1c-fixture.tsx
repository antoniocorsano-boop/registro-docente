import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DocumentPlanningPreview} from '../../../src/components/documents/DocumentPlanningPreview';
import '../../../src/index.css';
const context={institutionId:'demo-school',classId:'demo-class',schoolYear:'2026/2027',subject:'TEC',grade:2,cohort:'demo-cohort',purpose:'annual-council-planning'};
const template={id:'demo-council',version:1,institutionId:'demo-school',grade:2,status:'synthetic'};
const base={sourceId:'demo-private-ref',revision:1,context,state:'confirmed',mapping:'resolved'};
function Fixture(){
  const [revision,setRevision]=useState(1);
  const [invalid,setInvalid]=useState(false);
  const sources=[
    {...base,revision,field:'objectives',value:'technical-systems',origin:'arena',authority:'approved-current'},
    {...base,field:'transversal',value:'responsible-citizenship',origin:'arena',authority:'provisional'},
    {...base,field:'completedCount',value:0,origin:'registro',authority:'not-applicable'},
    {...base,field:'assessmentMethods',value:'practical-task',origin:'docente-os',authority:'not-applicable'},
  ];
  return <main className="min-h-screen">
    <div className="mx-auto max-w-2xl flex flex-wrap gap-2 p-3 text-sm border-b" aria-label="Comandi della dimostrazione">
      <button className="border rounded px-3 py-2" onClick={()=>setRevision(x=>x+1)}>Modifica la fonte</button>
      <button className="border rounded px-3 py-2" onClick={()=>setInvalid(x=>!x)}>Cambia contesto di prova</button>
    </div>
    <DocumentPlanningPreview context={invalid?{...context,classId:'demo-other'}:context} template={template} sources={sources}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
