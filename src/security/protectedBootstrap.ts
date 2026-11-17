/**
 * STAB-01: read-only, existing-only bootstrap. Never grants authentication,
 * creates a database, upgrades it, rewrites data or repairs failed state.
 */
import {validMeta,validRecords} from './versionFencedVaultStore';
import type {ErasedDb2} from './db2PhysicalLifecycle';
const NAME='registro-docente-secure-vault';
export type BootPhase='capability'|'enumeration'|'open'|'inventory'|'classification'|'deadline';
export type BootCode='unavailable'|'blocked'|'timeout'|'aborted-read'|'version-changed'|'connection-closed'|'missing-established'|'confirm-absence'|'unsupported'|'invalid-inventory'|'staging'|'unknown'|'cancelled';
export class BootFault extends Error{
  constructor(readonly phase:BootPhase,readonly code:BootCode){super(code);this.name='BootFault';}
}
export type BootObservation=
  | {kind:'absent'}
  | {kind:'empty';version:1}
  | {kind:'active';version:1|2}
  | {kind:'erased';version:2;marker:ErasedDb2};
export type BootTrace=Readonly<{attempt:number;phase:BootPhase;code:BootCode}>;
export type BootResult={kind:'ok';observation:BootObservation;trace:BootTrace[]}
  | {kind:'error';fault:BootFault;trace:BootTrace[]};
