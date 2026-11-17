import React,{useEffect,useRef,useState} from 'react';
import {isAndroidBackupRuntime} from '../security/androidBackupExport';
import {ANDROID_SESSION_EVENT} from '../security/androidSessionLifecycle';
import type {MigrationSessionResult} from '../security/migrationSessionBoundary';

export interface ArchiveMigrationControls {
  select(file?:File):Promise<boolean>;
  start(vaultPassword:string,backupPassword:string):Promise<MigrationSessionResult>;
  discard():void;
  mode?:'migrate'|'restore';
  erase?(vaultPassword:string):Promise<MigrationSessionResult>;
}

/** Candidate-only surface. Passwords are requested AFTER the local picker. */
export function ArchiveMigrationPanel({controls,otherBusy}:{controls:ArchiveMigrationControls;otherBusy:boolean}){
  const [selected,setSelected]=useState(false),[busy,setBusy]=useState(false);
  const [vaultPassword,setVaultPassword]=useState(''),[backupPassword,setBackupPassword]=useState('');
  const [message,setMessage]=useState('');
  const [eraseOpen,setEraseOpen]=useState(false),[erasePassword,setErasePassword]=useState(''),[eraseWord,setEraseWord]=useState('');
  const erasing=useRef(false);
  const restore=controls.mode==='restore';
  const clearErase=()=>{erasing.current=false;setEraseOpen(false);setErasePassword('');setEraseWord('');};
  const mounted=useRef(false),pending=useRef(false),selection=useRef(false);
  const clear=()=>{selection.current=false;setSelected(false);setVaultPassword('');setBackupPassword('');};
  useEffect(()=>{
    mounted.current=true;
    const invalidate=()=>{
      // An ordinary native chooser may suspend the app before it returns.
      // Once a file is delivered, any later generation invalidates the ticket.
      if(selection.current){controls.discard();clear();setMessage('Sessione cambiata. Seleziona nuovamente la copia.');}
      if(erasing.current){clearErase();setMessage('Sessione cambiata. Ripeti la richiesta.');}
    };
    const visibility=()=>{if(document.hidden)invalidate();};
    document.addEventListener(ANDROID_SESSION_EVENT,invalidate);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      mounted.current=false;controls.discard();
      document.removeEventListener(ANDROID_SESSION_EVENT,invalidate);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[controls.discard]);
  const choose=async(file?:File)=>{
    if(pending.current||otherBusy)return;
    pending.current=true;setBusy(true);controls.discard();clear();clearErase();setMessage('');
    try{
      const ok=await controls.select(file);
      if(!mounted.current)return;
      selection.current=ok;setSelected(ok);
      if(!ok)setMessage('Copia non disponibile o selezione annullata.');
    }catch{if(mounted.current)setMessage('Copia non verificabile.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(pending.current||otherBusy||!selection.current||!vaultPassword||!backupPassword)return;
    pending.current=true;setBusy(true);
    const local=vaultPassword,copy=backupPassword;
    clear();setMessage('');
    try{
      const result=await controls.start(local,copy);
      if(mounted.current&&result==='not-started')setMessage('Sessione non attuale. Seleziona nuovamente la copia.');
    }catch{if(mounted.current)setMessage('Operazione non avviata.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  };
  const submitErase=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(pending.current||otherBusy||!erasing.current||!erasePassword||eraseWord!=='CANCELLA'||!controls.erase)return;
    pending.current=true;setBusy(true);const password=erasePassword;clearErase();clear();controls.discard();setMessage('');
    try{const result=await controls.erase(password);if(mounted.current&&result==='not-started')setMessage('Operazione non avviata. Verifica la sessione.');}
    catch{if(mounted.current)setMessage('Operazione non avviata.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  };
  return <section aria-label={restore?'Ripristino protetto archivio':'Aggiornamento protetto archivio'} className="mt-4 rounded-lg border border-slate-600 p-4 space-y-3">
    <h3 className="font-semibold text-slate-100">{restore?'Ripristino protetto dell’archivio':'Aggiornamento protetto dell’archivio'}</h3>
    <p className="text-sm text-slate-300">{restore?'Scegli una copia cifrata completa v6. Il ripristino sostituirà i dati attuali; conserva prima una copia aggiornata. Al termine dovrai autenticarti nuovamente.':'Scegli una copia cifrata già salvata. Il Registro verificherà la corrispondenza dei dati prima di chiedere conferma. Al termine dovrai autenticarti nuovamente.'}</p>
    {isAndroidBackupRuntime()?<button type="button" disabled={busy||otherBusy} onClick={()=>void choose()} className="min-h-[44px] w-full rounded border border-slate-500 text-slate-100">Scegli copia cifrata</button>:
      <label className="block text-sm text-slate-100">{restore?'Copia cifrata per ripristino':'Copia cifrata per aggiornamento'}
        <input type="file" accept=".enc.json,application/json" disabled={busy||otherBusy} className="block w-full min-h-[44px]" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void choose(file);}}/>
      </label>}
    {selected&&<form onSubmit={submit} className="space-y-3">
      <p role="status" className="text-sm text-slate-300">{restore?'Copia selezionata. L’integrità sarà verificata prima del ripristino.':'Copia selezionata. L’integrità sarà verificata prima dell’aggiornamento.'}</p>
      <label className="block text-sm text-slate-100">Password locale<input type="password" autoComplete="current-password" required value={vaultPassword} onChange={e=>setVaultPassword(e.target.value)} className="block w-full min-h-[44px] neon-input"/></label>
      <label className="block text-sm text-slate-100">Password della copia<input type="password" autoComplete="off" required value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} className="block w-full min-h-[44px] neon-input"/></label>
      <button type="submit" disabled={busy||otherBusy} className="min-h-[44px] w-full rounded bg-slate-800 text-slate-100">{restore?'Verifica e ripristina archivio':'Verifica e aggiorna archivio'}</button>
      <button type="button" onClick={()=>{controls.discard();clear();}} className="min-h-[44px] text-slate-300">Annulla</button>
    </form>}
    {restore&&controls.erase&&<div className="border-t border-slate-600 pt-4 space-y-3">
      <h4 className="font-semibold text-slate-100">Cancellazione dell’archivio locale</h4>
      <p className="text-sm text-slate-300">Elimina i dati e la chiave locale. Le copie di sicurezza già salvate all’esterno non vengono cancellate. Conserva prima i documenti necessari.</p>
      {!eraseOpen?<button type="button" disabled={busy||otherBusy} onClick={()=>{controls.discard();clear();erasing.current=true;setEraseOpen(true);}} className="min-h-[44px] w-full rounded border border-rose-700 text-rose-300">Prepara cancellazione</button>:
      <form onSubmit={submitErase} className="space-y-3">
        <label className="block text-sm text-slate-100">Password locale per cancellazione<input required type="password" autoComplete="current-password" value={erasePassword} onChange={e=>setErasePassword(e.target.value)} className="block w-full min-h-[44px] neon-input"/></label>
        <label className="block text-sm text-slate-100">Scrivi CANCELLA per proseguire<input required autoComplete="off" value={eraseWord} onChange={e=>setEraseWord(e.target.value)} className="block w-full min-h-[44px] neon-input"/></label>
        <button type="submit" disabled={busy||otherBusy||eraseWord!=='CANCELLA'} className="min-h-[44px] w-full rounded border border-rose-700 text-rose-300">Verifica e cancella archivio locale</button>
        <button type="button" onClick={clearErase} className="min-h-[44px] text-slate-300">Annulla cancellazione</button>
      </form>}
    </div>}
    {message&&<p role="status" className="text-sm text-slate-300">{message}</p>}
  </section>;
}
