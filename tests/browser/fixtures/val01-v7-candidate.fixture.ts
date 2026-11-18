// Candidate-only fixture: no Vault access or runtime activation.
import { createAssessmentBackupPayloadV7, inspectAssessmentBackupPayload } from '../../../src/security/assessmentBackupPayload';
import { encryptDataWithPassword, decryptDataWithPassword } from '../../../src/cryptoUtils';
import type { CompleteSecureAppSnapshot } from '../../../src/security/secureAppStorage';
const password='synthetic-archive-backup-only';
const s={classId:'synthetic-class',schoolYear:'2026/2027',subjectCode:'TECH'};
const date='2026-11-12',stamp='2026-11-16T10:00:00.000Z';
const c={confirmedByTeacher:true,confirmedAt:stamp};
const proof={batchId:'synthetic-batch',date,period:'Q1',type:'disegno',title:'Schema sintetico'};
const fact={kind:'product',description:'Schema sintetico',method:'elaborato'};
function section():any{
  return {document:{version:1,...s,
    references:[{...c,referenceId:'o',revisionId:'o-r1',kind:'specific-objective',text:'Rappresentare relazioni',source:{kind:'local',sourceVersion:'v1'}}],
    criteria:[{...c,criterionId:'c',revisionId:'c-r1',description:'Relazioni',targetReferenceRevisionIds:['o-r1'],contextualReferenceRevisionIds:[]}],
    rubrics:[],assessments:[{...c,assessmentId:'a',revisionId:'a-r1',date,period:'Q1',title:proof.title,purpose:'formative',
      status:'completed',completedOn:date,source:{kind:'explicit-activity',activityId:'act-a'},criteria:[{criterionRevisionId:'c-r1',expected:{...fact}}]}],
    evidence:[{...c,evidenceId:'e',revisionId:'e-r1',observationEventId:'event-a',assessmentRevisionId:'a-r1',studentId:'synthetic-student',
      criterionRevisionId:'c-r1',observedOn:date,recordedAt:stamp,state:'observed',fact:{...fact},interpretation:{kind:'pending'}}]},
    bindings:[{kind:'assessment',assessmentRevisionId:'a-r1',link:{...s,proof:{...proof},confirmedByTeacher:true}},
      {kind:'evidence',evidenceRevisionId:'e-r1',link:{...s,proof:{...proof},confirmedByTeacher:true,individual:{studentId:'synthetic-student',gradeId:'synthetic-grade'}}}]};
}

Object.assign(globalThis,{__val01Candidate:{
  async make(source:CompleteSecureAppSnapshot){
    const snapshot=structuredClone(source);
    const klass=snapshot.appData.classes[0];
    if(klass.id!==s.classId||klass.students[0]?.id!=='synthetic-student')throw Error('Expected synthetic archive');
    klass.grades[0].value='9';
    const envelope={version:1,documents:[section()]};
    Object.assign(klass,{assessmentEvidenceV1:envelope});
    const p=await createAssessmentBackupPayloadV7(snapshot,[s],stamp);
    const backup=await encryptDataWithPassword(p,password);
    const decoded=await decryptDataWithPassword(backup,password);
    const inspected=await inspectAssessmentBackupPayload(decoded,source,[s]);
    return {backup,payloadVersion:inspected.sourceVersion,snapshot:inspected.snapshot,evidence:envelope};
  }
}});