const fault=(phase:BootPhase,code:BootCode)=>new BootFault(phase,code);
function classifyError(phase:BootPhase,error:unknown):BootFault{
  if(error instanceof BootFault)return error;
  const name=error instanceof Error||error instanceof DOMException?error.name:'';
  if(name==='AbortError')return fault(phase,'aborted-read');
  if(name==='VersionError')return fault(phase,'version-changed');
  if(name==='InvalidStateError')return fault(phase,'connection-closed');
  if(name==='NotSupportedError'||name==='SecurityError')return fault(phase,'unavailable');
  // UnknownError is not evidence of a transient fault. No speculative retry.
  return fault(phase,'unknown');
}
const retryable=(e:BootFault)=>['blocked','timeout','aborted-read','version-changed','connection-closed','missing-established','confirm-absence'].includes(e.code);
const erased=(v:unknown):v is ErasedDb2=>{
  if(!v||typeof v!=='object')return false;
  const x=v as Record<string,unknown>;
  return Object.keys(x).length===2&&x.kind==='ERASED_DB2'&&typeof x.nonce==='string'&&/^[a-f0-9]{32}$/.test(x.nonce);
};
function ensureCurrent(signal:AbortSignal,phase:BootPhase){if(signal.aborted)throw fault(phase,'cancelled');}
function listVersion(factory:IDBFactory,signal:AbortSignal):Promise<1|2|null>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(fault('enumeration','cancelled'));return;}
    if(typeof factory.databases!=='function'){reject(fault('capability','unavailable'));return;}
    let settled=false;
    const stop=()=>finish(undefined,fault('enumeration','cancelled'));
    const finish=(value?:1|2|null,error?:BootFault)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',stop);
      if(error)reject(error);else resolve(value??null);
    };
    signal.addEventListener('abort',stop,{once:true});
    try{
      void factory.databases().then(databases=>{
        const matches=databases.filter(d=>d.name===NAME);
        if(matches.length===0)finish(null);
        else if(matches.length===1&&(matches[0].version===1||matches[0].version===2))finish(matches[0].version);
        else finish(undefined,fault('enumeration','unsupported'));
      },e=>finish(undefined,classifyError('enumeration',e)));
    }catch(e){finish(undefined,classifyError('enumeration',e));}
  });
}
function inspectExisting(factory:IDBFactory,version:1|2,signal:AbortSignal):Promise<BootObservation>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(fault('open','cancelled'));return;}
    let settled=false,db:IDBDatabase|undefined,tx:IDBTransaction|undefined;
    let phase:BootPhase='open';
    const stop=()=>finish(undefined,fault(phase,'cancelled'));
    const finish=(observation?:BootObservation,error?:BootFault)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',stop);
      if(error){try{tx?.abort();}catch{}}
      db?.close();
      if(error)reject(error);else if(observation)resolve(observation);else reject(fault(phase,'unknown'));
    };
    signal.addEventListener('abort',stop,{once:true});
    try{
      const req=factory.open(NAME,version);
      req.onblocked=()=>finish(undefined,fault('open','blocked'));
      // Even a late event after timeout or abandonment must never create/upgrade.
      req.onupgradeneeded=()=>{try{req.transaction?.abort();}catch{}finish(undefined,fault('open','version-changed'));};
      req.onerror=()=>finish(undefined,classifyError('open',req.error));
      req.onsuccess=()=>{
        db=req.result;
        if(settled||signal.aborted){db.close();stop();return;}
        if(db.version!==version){finish(undefined,fault('open','version-changed'));return;}
        db.onversionchange=()=>finish(undefined,fault('open','version-changed'));
        db.onclose=()=>finish(undefined,fault(phase,'connection-closed'));
        phase='inventory';
        try{
          if(db.objectStoreNames.length!==2||!db.objectStoreNames.contains('metadata')||!db.objectStoreNames.contains('records'))throw fault(phase,'invalid-inventory');
          tx=db.transaction(['metadata','records'],'readonly');
          const m=tx.objectStore('metadata'),r=tx.objectStore('records');
          if(m.keyPath!==null||m.autoIncrement||m.indexNames.length||r.keyPath!=='recordKey'||r.autoIncrement||r.indexNames.length)throw fault(phase,'invalid-inventory');
          const mk=m.getAllKeys(),mv=m.get('current'),rk=r.getAllKeys();
          // DB1 can legitimately be sparse (historical RC2); only DB2 requires
          // complete physical ciphertext here. Migration preflight is separate.
          const rv=version===2?r.getAll():null;
          tx.onabort=()=>finish(undefined,classifyError('inventory',tx?.error??new DOMException('','AbortError')));
          tx.onerror=event=>finish(undefined,classifyError('inventory',(event.target as IDBRequest|null)?.error??tx?.error));
          tx.oncomplete=()=>{
            if(settled)return;
            phase='classification';
            try{
              ensureCurrent(signal,phase);
              const keys=mk.result,records=rk.result,metadata=mv.result;
              if(version===1&&keys.length===0&&records.length===0&&metadata===undefined){finish({kind:'empty',version:1});return;}
              if(keys.length!==1||keys[0]!=='current')throw fault(phase,'invalid-inventory');
              if(metadata?.state==='STAGING')throw fault(phase,'staging');
              if(version===2&&erased(metadata)&&records.length===0&&rv?.result.length===0){finish({kind:'erased',version:2,marker:metadata});return;}
              if(!validMeta(metadata))throw fault(phase,'invalid-inventory');
              if(version===2&&(!rv||!validRecords(rv.result)||records.length!==rv.result.length||!records.every((key,i)=>key===rv.result[i].recordKey)))throw fault(phase,'invalid-inventory');
              finish({kind:'active',version});
            }catch(e){finish(undefined,classifyError(phase,e));}
          };
        }catch(e){finish(undefined,classifyError(phase,e));}
      };
    }catch(e){finish(undefined,classifyError(phase,e));}
  });
}
export async function observeArchive(factory:IDBFactory,signal:AbortSignal):Promise<BootObservation>{
  const version=await listVersion(factory,signal);
  ensureCurrent(signal,'enumeration');
  if(version===null)return {kind:'absent'};
  return inspectExisting(factory,version,signal);
}
export interface BootstrapPorts{
  observe(signal:AbortSignal):Promise<BootObservation>;
  established():boolean;
  pause?(ms:number,signal:AbortSignal):Promise<void>;
  attemptMs?:number;
  totalMs?:number;
}
function wait(ms:number,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(fault('deadline','cancelled'));return;}
    const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(fault('deadline','cancelled'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);
    signal.addEventListener('abort',stop,{once:true});
  });
}
/** One active read-only sequence; obsolete attempts cannot publish results.
 * Timeouts abort the adapter and late opens close/abort. A known archive
 * cannot become setup on transient absence; first absence is re-observed. */
