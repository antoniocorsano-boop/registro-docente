// VAL-01/D1a.2b.2 — synthetic RED contract; no runtime or persistence.
import { describe, expect, test } from 'bun:test';
import { proposeAssessmentRevisionBinding } from '../assessment/assessmentRevisionBindings';
import { projectIndividualAssessmentEvidence } from '../assessment/assessmentEvidenceProjection';

const context={classId:'class-a',schoolYear:'2026/2027',subjectCode:'TECH'};
const scope={...context,studentIds:['s1','s2']};
const stamp='2026-11-16T10:00:00.000Z', date='2026-11-16';
const proof={batchId:'daily_12345678-1234-4123-8123-123456789abc',date,period:'Q1',type:'disegno',title:'Schema sintetico'};
const confirm={confirmedByTeacher:true,confirmedAt:stamp};
const local={kind:'local',sourceVersion:'v1'};
const fact={kind:'product',description:'Schema sintetico',method:'elaborato'};
function fixture():any {
  return {version:1,...context,
    references:[{...confirm,referenceId:'o',revisionId:'o-r1',kind:'specific-objective',text:'Rappresentare relazioni',source:local}],
    criteria:[{...confirm,criterionId:'c',revisionId:'c-r1',description:'Relazioni',targetReferenceRevisionIds:['o-r1'],contextualReferenceRevisionIds:[]}],
    rubrics:[],
    assessments:[{...confirm,assessmentId:'a',revisionId:'a-r1',date,period:'Q1',title:proof.title,
      purpose:'formative',status:'completed',completedOn:date,source:{kind:'explicit-activity',activityId:'activity-a'},
      criteria:[{criterionRevisionId:'c-r1',expected:{...fact}}]}],
    evidence:['s1','s2'].map((studentId,i)=>({...confirm,evidenceId:'e'+(i+1),revisionId:'e'+(i+1)+'-r1',
      observationEventId:'event'+(i+1),assessmentRevisionId:'a-r1',studentId,criterionRevisionId:'c-r1',
      observedOn:date,recordedAt:stamp,state:'observed',fact:{...fact},interpretation:{kind:'pending'}}))};
}
function archive():any {
  return {currentClassId:'class-a',classes:[{id:'class-a',name:'Classe sintetica',students:[
    {id:'s1',name:'Alunno sintetico 1'},{id:'s2',name:'Alunno sintetico 2'}],grades:[
    {...proof,id:'g1',studentId:'s1',value:'8'},{...proof,id:'g2',studentId:'s2',value:'8'}],behaviors:[]}]};
}
function batch(revision='a-r1',p=proof):any {return {kind:'assessment',assessmentRevisionId:revision,link:{...context,proof:{...p},confirmedByTeacher:true}};}
function individual(revision='e1-r1',studentId='s1',gradeId='g1',p=proof):any {
  return {kind:'evidence',evidenceRevisionId:revision,link:{...context,proof:{...p},confirmedByTeacher:true,individual:{studentId,gradeId}}};
}
const propose=(d:any,a:any,b:unknown,r:unknown,s:unknown=scope)=>proposeAssessmentRevisionBinding(d,s,a,b,r);
const success=(status:string,bindings:unknown[])=>({valid:true,status,bindings});
const reject=(r:any)=>expect(r.valid).toBe(false);
function reviseAssessment(d:any,changes:Record<string,unknown>={}):void {
  d.assessments.push({...d.assessments[0],revisionId:'a-r2',supersedesRevisionId:'a-r1',...changes});
}
function reviseEvidence(d:any,changes:Record<string,unknown>={}):void {
  d.evidence.push({...d.evidence[0],revisionId:'e1-r2',supersedesRevisionId:'e1-r1',...changes});
}
function secondAssessment(d:any):void {
  d.assessments.push({...d.assessments[0],assessmentId:'b',revisionId:'b-r1',source:{kind:'explicit-activity',activityId:'activity-b'}});
}

