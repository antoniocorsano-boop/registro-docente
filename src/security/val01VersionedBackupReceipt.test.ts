// Synthetic only. The versioned authority is isolated; no production writes.
import {describe,expect,test} from 'bun:test';
import {createVersionedBackupReceiptAuthority,verifiedBackupDateForVersion} from '../persistence/versionedBackupReceipt';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {AndroidBackupRuntime} from './androidBackupExport';
import {decryptDataWithPassword} from '../cryptoUtils';
import {expectedBackupEvidence} from './webBackupVerification';
import {createBackupPayload} from './backupPayload';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
const s={classId:'class-a',schoolYear:'2026/2027',subjectCode:'TECH'};
const date='2026-11-16',stamp='2026-11-16T10:00:00.000Z';
const c={confirmedByTeacher:true,confirmedAt:stamp};
const proof={batchId:'batch-synthetic',date,period:'Q1',type:'disegno',title:'Schema sintetico'};
const fact={kind:'product',description:'Schema sintetico',method:'elaborato'};
function section():any{
  return {document:{version:1,...s,
    references:[{...c,referenceId:'o',revisionId:'o-r1',kind:'specific-objective',text:'Rappresentare relazioni',source:{kind:'local',sourceVersion:'v1'}}],
    criteria:[{...c,criterionId:'c',revisionId:'c-r1',description:'Relazioni',targetReferenceRevisionIds:['o-r1'],contextualReferenceRevisionIds:[]}],
    rubrics:[],assessments:[{...c,assessmentId:'a',revisionId:'a-r1',date,period:'Q1',title:proof.title,purpose:'formative',
      status:'completed',completedOn:date,source:{kind:'explicit-activity',activityId:'act-a'},criteria:[{criterionRevisionId:'c-r1',expected:{...fact}}]}],
    evidence:[{...c,evidenceId:'e',revisionId:'e-r1',observationEventId:'event-a',assessmentRevisionId:'a-r1',studentId:'s1',
      criterionRevisionId:'c-r1',observedOn:date,recordedAt:stamp,state:'observed',fact:{...fact},interpretation:{kind:'pending'}}]},
    bindings:[{kind:'assessment',assessmentRevisionId:'a-r1',link:{...s,proof:{...proof},confirmedByTeacher:true}},
      {kind:'evidence',evidenceRevisionId:'e-r1',link:{...s,proof:{...proof},confirmedByTeacher:true,individual:{studentId:'s1',gradeId:'g1'}}}]};
}
function legacy():any{return {classes:[{id:'class-a',name:'Classe sintetica',students:[{id:'s1',name:'Sintetico 1'},{id:'s2',name:'Sintetico 2'}],grades:[],behaviors:[]},
  {id:'class-b',name:'Altra classe sintetica',students:[{id:'s3',name:'Sintetico 3'}],grades:[],behaviors:[]}],currentClassId:'class-b'};}
function archive():any{const a=legacy();a.classes[0].assessmentEvidenceV1={version:1,documents:[section()]};return a;}

function base():CompleteSecureAppSnapshot{
  const x=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
  x.appData=legacy();
  x.meta={changes:4,lastBackup:null};
  return x;
}
function withEvidence():CompleteSecureAppSnapshot{
  const x=base();x.appData=archive();return x;
}