export function createProtectedBootstrap(ports:BootstrapPorts){
  let active:{controller:AbortController;promise:Promise<BootResult>}|null=null;
  let generation=0;
  const run=():Promise<BootResult>=>{
    if(active)return active.promise;
    const controller=new AbortController(),signal=controller.signal;
    const current=++generation;
    const total=ports.totalMs??12000,attemptMs=ports.attemptMs??3500;
    const pause=ports.pause??wait;
    const trace:BootTrace[]=[];
    const started=Date.now();
    const execute=async():Promise<BootResult>=>{
      let absentSeen=false,versionRetried=false;
      for(let attempt=1;attempt<=3;attempt++){
        let phaseFault:BootFault;
        const remaining=total-(Date.now()-started);
        if(signal.aborted||generation!==current)return {kind:'error',fault:fault('deadline','cancelled'),trace};
        if(remaining<=0)return {kind:'error',fault:fault('deadline','timeout'),trace};
        const child=new AbortController();
        let rejectCancelled:(()=>void)|undefined;
        const cancel=()=>{rejectCancelled?.();child.abort();};
        signal.addEventListener('abort',cancel,{once:true});
        let timer:ReturnType<typeof setTimeout>|undefined;
        try{
          const observation=await Promise.race([
            new Promise<never>((_,reject)=>{rejectCancelled=()=>reject(fault('deadline','cancelled'));}),
            ports.observe(child.signal),
            new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(fault('deadline','timeout'));child.abort();},Math.min(remaining,attemptMs));})
          ]);
          ensureCurrent(signal,'deadline');
          if(generation!==current)throw fault('deadline','cancelled');
          const established=ports.established();
          if((observation.kind==='absent'||observation.kind==='empty')&&established)throw fault('classification','missing-established');
          if(observation.kind==='absent'&&!absentSeen){
            absentSeen=true;
            throw fault('classification','confirm-absence'); // confirm a second independent absence
          }
          return {kind:'ok',observation,trace};
        }catch(e){phaseFault=classifyError('classification',e);}
        finally{if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',cancel);child.abort();}
        if(phaseFault.code!=='confirm-absence')absentSeen=false;
        trace.push({attempt,phase:phaseFault.phase,code:phaseFault.code});
        if(signal.aborted||generation!==current)return {kind:'error',fault:fault('deadline','cancelled'),trace};
        if(!retryable(phaseFault)||attempt===3||(phaseFault.code==='version-changed'&&versionRetried))return {kind:'error',fault:phaseFault,trace};
        if(phaseFault.code==='version-changed')versionRetried=true;
        const delay=Math.min(attempt===1?250:750,total-(Date.now()-started));
        if(delay<=0)return {kind:'error',fault:fault('deadline','timeout'),trace};
        try{await pause(delay,signal);}catch{return {kind:'error',fault:fault('deadline','cancelled'),trace};}
      }
      return {kind:'error',fault:fault('deadline','timeout'),trace};
    };
    // Defer the first read until the single-flight handle has been installed.
    const promise=Promise.resolve().then(execute).finally(()=>{if(active?.controller===controller)active=null;});
    active={controller,promise};
    return promise;
  };
  return {run,cancel(){generation++;active?.controller.abort();active=null;}};
}
export function bootMessage(e:BootFault):string{
  if(e.code==='staging')return 'Configurazione interrotta. Nessun dato verrà cancellato automaticamente.';
  if(e.code==='missing-established')return 'L’archivio esistente non è verificabile. Nessun nuovo archivio verrà creato.';
  if(retryable(e))return 'L’archivio non è momentaneamente disponibile. Riprova il controllo di sicurezza.';
  if(e.code==='invalid-inventory'||e.code==='unsupported')return 'L’archivio non è compatibile o verificabile. Nessun dato verrà modificato.';
  return 'Controllo di sicurezza non riuscito. Nessun dato verrà aperto senza protezione.';
}
