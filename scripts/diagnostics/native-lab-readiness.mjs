// QA-STABILITY-01/Q3: synthetic lab preflight and public UI readiness.
import { LabFailure, observeUntil, classifyFailure, normalizeAdbFailure } from './native-lab-runtime.mjs';
export function isInteractiveElement(e,doc=document,style=getComputedStyle){
  if(!e||doc.visibilityState!=='visible'||e.closest('[inert],[aria-hidden="true"],[hidden]')||
    e.matches(':disabled,[aria-disabled="true"]')||e.getClientRects().length===0)return false;
  for(let n=e;n;n=n.parentElement){
    const s=style(n);
    if(s.visibility!=='visible'||s.display==='none'||s.opacity==='0'||s.pointerEvents==='none')return false;
  }
  return true;
}
// One public-dialog predicate for both the read-only sample and the single
// confirmation action. The returned frame contains only synthetic-safe counts.
export function publicHomeConfirmation(doc=document,style=getComputedStyle,interactive=isInteractiveElement,submit=false){
  const root=doc.querySelector('[data-testid="header01-home-confirm"]');
  const dialog=root?.querySelector('[role="alertdialog"][aria-modal="true"]');
  const buttons=Array.from(root?.querySelectorAll('button')||[]);
  const named=buttons.filter(e=>e.textContent?.trim()==='Torna a Oggi');
  const visible=named.filter(e=>interactive(e,doc,style));
  const locked=Boolean(doc.querySelector('#vault-password'));
  const frame={
    documentVisible:doc.visibilityState==='visible',locked,
    dialogPresent:Boolean(root),accessibleAlertdialog:Boolean(dialog),
    dialogInteractive:interactive(dialog,doc,style),
    buttonCount:buttons.length,exactLabelCount:named.length,visibleCount:visible.length,
    enabledCount:named.filter(e=>!e.disabled).length,
    inertCount:named.filter(e=>Boolean(e.closest('[inert]'))).length,
    planningExitDialogOpen:Boolean(doc.querySelector('#planning-exit-title')),
    inertOwnerIsDrawer:named.some(e=>e.closest('[inert]')?.id==='registro-navigation-drawer'),
    inertOwnerIsRoot:named.some(e=>Boolean(e.closest('[inert]'))&&e.closest('[inert]')===doc.querySelector('#root')),
    inertOwnerContainsNavbar:named.some(e=>Boolean(e.closest('[inert]')?.contains(doc.querySelector('[data-testid="header01-brand-navigation"]')))),
    buttonHasLayoutRect:named.some(e=>e.getClientRects().length>0),
    buttonStyleVisible:named.some(e=>style(e).visibility==='visible')
  };
  frame.ready=frame.documentVisible&&!locked&&frame.dialogInteractive&&named.length===1&&visible.length===1&&dialog.contains(visible[0]);
  if(submit){
    if(!dialog)throw Error('HOME_CONFIRM_DIALOG_MISSING');
    if(!frame.ready)throw Error('HOME_CONFIRM_NOT_UNIQUE');
    visible[0].click();
  }
  return frame;
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
    documentFocused:typeof doc.hasFocus==='function'?doc.hasFocus():null,
    suspensionDraining:text('[role=status]','Protezione della sessione…')||
      text('[role=status]','Sessione protetta. Attesa della conclusione dell’operazione locale.'),
    suspensionDelayed:text('[role=status]','Sessione protetta. Attesa della conclusione dell’operazione locale.'),
    closingProtected:text('[role=status]','Chiusura protetta del Registro…')||
      text('[role=status]','Chiusura in attesa di un’operazione locale. I dati sono nascosti; non spegnere il dispositivo durante il salvataggio.'),
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
// SAF lifecycle evidence: a returned Activity alone is not an unlocked
// Vault, and an apparently interactive App cannot substitute for a fresh lock.
export function classifySafReturnFrame(activity,frame){
  if(activity==='documentsui')return 'picker-active';
  if(activity==='other')return 'other-activity';
  if(activity!=='application')return 'activity-unknown';
  if(!frame||frame.documentVisible!==true)return 'webview-hidden';
  if(frame.gateError)return 'gate-error';
  if(frame.closingProtected)return 'closing-protected';
  if(frame.suspensionDelayed)return 'drain-delayed';
  if(frame.suspensionDraining)return 'draining';
  if(frame.lock&&frame.lockControls&&!frame.gatePending&&!frame.setup)return 'lock-ready';
  if(frame.lock||frame.protectedField||frame.gatePending||frame.setup)return 'protected-not-ready';
  if(frame.brand)return 'interactive-without-observed-lock';
  return 'surface-not-ready';
}
export async function waitSafReturnLock({sample,onState=()=>{},timeoutMs=35000,now,sleep}){
  return observeUntil(async()=>{
    const {activity,frame}=await sample();
    const state=classifySafReturnFrame(activity,frame);
    onState(state);
    if(state==='gate-error')throw new LabFailure('PUBLIC_GATE_ERROR');
    return state==='lock-ready';
  },{timeoutMs,intervalMs:450,now,sleep,retryReadErrors:false});
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
// Q3-R01: do not query a later subsystem before its predecessors are ready.
// A fixed, affirmative package-service-unavailable message is the only extra
// transient condition. Arbitrary shell errors never become readiness samples.
function packageServicePending(value){
  return /^(?:(?:cmd|pm): (?:Can't|Cannot) find service: package|Error: Could not access the Package Manager\. Is the system running\?)$/i.test(String(value??'').trim());
}
// Some emulator images start with -no-boot-anim: the init service may not
// exist. Only a valid process list proving no bootanimation process permits
// that alternative. An explicitly running or unknown service never qualifies.
export function bootAnimationState(service,processList){
  if(service==='stopped')return 'stopped';
  if(service!=='')return service==='running'?'running':'not-ready';
  const rows=String(processList??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(rows.shift()!=='NAME'||!rows.some(x=>x==='init'||x==='/init')||
    rows.some(x=>/\s/.test(x)))return 'not-ready';
  return rows.some(x=>/(?:^|\/)bootanimation(?:$|:)/.test(x))?'running':'absent-verified';
}
export function sampleBootReadiness(adb,onState=()=>{}){
  if(adb('get-state')!=='device'){onState('transport-not-ready');return false;}
  if(adb('shell','getprop','sys.boot_completed')!=='1'){onState('boot-not-ready');return false;}
  const service=adb('shell','getprop','init.svc.bootanim');
  const animation=bootAnimationState(service,service===''?adb('shell','ps','-A','-o','NAME'):undefined);
  onState('animation-'+animation);
  if(!['stopped','absent-verified'].includes(animation))return false;
  let packageManager;
  try{packageManager=adb('shell','pm','path','android');}
  catch(error){
    const normalized=normalizeAdbFailure(error);
    if(normalized instanceof LabFailure)throw normalized;
    const stderr=String(error?.stderr??'').trim(),stdout=String(error?.stdout??'').trim();
    if(Number.isInteger(error?.status)&&error.status!==0&&
       ((packageServicePending(stderr)&&!stdout)||(packageServicePending(stdout)&&!stderr)||
        (packageServicePending(stdout)&&stdout===stderr)))
      throw new LabFailure('PREFLIGHT_PACKAGE_SERVICE_PENDING');
    throw error;
  }
  if(packageServicePending(packageManager))throw new LabFailure('PREFLIGHT_PACKAGE_SERVICE_PENDING');
  const ready=bootReady({transport:'device',boot:'1',animation:'stopped',packageManager});
  if(!ready)onState('package-not-ready');else onState('ready-'+animation);
  return ready;
}
export async function waitBootReadiness(adb,{timeoutMs=90000,intervalMs=1000,now,sleep,onState}={}){
  try{
    return await observeUntil(()=>sampleBootReadiness(adb,onState),{
      timeoutMs,intervalMs,now,sleep,retryReadErrors:true,
      retryCodes:['ADB_TRANSPORT_OFFLINE','ADB_TRANSPORT_TIMEOUT','PREFLIGHT_PACKAGE_SERVICE_PENDING']
    });
  }catch(error){
    if(classifyFailure(error).code==='OBSERVATION_DEADLINE'){
      const failure=new LabFailure('PREFLIGHT_BOOT_UNREADY');
      failure.observation=error.observation;throw failure;
    }
    throw error;
  }
}
// Q3-R02: the same one-use adapter drives the public password field and submit
// in production-like synthetic tests. It cannot repeat an uncertain mutation;
// a fresh scope is required for a separately observed lifecycle boundary.
export function createPublicAuthentication({waitForLock,fill,submit,waitForSession,onStep=()=>{}}){
  let attempted=false;
  return async()=>{
    if(attempted)throw new LabFailure('PUBLIC_RELOCK_AFTER_AUTH');
    attempted=true;
    await waitForLock();onStep('lock-ready');
    await fill();onStep('password-entered');
    await submit();onStep('unlock-requested');
    await waitForSession();onStep('unlocked');
  };
}
// The SDK package revision is an independent, inspectable identity of the
// exact installed emulator binary; never infer it from the API level.
export function emulatorIdentity({probe,packageMetadata,binarySha256}){
  const sha=/^[a-f0-9]{64}$/.test(String(binarySha256??''))?binarySha256:null;
  const revision=String(packageMetadata??'').match(/^Pkg\.Revision\s*=\s*(\d+(?:\.\d+){1,4})\s*$/m)?.[1]??null;
  const output=String(probe?.stdout??'')+'\n'+String(probe?.stderr??'');
  const version=output.match(/Android emulator version (\d+(?:\.\d+){1,4})/i)?.[1]??null;
  const build=output.match(/\bbuild_id (\d{1,20})\b/)?.[1]??null;
  const reason=probe?.error?.code==='ETIMEDOUT'?'timeout':probe?.error?'spawn-error':
    probe?.status!==0?'nonzero-exit':!version?'missing-version':'ok';
  if(!sha||!revision)return {version:null,source:null,revision,binarySha256:sha,build:null,probeStatus:reason};
  // Only accept output from a successful command consistent with the SDK revision.
  if(reason==='ok'&&version!==revision&&!version.startsWith(revision+'.'))
    return {version:null,source:null,revision,binarySha256:sha,build:null,probeStatus:'revision-mismatch'};
  return {version:reason==='ok'?version:revision,source:reason==='ok'?'executable':'sdk-package',
    revision,binarySha256:sha,build:reason==='ok'?build:null,probeStatus:reason};
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
