// Drives Android's actual DocumentsUI only in a disposable, synthetic lab emulator.
// Selection is always performed through ACTION_CREATE_DOCUMENT / ACTION_OPEN_DOCUMENT.
// No direct filesystem shortcut may be used as evidence of SAF selection.
import assert from 'node:assert/strict';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function unescapeXml(x){
 return x.replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function nodes(xml){
 return [...xml.matchAll(/<node\s([^>]*?)\/?\s*>/g)].map(m=>{
  const attrs=Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)]
   .map(x=>[x[1],unescapeXml(x[2])]));
  const b=/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds||'');
  return {...attrs,x:b?Math.floor((+b[1]+ +b[3])/2):0,
   y:b?Math.floor((+b[2]+ +b[4])/2):0};
 }).filter(n=>n.x>0&&n.y>0);
}
export async function driveSafPicker(adb,mode,filename){
 assert.ok(['create','open','cancel'].includes(mode));
 assert.match(filename,/^LAB_V10_Synthetic_/);
 const dump=()=>{
  adb('shell','uiautomator','dump','/sdcard/val01_saf_ui.xml');
  return nodes(adb('shell','cat','/sdcard/val01_saf_ui.xml'));
 };
 const pick=(all,match)=>{
  const hits=all.filter(n=>match(n));
  return hits.find(n=>n['clickable']==='true')||hits[0]||null;
 };
 const tap=n=>adb('shell','input','tap',String(n.x),String(n.y));
 const find=async(fn,timeout=30000)=>{
  const until=Date.now()+timeout;
  while(Date.now()<until){
   try{const data=dump(),match=fn(data);if(match)return match;}catch{}
   await pause(800);
  }
  throw Error('Android SAF system picker control unavailable');
 };
 // The document activity must actually be present.
 await find(ns=>ns.some(n=>/com\.google\.android\.documentsui|com\.android\.documentsui/.test(n.package||'')));
 if(mode==='cancel'){
  adb('shell','input','keyevent','KEYCODE_BACK');
  return 'cancelled-by-android-picker';
 }
 let elements=dump();
 // The initial-uri hint may already place us in Downloads.
 // If the file is absent or Save is disabled in Recent, use the system navigation drawer.
 const title=elements.map(n=>n.text||'').join('|');
 const needsFolder=mode==='open'
  ? !elements.some(n=>(n.text||'').includes(filename))
  : /Recent|Recenti/i.test(title)&&!/Download|Scaricati|Downloads/.test(title);
 if(needsFolder){
  let opener=pick(elements,n=>/Show roots|Show navigation drawer|Navigation drawer|Mostra percorsi|Apri menu di navigazione/i
   .test(n['content-desc']||'')||
   /:id\/roots_list_button$|:id\/hamburger$/.test(n['resource-id']||''));
  if(!opener){
   // AOSP DocumentsUI's drawer menu is at the upper-left on these emulators.
   adb('shell','input','tap','48','76');
  } else tap(opener);
  elements=await find(ns=>pick(ns,n=>/^(Downloads|Download|Scaricati)$/i.test(n.text||'')),18000);
  const folder=pick(elements,n=>/^(Downloads|Download|Scaricati)$/i.test(n.text||''));
  if(!folder)throw Error('SAF Downloads location unavailable');
  tap(folder);
 }
 if(mode==='create'){
  const button=await find(ns=>pick(ns,n=>/^(save|salva)$/i.test(n.text||'')||
    /:id\/button1$|:id\/action_save$/.test(n['resource-id']||'')),25000);
  tap(button);
  // Duplicate name confirmation is an actual Android permission decision.
  try{
   const replace=await find(ns=>pick(ns,n=>/^(replace|sostituisci|overwrite|sovrascrivi)$/i.test(n.text||'')),3000);
   tap(replace);
  }catch{}
  return 'android-create-document-selected';
 }
 const file=await find(ns=>pick(ns,n=>(n.text||'')===filename||
  (n['content-desc']||'')===filename),25000);
 tap(file);
 return 'android-open-document-selected';
}
