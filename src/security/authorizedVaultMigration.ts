/**
 * VAL-01/D1b.3b — isolated authorization for an existing DB1 archive.
 * No production call sites, no backup checkpoint writes, no new cryptography.
 * Session owner must invalidate on lock/reset/restore and serialize migration
 * with mutations. The physical comparison inside the upgrade is the final gate.
 */
import { VersionFencedVaultStore, validMeta, validRecords } from './versionFencedVaultStore';
import { deriveKeyEncryptionKey, unwrapDataEncryptionKey, decryptJsonRecord } from './cryptoPrimitives';
import { decryptDataWithPassword, BACKUP_VERSION_V2 } from '../cryptoUtils';
import { inspectAssessmentBackupPayload } from './assessmentBackupPayload';
import { createBackupPayload } from './backupPayload';
import { withoutLocalBackupVerification } from '../persistence/backupCheckpoint';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';
import type { VaultMetadataV1, EncryptedVaultRecord } from './vaultTypes';

const NAME='registro-docente-secure-vault';
const invalid=()=>new Error('Migrazione non autorizzata: archivio o copia di recupero non verificabili.');
type Physical={metadata:VaultMetadataV1;records:EncryptedVaultRecord[]};
type Grant=Readonly<{bytes:number;sha256:string;payloadVersion:6}>;
const maxBytes=32*1024*1024;
function same(a:unknown,b:unknown):boolean{
  if(a===b)return true;
  if(a instanceof ArrayBuffer&&b instanceof ArrayBuffer)return same(new Uint8Array(a),new Uint8Array(b));
  if(a instanceof Uint8Array&&b instanceof Uint8Array)return a.length===b.length&&a.every((v,i)=>v===b[i]);
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  const k=Object.keys(x).sort(),l=Object.keys(y).sort();
  return k.length===l.length&&k.every((v,i)=>v===l[i]&&same(x[v],y[v]));
}
function checked(metadata:unknown,records:unknown):Physical{
  if(!validMeta(metadata)||!validRecords(records))throw invalid();
  return {metadata:metadata as VaultMetadataV1,records:(records as EncryptedVaultRecord[]).sort((a,b)=>a.recordKey.localeCompare(b.recordKey))};
}
/** Atomic read-only capture. An absent DB must not be created. */
function capture(factory:IDBFactory):Promise<Physical>{
  return new Promise((resolve,reject)=>{
    const request=factory.open(NAME,1);
    let abandoned=false;
    request.onblocked=()=>{abandoned=true;reject(invalid());};
    request.onupgradeneeded=()=>{request.transaction?.abort();};
    request.onerror=()=>reject(invalid());
    request.onsuccess=()=>{
      const db=request.result;
      if(abandoned){db.close();return;}
      try{
        if(db.version!==1||db.objectStoreNames.length!==2||
          !db.objectStoreNames.contains('metadata')||!db.objectStoreNames.contains('records'))throw invalid();
        const tx=db.transaction(['metadata','records'],'readonly');
        const meta=tx.objectStore('metadata'),records=tx.objectStore('records');
        if(meta.keyPath!==null||meta.autoIncrement||records.keyPath!=='recordKey'||records.autoIncrement)throw invalid();
        const keys=meta.getAllKeys(),m=meta.get('current'),r=records.getAll();
        db.onversionchange=()=>db.close();
        tx.oncomplete=()=>{
          db.close();
          try{
            if(keys.result.length!==1||keys.result[0]!=='current')throw invalid();
            resolve(checked(m.result,r.result));
          }catch{reject(invalid());}
        };
        tx.onabort=tx.onerror=()=>{db.close();reject(invalid());};
      }catch{db.close();reject(invalid());}
    };
  });
}
async function authenticate(p:Physical,password:string):Promise<CompleteSecureAppSnapshot>{
  const m=p.metadata;
  const kek=await deriveKeyEncryptionKey(password,m.salt);
  const dek=await unwrapDataEncryptionKey(m.wrappedDek,m.wrapIv,kek);
  const entries=await Promise.all(p.records.map(async r=>[r.recordKey,await decryptJsonRecord<unknown>(r,dek)]));
  return Object.fromEntries(entries) as unknown as CompleteSecureAppSnapshot;
}
async function verifyCopy(snapshot:CompleteSecureAppSnapshot,file:Blob,password:string):Promise<Grant>{
  if(!(file instanceof Blob)||file.size<=0||file.size>maxBytes)throw invalid();
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength!==file.size)throw invalid();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(JSON.parse(text).version!==BACKUP_VERSION_V2)throw invalid();
  const payload=await decryptDataWithPassword(text,password);
  const inspected=await inspectAssessmentBackupPayload(payload,snapshot,[]);
  if(inspected.sourceVersion!==6||typeof payload.exportedAt!=='string'||
    !Number.isFinite(Date.parse(payload.exportedAt)))throw invalid();
  // Before the first fence, recovery must use v6, readable by exact predecessors.
  // Only the established local receipt/checkpoint projection is allowed.
  const clean=withoutLocalBackupVerification(snapshot.meta);
  if(!Number.isSafeInteger(clean.changes)||clean.changes<0)throw invalid();
  const checkpoint={changes:0,lastBackup:payload.exportedAt};
  const supplied=payload.snapshot.meta;
  if(!same(supplied,clean)&&!same(supplied,checkpoint))throw invalid();
  const projected={...snapshot,meta:supplied};
  const expected=createBackupPayload(projected,payload.exportedAt);
  // Refuse any silent normalization or missing dataset. Never bless a copy
  // from a different archive merely because its envelope authenticates.
  if(!same(expected.snapshot,projected)||!same(payload,expected)||
     !same(inspected.snapshot,expected.snapshot))throw invalid();
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Object.freeze({bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''),payloadVersion:6});
}

