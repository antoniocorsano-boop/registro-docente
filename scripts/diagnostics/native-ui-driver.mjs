// STAB-03: deterministic native UI driver for synthetic CI emulators only.
// The historical APK is never debugged, patched, or authenticated through CDP.
export class NativeUiFault extends Error {
  constructor(code,phase,detail={}){super(phase+': '+code);this.name='NativeUiFault';this.code=code;this.phase=phase;this.detail=detail;}
}
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_m,k)=>{
  const known={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  if(k in known)return known[k];
  const n=k.startsWith('#x')?parseInt(k.slice(2),16):Number(k.slice(1));
  return Number.isInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';
});
export function parseNativeNodes(xml){
  if(typeof xml!=='string'||!/<hierarchy\b/.test(xml))throw new NativeUiFault('UI_DUMP_INVALID','observation');
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(m=>{
    const attributes=Object.fromEntries([...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])]));
    const get=k=>attributes[k]||'';
    return {text:get('text'),desc:get('content-desc'),pkg:get('package'),id:get('resource-id'),
      clickable:get('clickable')==='true',enabled:get('enabled')==='true',focused:get('focused')==='true',
      checked:get('checked')==='true',clazz:get('class'),password:get('password')==='true',
      bounds:get('bounds').match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/)?.slice(1).map(Number)};
  });
}
export function resumedActivity(dump,pkg){
  return String(dump).split('\n').some(line=>/\b(?:topResumedActivity|mResumedActivity)\b/.test(line)&&line.includes(pkg+'/'));
}
const labels=n=>[n.text,n.desc];
const heading=(n,pkg,text)=>n.pkg===pkg&&n.clazz==='android.widget.TextView'&&labels(n).includes(text);
const exact=(n,pkg,text)=>n.pkg===pkg&&labels(n).includes(text);
export function hasArea(n){
  return Array.isArray(n.bounds)&&n.bounds.length===4&&n.bounds.every(Number.isFinite)&&n.bounds[2]>n.bounds[0]&&n.bounds[3]>n.bounds[1];
}
export const vaultField=(n,pkg)=>n.pkg===pkg&&n.id==='vault-password'&&n.clazz==='android.widget.EditText'&&n.password===true&&n.enabled===true&&hasArea(n);
export const demoRadio=(n,pkg)=>n.pkg===pkg&&n.clazz==='android.widget.RadioButton'&&n.enabled===true&&n.clickable===true&&hasArea(n)&&labels(n).some(v=>v==='Ambiente dimostrativo'||v==='Ambiente dimostrativo Esplora con dati di esempio, non reali.');
export const actionButton=(n,pkg,label)=>exact(n,pkg,label)&&n.enabled===true&&n.clickable===true&&hasArea(n)&&n.clazz==='android.widget.Button';
export function passwordEvidence(n,credential){
  return n.text===credential?'exact':/^[•●*]+$/u.test(n.text)&&[...n.text].length===credential.length?'masked-length':null;
}
export const passwordEmpty=n=>!n.text||n.text==='Password locale';
export function surface(view,pkg){
  const headings=['Configura archivio protetto','Sblocca Registro','Proteggi i dati esistenti','Sicurezza non disponibile','Protezione dati in corso','Protezione del Registro'];
  const found=headings.filter(h=>view.some(n=>heading(n,pkg,h)));
  if(found.length!==1)return null;
  return found[0];
}
function unique(view,predicate){const found=view.filter(predicate);return found.length===1?found[0]:null;}
const fingerprint=n=>JSON.stringify([n.pkg,n.id,n.clazz,n.bounds,n.focused,n.checked]);
const safeState=(view,pkg)=>({surface:surface(view,pkg),nodes:view.length,owned:view.filter(n=>n.pkg===pkg).length,
  demoCount:view.filter(n=>demoRadio(n,pkg)).length,passwordCount:view.filter(n=>vaultField(n,pkg)).length,
  focusedPassword:view.some(n=>vaultField(n,pkg)&&n.focused)});
