/** DOC-01/D4c3b — fail-closed guard for unsupported DOC-01 backup history.
 * V6 and V7 have NO authorization to serialize or restore this new domain.
 * This is a bounded inspection, not a new backup codec or restore authority.
 */
const unsupported=()=>new Error('DOC01_HISTORY_BACKUP_UNSUPPORTED');

/** No accessor is invoked, nor is an unsupported marker normalized away.
 * Defensive traversal prevents nested aliases from laundering DOC-01 history
 * into a previously versioned backup. Cycles / exotic objects fail closed.
 */
export function assertNoUnsupportedDocumentHistory(value:unknown):void{
 const ancestors=new Set<object>();
 let remaining=500000;
 const visit=(current:unknown,depth:number):void=>{
  if(current===null||typeof current!=='object')return;
  if(--remaining<0||depth>64||ancestors.has(current))throw unsupported();
  ancestors.add(current);
  try{
   const proto=Object.getPrototypeOf(current);
   if(proto!==null&&proto!==Object.prototype&&proto!==Array.prototype)throw unsupported();
   for(const key of Reflect.ownKeys(current)){
    if(typeof key!=='string'||(key==='documentHistoryV1'||key==='documentHistoryV2'))throw unsupported();
    const descriptor=Object.getOwnPropertyDescriptor(current,key);
    if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw unsupported();
    visit(descriptor.value,depth+1);
   }
  }catch{throw unsupported();}
  finally{ancestors.delete(current);}
 };
 visit(value,0);
}