describe('VAL-01/D1a.2b.2 — frozen revision bindings',()=>{
  test('adds a confirmed batch link without mutating document, archive, or request',()=>{
    const d=fixture(),a=archive(),b:any[]=[],r=batch(),before=structuredClone([d,a,b,r]);
    expect(propose(d,a,b,r)).toEqual(success('added',[r]));
    expect([d,a,b,r]).toEqual(before);
  });
  test('individual link needs the exact pre-existing assessment revision link',()=>{
    const d=fixture(),a=archive(),r=individual();
    reject(propose(d,a,[],r));
    expect(propose(d,a,[batch()],r)).toEqual(success('added',[batch(),r]));
  });
  test('identical retry is a no-op and conflicting revision is not replaced',()=>{
    const d=fixture(),a=archive(),b=[batch(),individual()];
    expect(propose(d,a,b,individual())).toEqual(success('unchanged',b));
    expect(propose(d,a,b,batch())).toEqual(success('unchanged',b));
    reject(propose(d,a,b,individual('e1-r1','s1','g-other')));
    expect(b).toEqual([batch(),individual()]);
  });
  test('same batch cannot belong to a second logical assessment',()=>{
    const d=fixture();secondAssessment(d);
    reject(propose(d,archive(),[batch()],batch('b-r1')));
  });
  test('a distinct event can explicitly refer to the same grade',()=>{
    const d=fixture();d.evidence.push({...d.evidence[0],evidenceId:'e3',revisionId:'e3-r1',observationEventId:'event3'});
    const b=[batch(),individual()],r=individual('e3-r1');
    expect(propose(d,archive(),b,r)).toEqual(success('added',[...b,r]));
  });
  test('new assessment revision must be explicitly confirmed, old proof remains frozen',()=>{
    const d=fixture(),a=archive(),b=[batch(),individual()];
    reviseAssessment(d,{title:'Schema aggiornato'});
    const next={...proof,title:'Schema aggiornato'};
    for(const g of a.classes[0].grades)g.title=next.title;
    reject(propose(d,a,b,batch()));
    expect(propose(d,a,b,batch('a-r2',next))).toEqual(success('added',[...b,batch('a-r2',next)]));
    expect(b[0].link.proof.title).toBe(proof.title);
  });
  test('a new batch cannot silently replace the original logical assessment batch',()=>{
    const d=fixture(),a=archive();reviseAssessment(d);
    const next={...proof,batchId:'other-batch'};
    for(const g of a.classes[0].grades)g.batchId=next.batchId;
    reject(propose(d,a,[batch()],batch('a-r2',next)));
  });
  test('cancelled or planned assessment cannot receive a new link; historical cancellation does not free batch',()=>{
    const d=fixture();reviseAssessment(d,{status:'cancelled'});delete d.assessments[1].completedOn;
    secondAssessment(d);
    reject(propose(d,archive(),[batch(),individual()],batch('a-r2')));
    reject(propose(d,archive(),[batch(),individual()],batch('b-r1')));
    const p=fixture();p.assessments[0].status='planned';delete p.assessments[0].completedOn;p.evidence=[];
    reject(propose(p,archive(),[],batch()));
  });
  test('evidence student, grade and proof must all match',()=>{
    const d=fixture(),a=archive(),b=[batch()];
    reject(propose(d,a,b,individual('e1-r1','s2','g2')));
    reject(propose(d,a,b,individual('e1-r1','s1','g2')));
    reject(propose(d,a,b,individual('e1-r1','s1','g1',{...proof,type:'orale'})));
    reject(propose(d,a,b,individual('missing')));
  });
  test('missing or replaced grade never reassigns a historical link',()=>{
    const d=fixture(),a=archive(),b=[batch(),individual()];
    a.classes[0].grades[0].id='g-new';
    reject(propose(d,a,b,individual()));
    reviseEvidence(d);
    reject(propose(d,a,b,individual('e1-r2','s1','g-new')));
    expect(b[1].link.individual.gradeId).toBe('g1');
  });
  test('explicit correction can retain grade identity without automatically inheriting link',()=>{
    const d=fixture();reviseEvidence(d,{fact:{...fact,description:'Schema corretto'}});
    const b=[batch(),individual()],r=individual('e1-r2');
    reject(propose(d,archive(),b,individual()));
    expect(propose(d,archive(),b,r)).toEqual(success('added',[...b,r]));
  });
  test('non-observed and not-applicable evidence have no new individual link',()=>{
    for(const state of ['not_observed','not_applicable']){
      const d=fixture(),e=d.evidence[0];e.state=state;delete e.fact;delete e.interpretation;
      reject(propose(d,archive(),[batch()],individual()));
    }
  });
  test('withdrawal preserves history but cannot link the withdrawal revision',()=>{
    const d=fixture();reviseEvidence(d,{state:'withdrawn',reason:'Ritiro sintetico'});
    delete d.evidence[2].fact;delete d.evidence[2].interpretation;
    const b=[batch(),individual()];
    reject(propose(d,archive(),b,individual('e1-r2')));
    expect(propose(d,archive(),b,individual('e2-r1','s2','g2'))).toEqual(success('added',[...b,individual('e2-r1','s2','g2')]));
  });
  test('historical proof is not silently updated when current archive differs',()=>{
    const d=fixture(),a=archive(),b=[batch(),individual()];
    a.classes[0].grades[0].id='g-new';
    const r=individual('e2-r1','s2','g2');
    expect(propose(d,a,b,r)).toEqual(success('added',[...b,r]));
    expect(b[1].link.individual.gradeId).toBe('g1');
  });
  test('title, date, period, confirmation, scope and closed shape must match',()=>{
    const d=fixture(),a=archive();
    for(const field of ['title','date','period']){const r=batch();r.link.proof[field]='other';reject(propose(d,a,[],r));}
    const unconfirmed=batch();unconfirmed.link.confirmedByTeacher=false;reject(propose(d,a,[],unconfirmed));
    const foreign=batch();foreign.link.subjectCode='OTHER';reject(propose(d,a,[],foreign));
    const extra=batch();extra.link.generatedLevel='A';reject(propose(d,a,[],extra));
    const wrongIndividual=batch();wrongIndividual.link.individual={studentId:'s1',gradeId:'g1'};reject(propose(d,a,[],wrongIndividual));
  });
  test('malformed historical collection fails even if the requested link is valid',()=>{
    const d=fixture(),a=archive(),r=individual();
    for(const b of [[batch(),batch()],[individual()],[batch('missing')],[{...batch(),extra:true}],[batch(),individual('e1-r1','s2','g2')]])reject(propose(d,a,b,r));
    let called=false;const malformed={get kind(){called=true;return 'assessment';}};
    reject(propose(d,a,[malformed],r));expect(called).toBe(false);
  });
  test('invalid document and scope fail closed without projecting other students',()=>{
    const d=fixture();d.evidence[0].criterionRevisionId='missing';
    reject(propose(d,archive(),[],batch()));
    reject(propose(fixture(),archive(),[],batch(),{...scope,studentIds:['s1','s1']}));
  });
  test('grade value and unlinked events never change evidence or its projection',()=>{
    const d=fixture(),a=archive(),before=projectIndividualAssessmentEvidence(d,scope,'s1');
    const b=[batch(),individual()];a.classes[0].grades[0].value='6';
    expect(propose(d,a,b,individual())).toEqual(success('unchanged',b));
    expect(projectIndividualAssessmentEvidence(d,scope,'s1')).toEqual(before);
    expect(d.evidence).toHaveLength(2);
  });
  test('no online or malformed batch and no output aliases',()=>{
    const d=fixture(),a=archive();
    for(const batchId of ['online_1','daily_invalid']){const p={...proof,batchId};for(const g of a.classes[0].grades)g.batchId=batchId;reject(propose(d,a,[],batch('a-r1',p)));}
    const r=batch(),result=propose(d,archive(),[],r);
    expect(result.valid).toBe(true);
    if(result.valid){expect(result.bindings[0]).not.toBe(r);expect(result.bindings[0].link.proof).not.toBe(r.link.proof);}
  });
});
