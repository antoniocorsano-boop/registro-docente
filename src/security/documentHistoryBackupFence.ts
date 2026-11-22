/** DOC-01 and VAL-01/S7d1: reject unsupported historical domains before
 * old backup serialization or restore. V6-V9 cannot claim lossless support
 * for formativeBalanceHistoryV1 until a separately validated new codec ships.
 */
const unsupported=()=>new Error('DOC01_HISTORY_BACKUP_UNSUPPORTED');
const formativeUnsupported=()=>new Error('FORMATIVE_HISTORY_STORAGE_UNSUPPORTED');
function rejectReservedHistory(
 value:unknown,blocked:(key:string)=>boolean,error:()=>Error
):void{
 const ancestors=new Set<object>();
 let remaining=500000;
 const visit=(current:unknown,depth:number):void=>{
  if(current===null||typeof current!=='object')return;
  if(--remaining<0||depth>64||ancestors.has(current))throw error();
  ancestors.add(current);
  try{
   const proto=Object.getPrototypeOf(current);
   if(proto!==null&&proto!==Object.prototype&&proto!==Array.prototype)throw error();
   for(const key of Reflect.ownKeys(current)){
    if(typeof key!=='string'||blocked(key))throw error();
    const descriptor=Object.getOwnPropertyDescriptor(current,key);
    if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw error();
    visit(descriptor.value,depth+1);
   }
  }catch{throw error();}
  finally{ancestors.delete(current);}
 };
 visit(value,0);
}
/** Existing backup callers use this guard for V6-V9. No getters or toJSON
 * are executed; nested aliases and cycles are rejected rather than repaired.
 */
export function assertNoUnsupportedDocumentHistory(value:unknown):void{
 rejectReservedHistory(value,key=>key==='documentHistoryV1'||
  key==='documentHistoryV2'||key==='formativeBalanceHistoryV1',unsupported);
}
/** Current encrypted AppData save paths must not write an unqualified future
 * history format. DOC-01/V2 is intentionally NOT forbidden on normal saves.
 */
export function assertNoUnsupportedFormativeHistory(value:unknown):void{
 rejectReservedHistory(value,key=>key==='formativeBalanceHistoryV1',formativeUnsupported);
}