// Samples bracket the accessibility tree with native activity checks.
// Two matching target samples protect against stale/reflowing coordinates.
// Only safe, non-persistent actions can be retried; submit is one-shot.
export function createNativeUiDriver({pkg,readNodes,isForeground,tap,input,clear,hideKeyboard,pause,report=()=>{},now=Date.now}){
  const wait=pause||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
  async function stable(phase,select,{ms=12000,consecutive=2}={}){
    const end=now()+ms;let previous=null,count=0,last={reason:'not-observed'};
    while(now()<end){
      try{
        if(!isForeground()){previous=null;count=0;last={reason:'foreground-before'};}
        else{
          const view=readNodes();
          if(!isForeground()){previous=null;count=0;last={reason:'foreground-after'};}
          else{
            const selected=select(view);
            last={reason:selected?'target-observed':'target-missing-or-ambiguous',...safeState(view,pkg)};
            if(selected){
              const key=selected.key;
              count=key===previous?count+1:1;previous=key;
              if(count>=consecutive)return selected;
            }else{previous=null;count=0;}
          }
        }
      }catch(e){previous=null;count=0;last={reason:'observation-error',error:e?.name||'Error'};}
      await wait(200);
    }
    const error=new NativeUiFault('UI_ACTION_UNAVAILABLE',phase,last);
    report({phase,status:'FAIL',code:error.code,observation:last});throw error;
  }
  const setup='Configura archivio protetto';
  const demoReady=view=>surface(view,pkg)===setup&&unique(view,n=>vaultField(n,pkg))&&unique(view,n=>actionButton(n,pkg,'Avvia la prova'));
  async function selectDemo(){
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const selected=await stable('demo-selection',view=>{
          if(surface(view,pkg)!==setup)return null;
          if(demoReady(view))return {key:'ready',ready:true};
          const target=unique(view,n=>demoRadio(n,pkg));
          return target?{key:fingerprint(target),target}:null;
        });
        if(!selected.ready){
          tap(selected.target);
          await stable('demo-form-postcondition',view=>demoReady(view)?{key:'ready'}:null,{ms:8000});
        }
        report({phase:'demo-selection',status:'PASS',attempt});return;
      }catch(e){report({phase:'demo-selection',status:'RETRY',attempt,code:e?.code||'UI_ACTION_FAILED'});}
    }
    throw new NativeUiFault('UI_ACTION_UNAVAILABLE','demo-selection');
  }
  async function enterPassword(credential,expected){
    const select=(view,predicate)=>{
      const current=surface(view,pkg);
      if(!current||!['Configura archivio protetto','Sblocca Registro','Proteggi i dati esistenti'].includes(current)||(expected&&expected!==current))return null;
      const target=unique(view,n=>vaultField(n,pkg)&&predicate(n));
      return target?{key:current+fingerprint(target),target}:null;
    };
    for(let attempt=1;attempt<=3;attempt++){
      try{
        let found=await stable('password-target',view=>select(view,()=>true));
        if(!found.target.focused)tap(found.target);
        found=await stable('password-focus',view=>select(view,n=>n.focused),{ms:8000});
        if(!passwordEmpty(found.target)){
          clear();
          await stable('password-empty-focused',view=>select(view,n=>n.focused&&passwordEmpty(n)),{ms:8000});
        }
        await stable('password-before-input',view=>select(view,n=>n.focused&&passwordEmpty(n)),{ms:8000});
        input(credential);
        await stable('password-after-input',view=>select(view,n=>n.focused&&!!passwordEvidence(n,credential)),{ms:8000});
        hideKeyboard();
        const final=await stable('password-after-keyboard',view=>select(view,n=>!!passwordEvidence(n,credential)),{ms:8000});
        report({phase:'password-entry',status:'PASS',attempt,evidence:passwordEvidence(final.target,credential)});
        return passwordEvidence(final.target,credential);
      }catch(e){report({phase:'password-entry',status:'RETRY',attempt,code:e?.code||'UI_ACTION_FAILED'});}
    }
    throw new NativeUiFault('UI_ACTION_UNAVAILABLE','password-entry');
  }
  const submitted=new Set();
  async function submitGate(action,credential,expected){
    const selected=await stable('gate-submit-admission',view=>{
      if(surface(view,pkg)!==expected)return null;
      const field=unique(view,n=>vaultField(n,pkg)&&!!passwordEvidence(n,credential));
      const target=unique(view,n=>actionButton(n,pkg,action));
      return field&&target?{key:fingerprint(target)+fingerprint(field),target}:null;
    });
    // Each invocation is one explicit gate operation; no retry around the
    // action or its outcome. The caller must attest authentication outcome.
    const token=Symbol(action);submitted.add(token);
    try{tap(selected.target);report({phase:'gate-submit',status:'SUBMITTED',action});}
    finally{submitted.delete(token);}
  }
  return {selectDemo,enterPassword,submitGate,stable};
}
