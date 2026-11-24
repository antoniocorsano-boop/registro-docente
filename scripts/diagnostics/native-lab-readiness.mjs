// QA-STABILITY-01/Q3: synthetic lab preflight and public UI readiness.
import { LabFailure, observeUntil, classifyFailure } from './native-lab-runtime.mjs';
export function isInteractiveElement(e,doc=document,style=getComputedStyle){
  if(!e||doc.visibilityState!=='visible'||e.closest('[inert],[aria-hidden="true"],[hidden]')||
    e.matches(':disabled,[aria-disabled="true"]')||e.getClientRects().length===0)return false;
  for(let n=e;n;n=n.parentElement){
    const s=style(n);
    if(s.visibility!=='visible'||s.display==='none'||s.opacity==='0'||s.pointerEvents==='none')return false;
  }
  return true;
}
export function publicSurfaceFrame(label,doc=document,style=getComputedStyle,visible=isInteractiveElement){
  const ok=e=>visible(e,doc,style);
  const unique=(selector)=>Array.from(doc.querySelectorAll(selector)).filter(ok).length===1;
  const text=(selector,value)=>Array.from(doc.querySelectorAll(selector)).filter(e=>ok(e)&&e.textContent?.trim()===value).length===1;
  const headings='h1,h2,h3,h4,[role=heading]';
  const heading=value=>text(headings,value);
  const button=value=>text('button',value);
  const brand=unique('[data-testid="header01-brand-navigation"]');
  const setup=heading('Configura archivio protetto');
  const lock=heading('Sblocca Registro');
  return {
    documentVisible:doc.visibilityState==='visible',
    setup,lock,gateError:heading('Sicurezza non disponibile')||heading('Proteggi i dati esistenti'),
    gatePending:heading('Protezione dati in corso')||heading('Protezione del Registro'),
    protectedField:!!doc.querySelector('#vault-password'),
    lockControls:unique('#vault-password')&&button('Sblocca Registro'),
    professionalChoice:unique('input[name="archive-mode"][value="professional"]'),
    brand,
    home:unique('#today-heading')&&heading('Le mie classi')&&button('Nuova Classe'),
    privacy:heading('Ripristina backup cifrato')&&button('Esporta copia completa V7')&&button('Scegli file e ripristina')&&
      unique('input[placeholder="Inserisci password sicura (min. 6 caratteri)"]')&&unique('input[placeholder="Ripeti la password"]')&&
      unique('input[placeholder="Inserisci la password impostata alla cifratura"]')&&unique('#restore-v7-recovery-password'),
    classVisible:typeof label==='string'&&Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,span,button,[role=heading]')).some(e=>ok(e)&&e.textContent?.trim()===label),
    drawer:unique('#registro-navigation-drawer')
  };
}
export function classifySurface(frame,destination){
  if(!frame||frame.foreground!==true||frame.documentVisible!==true)return 'background';
  if(frame.gateError)return 'gate-error';
  if(frame.setup)return destination==='setup'&&frame.professionalChoice?'ready':'protected';
  if(frame.lock)return frame.lockControls?(destination==='lock'?'ready':'locked'):'protected';
  if(frame.gatePending||frame.protectedField)return 'protected';
  if(destination==='setup'||destination==='lock'||!frame.brand)return 'not-ready';
  if(destination==='session')return 'ready';
  if(destination==='home'&&frame.home)return 'ready';
  if(destination==='privacy'&&frame.privacy)return 'ready';
  if(destination==='class'&&frame.home&&frame.classVisible)return 'ready';
  if(destination==='class-detail'&&frame.classVisible)return 'ready';
  return 'not-ready';
}
export async function waitPublicSurface({sample,destination,authenticate,timeoutMs=60000,now,sleep,onState=()=>{}}){
  if(!['setup','lock','session','home','privacy','class','class-detail'].includes(destination))
    throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  let consecutive=0,authenticated=false;
  return observeUntil(async()=>{
    const state=classifySurface(await sample(),destination);
    onState(state);
    if(state==='gate-error')throw new LabFailure('PUBLIC_GATE_ERROR');
    if(state==='locked'&&authenticate){
      if(authenticated)throw new LabFailure('PUBLIC_RELOCK_AFTER_AUTH');
      authenticated=true;consecutive=0;
      await authenticate(); // exactly once; no retry if a mutation rejects
      return false;
    }
    consecutive=state==='ready'?consecutive+1:0;
    return consecutive>=2;
  },{timeoutMs,intervalMs:450,now,sleep,retryReadErrors:false});
}
export function bootReady({transport,boot,animation,packageManager}){
  return transport==='device'&&boot==='1'&&animation==='stopped'&&/^package:\/[^\r\n]+\.apk(?:\r?\n|$)/.test(packageManager||'');
}
export function versionFacts(raw){
  const version=(value)=>/^\d+(?:\.\d+){1,4}$/.test(String(value??''))?String(value):null;
  const safe=(value,re)=>re.test(String(value??''))?String(value):null;
  const webview=String(raw.webview??'').match(/Current WebView package \(name, version\):\s*\(([a-zA-Z0-9_.]+),\s*(\d+(?:\.\d+){1,4})\)/);
  return {
    adb:version(String(raw.adb??'').match(/Android Debug Bridge version (\d+(?:\.\d+){1,4})/)?.[1]),
    platformTools:version(String(raw.adb??'').match(/(?:^|\n)Version (\d+(?:\.\d+){1,4})/)?.[1]),
    platformToolsBuild:String(raw.adb??'').match(/(?:^|\n)Version \d+(?:\.\d+){1,4}-(\d{1,20})(?:\r?\n|$)/)?.[1]??null,
    emulator:version(String(raw.emulator??'').match(/Android emulator version (\d+(?:\.\d+){1,4})/i)?.[1]),
    emulatorBuild:String(raw.emulator??'').match(/\bbuild_id (\d{1,20})\b/)?.[1]??null,
    webviewPackage:webview?.[1]??null,webviewVersion:webview?.[2]??null,
    androidBuild:safe(raw.androidBuild,/^[A-Za-z0-9_./:+-]{1,200}$/),
    runnerImage:safe(raw.runnerImage,/^[A-Za-z0-9_.-]{1,50}$/),
    runnerVersion:safe(raw.runnerVersion,/^[A-Za-z0-9_.-]{1,50}$/),
    node:version(String(raw.node??'').replace(/^v/,'')),
    chromium:version(raw.chromium)
  };
}
export function completeFingerprint(f){
  return ['adb','platformTools','emulator','webviewPackage','webviewVersion','androidBuild','runnerImage','runnerVersion','node','chromium'].every(k=>typeof f?.[k]==='string'&&f[k].length>0);
}
export function safeSurfaceTrace(items){
  const destinations=new Set(['setup','lock','session','home','privacy','class','class-detail']);
  const states=new Set(['background','gate-error','protected','locked','not-ready','ready']);
  return items.slice(-80).filter(x=>destinations.has(x.destination)&&states.has(x.state)).map(x=>({destination:x.destination,state:x.state}));
}