/** Memory-only, one-use authorization. The Blob must come from actual local
 * file readback, not from a just-generated ciphertext in production. */
export function createAuthorizedVaultMigration(factory:IDBFactory=globalThis.indexedDB){
  let current:AbortController|null=null;
  let pending:{grant:Grant;physical:Physical;controller:AbortController}|null=null;
  function invalidate(){current?.abort();current=null;pending=null;}
  return {
    invalidate,
    async prepare(vaultPassword:string,recoveryFile:Blob,backupPassword:string):Promise<Grant>{
      invalidate();
      const controller=new AbortController();current=controller;
      try{
        const physical=await capture(factory);
        const snapshot=await authenticate(physical,vaultPassword);
        const grant=await verifyCopy(snapshot,recoveryFile,backupPassword);
        if(controller.signal.aborted||current!==controller)throw invalid();
        // Retain only encrypted physical records and non-identifying evidence.
        pending={grant,physical,controller};
        return grant;
      }catch{
        if(current===controller)invalidate();
        throw invalid();
      }
    },
    async migrate(grant:Grant,confirmed:boolean):Promise<void>{
      if(!pending||pending.grant!==grant||confirmed!==true){invalidate();throw invalid();}
      const {physical,controller}=pending;
      pending=null; // Consume before even attempting the upgrade.
      const signal=controller.signal;
      const store=new VersionFencedVaultStore(factory,(m,r,tx)=>{
        if(signal.aborted||!same(checked(m,r),physical))throw invalid();
        const abort=()=>{try{tx.abort();}catch{/* Already committed or aborted. */}};
        signal.addEventListener('abort',abort,{once:true});
        const cleanup=()=>signal.removeEventListener('abort',abort);
        tx.addEventListener('complete',cleanup,{once:true});
        tx.addEventListener('abort',cleanup,{once:true});
        if(signal.aborted)abort();
      });
      try{
        if(signal.aborted)throw invalid();
        await store.getMetadata();
      }finally{
        await store.close();
        if(current===controller)invalidate();
      }
    }
  };
}
