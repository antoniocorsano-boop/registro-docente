import { describe, test, expect } from 'bun:test';
import { createDocumentReview } from '../documents/documentPresentation';
import { readFileSync } from 'node:fs';
const context={institutionId:'demo-school',classId:'demo-class',schoolYear:'2026/2027',subject:'TEC',grade:2,cohort:'demo-cohort',purpose:'annual-council-planning'};
const template={id:'demo-council',version:1,institutionId:'demo-school',grade:2,status:'synthetic'};
const source={field:'objectives',value:'technical-systems',origin:'arena',sourceId:'demo-private-ref',revision:1,context,state:'confirmed',authority:'approved-current',mapping:'resolved'};
const make=(sources=[source])=>createDocumentReview(context,template,sources);
describe('DOC-01/D1c isolated document review',()=>{
  test('only professional presentation, no raw basis or technical identifiers',()=>{
    const r=make(); expect(r.valid).toBe(true);
    const p=r.review.presentation;
    expect(p.fields[0]).toMatchObject({label:'Obiettivi disciplinari',value:'Sistemi tecnologici',status:'Disponibile'});
    expect(JSON.stringify(p)).not.toMatch(/demo-private-ref|demo-class|technical-systems|basis|revision/);
    expect(Object.keys(r.review).sort()).toEqual(['isCurrent','presentation']);
  });
  test('withholds unconfirmed value and distinguishes missing from zero',()=>{
    const r=make([{...source,state:'provisional'},{...source,field:'completedCount',origin:'registro',authority:'not-applicable',value:0}]);
    expect(r.valid).toBe(true);
    expect(r.review.presentation.fields[0]).toMatchObject({status:'Da verificare',value:null});
    expect(r.review.presentation.fields[2]).toMatchObject({status:'Mancante',value:null});
    expect(r.review.presentation.fields[3]).toMatchObject({status:'Disponibile',value:'0'});
    expect(r.review.presentation.complete).toBe(false);
  });
  test('opaque review checks current sources and context including withheld revisions',()=>{
    const r=make([{...source,state:'provisional'}]); expect(r.valid).toBe(true);
    expect(r.review.isCurrent(context,template,[{...source,state:'provisional'}])).toBe(true);
    expect(r.review.isCurrent(context,template,[{...source,state:'provisional',revision:2}])).toBe(false);
    expect(r.review.isCurrent({...context,classId:'demo-other'},template,[source])).toBe(false);
  });
  test('invalid source never becomes presentation',()=>{
    expect(make([{...source,studentId:'demo-person'}])).toEqual({valid:false});
  });
  test('presentation is frozen, including rows, and no automatic approval or completion',()=>{
    const r=make(); expect(r.valid).toBe(true);
    expect(Object.isFrozen(r.review.presentation)).toBe(true);
    expect(Object.isFrozen(r.review.presentation.fields)).toBe(true);
    expect(Object.isFrozen(r.review.presentation.fields[0])).toBe(true);
    expect(r.review.presentation.complete).toBe(false);
    expect(r.review.presentation.official).toBe(false);
  });
  test('preview module is not wired to production or persistence',()=>{
    for(const path of ['src/App.tsx','src/main.tsx']) expect(readFileSync(path,'utf8')).not.toContain('DocumentPlanningPreview');
    const ui=readFileSync('src/components/documents/DocumentPlanningPreview.tsx','utf8');
    expect(ui).not.toMatch(/localStorage|indexedDB|fetch\(|window\.print|download\s*=/);
  });
});