const password='synthetic-receipt-password';
const meta=(changes=6)=>({changes,lastBackup:null});
const prepare=(authority:ReturnType<typeof createVersionedBackupReceiptAuthority>,snapshot=base())=>authority.prepare(snapshot,[s],password,stamp);
const blob=(encryptedText:string)=>new Blob([encryptedText]);
function native(mode:'ok'|'cancel'|'bad-hash'|'bad-bytes'='ok',onWrite=()=>{}):AndroidBackupRuntime {
  return {androidBridge:true,sessionAccess:async active=>active(),Capacitor:{Plugins:{RegistroBackupFiles:{
    chooseBackupDestination:async()=>mode==='cancel'?{status:'cancelled'}:{status:'selected',token:'synthetic-token'},
    writeEncryptedBackup:async({encryptedText})=>{
      onWrite();
      const e=await expectedBackupEvidence(encryptedText);
      return {status:'verified',bytes:mode==='bad-bytes'?e.bytes+1:e.bytes,sha256:mode==='bad-hash'?'0'.repeat(64):e.sha256};
    }
  }}}};
}
describe('VAL-01/D1b.2c — version-bound verified copy authority',()=>{
  test('both versions derive evidence from actual encrypted payload, not caller-provided version or digest',async()=>{
    for(const version of [6,7] as const){
      const a=createVersionedBackupReceiptAuthority(version);
      const p=await prepare(a,version===7?withEvidence():base());
      const decoded=await decryptDataWithPassword(p.encryptedText,password);
      expect(decoded.backupDataVersion).toBe(version);
      expect(decoded.snapshot.meta).toEqual({changes:0,lastBackup:stamp});
      expect(p.evidence).toEqual({...await expectedBackupEvidence(p.encryptedText),payloadVersion:version});
      expect(Object.keys(p.receipt).sort()).toEqual(['checkpointAt','includedChanges','payloadVersion']);
      expect(JSON.stringify(p.receipt)).not.toContain('Sintetico');
      expect(await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true)).toBe('verified');
      const next=a.consume(meta(),p.receipt,version);
      expect(next.changes).toBe(2);
      expect(next.verifiedBackupEvidence).toEqual({...p.evidence,source:'web-readback',checkpointAt:stamp});
      expect(verifiedBackupDateForVersion(next,version)).toBe(stamp);
      expect(verifiedBackupDateForVersion(next,version===6?7:6)).toBeNull();
    }
  });
  test('v6 authority rejects an archive containing assessment evidence even under a forged historical label',async()=>{
    const a=createVersionedBackupReceiptAuthority(6);
    await expect(prepare(a,withEvidence())).rejects.toThrow();
    const p=await prepare(a);
    expect((await decryptDataWithPassword(p.encryptedText,password)).backupDataVersion).toBe(6);
  });
  test('a verified v6 receipt cannot attest an archive now requiring v7',async()=>{
    const a=createVersionedBackupReceiptAuthority(6),p=await prepare(a);
    await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true);
    expect(()=>a.consume(meta(),p.receipt,7)).toThrow();
    expect(()=>a.consume(meta(),p.receipt,6)).toThrow();
  });
  test('v7 with no evidence still has version 7, never v6',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),p=await prepare(a);
    expect((await decryptDataWithPassword(p.encryptedText,password)).backupDataVersion).toBe(7);
    expect(p.receipt.payloadVersion).toBe(7);
  });
  test('no readback, copied receipt, replay, or foreign authority cannot acknowledge a copy',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),b=createVersionedBackupReceiptAuthority(7);
    const unverified=await prepare(a);
    expect(()=>a.consume(meta(),unverified.receipt,7)).toThrow();
    const p=await prepare(a),q=await prepare(b);
    await expect(a.verifyWeb({...p.receipt},blob(p.encryptedText),()=>true)).rejects.toThrow();
    await expect(b.verifyWeb(p.receipt,blob(p.encryptedText),()=>true)).rejects.toThrow();
    await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true);
    expect(()=>a.consume(meta(),q.receipt,7)).toThrow();
    expect(a.consume(meta(),p.receipt,7).changes).toBe(2);
    expect(()=>a.consume(meta(),p.receipt,7)).toThrow();
  });
  test('wrong file of equal length, another authentic ciphertext and oversized file cannot verify',async()=>{
    const a=createVersionedBackupReceiptAuthority(7);
    for(const wrong of ['same-length','other-copy','oversize']){
      const p=await prepare(a);
      const file=wrong==='same-length'?blob(p.encryptedText.replace(/./,'X')):wrong==='other-copy'?blob((await prepare(createVersionedBackupReceiptAuthority(7))).encryptedText):new Blob([new Uint8Array(32*1024*1024+1)]);
      await expect(a.verifyWeb(p.receipt,file,()=>true)).rejects.toThrow();
      expect(()=>a.consume(meta(),p.receipt,7)).toThrow();
    }
  });
  test('native path verifies only exact encrypted bytes and derives Android source internally',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),p=await prepare(a,withEvidence());
    let writes=0;
    expect(await a.verifyAndroid(p.receipt,p.encryptedText,'synthetic.enc',()=>true,native('ok',()=>writes++))).toBe('verified');
    expect(writes).toBe(1);
    expect(a.consume(meta(),p.receipt,7).verifiedBackupEvidence).toEqual({...p.evidence,source:'android-readback',checkpointAt:stamp});
    const q=await prepare(a);
    await expect(a.verifyAndroid(q.receipt,q.encryptedText+'x','synthetic.enc',()=>true,native('ok',()=>writes++))).rejects.toThrow();
    expect(writes).toBe(1);
    expect(()=>a.consume(meta(),q.receipt,7)).toThrow();
  });
  test('native cancellation, incorrect readback bytes and hash do not authorize any receipt',async()=>{
    const a=createVersionedBackupReceiptAuthority(7);
    const p=await prepare(a);
    expect(await a.verifyAndroid(p.receipt,p.encryptedText,'synthetic.enc',()=>true,native('cancel'))).toBe('cancelled');
    expect(()=>a.consume(meta(),p.receipt,7)).toThrow();
    for(const mode of ['bad-hash','bad-bytes'] as const){
      const q=await prepare(a);
      await expect(a.verifyAndroid(q.receipt,q.encryptedText,'synthetic.enc',()=>true,native(mode))).rejects.toThrow();
      expect(()=>a.consume(meta(),q.receipt,7)).toThrow();
    }
  });
  test('lock during asynchronous readback, reset or newer preparation invalidates old receipt',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),p=await prepare(a);
    let active=true;
    const original=blob(p.encryptedText);
    const file=new Blob([p.encryptedText]);
    Object.defineProperty(file,'arrayBuffer',{value:async()=>{active=false;return original.arrayBuffer();}});
    expect(await a.verifyWeb(p.receipt,file,()=>active)).toBe('cancelled');
    expect(()=>a.consume(meta(),p.receipt,7)).toThrow();
    const q=await prepare(a);a.invalidate();
    await expect(a.verifyWeb(q.receipt,blob(q.encryptedText),()=>true)).rejects.toThrow();
    const old=await prepare(a),newer=await prepare(a);
    await expect(a.verifyWeb(old.receipt,blob(old.encryptedText),()=>true)).rejects.toThrow();
    await a.verifyWeb(newer.receipt,blob(newer.encryptedText),()=>true);
    expect(a.consume(meta(),newer.receipt,7).changes).toBe(2);
  });
  test('snapshot is frozen at preparation and later modifications remain outstanding',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),x=withEvidence();
    const pending=prepare(a,x);
    x.meta.changes=8;x.appData.classes[0].name='Modifica successiva';
    const p=await pending;
    const decoded=await decryptDataWithPassword(p.encryptedText,password);
    expect(decoded.snapshot.appData.classes[0].name).toBe('Classe sintetica');
    expect(p.receipt.includedChanges).toBe(4);
    await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true);
    expect(a.consume(meta(8),p.receipt,7).changes).toBe(4);
  });
  test('failed metadata persistence never publishes and cannot replay consumed receipt',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),p=await prepare(a);
    await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true);
    const coordinator=createDurableMutationCoordinator();
    let current:any=meta();
    const record=()=>coordinator.enqueue({getCommitted:()=>current,derive:previous=>a.consume(previous,p.receipt,7),persist:async()=>{throw Error('synthetic write failure');},publish:next=>{current=next;}});
    await expect(record()).rejects.toThrow('synthetic write failure');
    expect(current).toEqual(meta());
    await expect(record()).rejects.toThrow();
    expect(current).toEqual(meta());
  });
  test('historical v6 evidence is still recognized for v6 but not v7, malformed evidence never attests',()=>{
    const evidence={bytes:123,sha256:'a'.repeat(64),source:'web-readback' as const,payloadVersion:6 as const,checkpointAt:stamp};
    const old={changes:0,lastBackup:stamp,verifiedBackupAt:stamp,verifiedBackupEvidence:evidence};
    expect(verifiedBackupDateForVersion(old,6)).toBe(stamp);
    expect(verifiedBackupDateForVersion(old,7)).toBeNull();
    expect(verifiedBackupDateForVersion({...old,verifiedBackupEvidence:{...evidence,bytes:0}},6)).toBeNull();
    expect(verifiedBackupDateForVersion({...old,verifiedBackupEvidence:{...evidence,sha256:'bad'}},6)).toBeNull();
    expect(verifiedBackupDateForVersion({...old,verifiedBackupEvidence:{...evidence,checkpointAt:'wrong'}},6)).toBeNull();
  });
  test('local-only attestation does not travel in either payload, including a prior v7 attestation',async()=>{
    const a=createVersionedBackupReceiptAuthority(7),p=await prepare(a);
    await a.verifyWeb(p.receipt,blob(p.encryptedText),()=>true);
    const x=base();x.meta=a.consume(meta(),p.receipt,7) as any;
    for(const version of [6,7] as const){
      const q=await prepare(createVersionedBackupReceiptAuthority(version),x);
      const decoded=await decryptDataWithPassword(q.encryptedText,password);
      expect(decoded.snapshot.meta).toEqual({changes:0,lastBackup:stamp});
    }
  });
});
