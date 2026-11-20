/** DOC-01/D4c3e1 — authorization and teacher review in an isolated UI laboratory.
 * A preview is not a physical restore: the DB2 owner remains the sole writer.
 * No production owner or Android bridge is connected in this increment.
 */
export interface DocumentRecoveryReview {
 readonly version:8;
 readonly eventsBefore:number;
 readonly eventsAfter:number;
 readonly gradesPreserved:true;
 readonly assessmentsPreserved:true;
 readonly recoveryCopyVerified:true;
 readonly replacementRequiresConfirmation:true;
}
export interface DocumentRecoveryDriver {
 prepare():Promise<{review:DocumentRecoveryReview;grant:object}>;
 commit(grant:object,consent:true):Promise<void>;
 invalidate():void;
 verifyAfterReopen():Promise<boolean>;
}
export type DocumentRecoveryPhase='idle'|'preparing'|'prepared'|'committing'|'verification-required'|'verifying'|'completed'|'cancelled'|'uncertain';
export interface DocumentRecoveryDecision {
 phase():DocumentRecoveryPhase;
 review():DocumentRecoveryReview|null;
 prepare():Promise<DocumentRecoveryReview>;
 confirm(authorization:{accepted:boolean;phrase:string}):Promise<void>;
 cancel():void;
 verifyAfterReopen():Promise<boolean>;
}
/** The DB2 service owns actual authorization and replacement; this controller
 * owns only the teacher's separate, one-use decision to consume its grant.
 * A returned commit promise cannot prove a successful fresh reopen.
 */
export function createDocumentRecoveryDecision(driver:DocumentRecoveryDriver):DocumentRecoveryDecision {
 let current:DocumentRecoveryPhase='idle';
 let displayed:DocumentRecoveryReview|null=null;
 let grant:object|null=null;
 let preparingGeneration=0;
 const fail=(message:string):never=>{throw Error(message);};
 const inspect=(raw:DocumentRecoveryReview):DocumentRecoveryReview=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('Anteprima del recupero non verificabile.');
  const keys=['version','eventsBefore','eventsAfter','gradesPreserved','assessmentsPreserved','recoveryCopyVerified','replacementRequiresConfirmation'];
  const fields=Object.getOwnPropertyDescriptors(raw);
  if(Reflect.ownKeys(raw).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(fields,k)||!Object.prototype.hasOwnProperty.call(fields[k],'value')))return fail('Anteprima del recupero incompleta.');
  if(fields.version.value!==8||!Number.isSafeInteger(fields.eventsBefore.value)||fields.eventsBefore.value<0||
     !Number.isSafeInteger(fields.eventsAfter.value)||fields.eventsAfter.value<fields.eventsBefore.value||
     fields.gradesPreserved.value!==true||fields.assessmentsPreserved.value!==true||
     fields.recoveryCopyVerified.value!==true||fields.replacementRequiresConfirmation.value!==true)
    return fail('Anteprima del recupero non valida.');
  return Object.freeze({
   version:8,eventsBefore:fields.eventsBefore.value,eventsAfter:fields.eventsAfter.value,
   gradesPreserved:true,assessmentsPreserved:true,recoveryCopyVerified:true,
   replacementRequiresConfirmation:true
  });
 };
 const invalidate=()=>{grant=null;displayed=null;driver.invalidate();};
 return {
  phase:()=>current,
  review:()=>current==='prepared'?displayed:null,
  async prepare(){
   if(current!=='idle')return fail('Operazione già avviata.');
   current='preparing';const generation=++preparingGeneration;
   try{
    const next=await driver.prepare();
    if(current!=='preparing'||generation!==preparingGeneration){invalidate();return fail('Preparazione annullata.');}
    if(!next||!next.grant||typeof next.grant!=='object')return fail('Conferma protetta non disponibile.');
    const safe=inspect(next.review);
    grant=next.grant;displayed=safe;current='prepared';
    return safe;
   }catch(error){
    if(current==='preparing')current='cancelled';
    invalidate();
    throw error;
   }
  },
  async confirm(authorization){
   if(current!=='prepared'||!grant)return fail('Nessuna conferma disponibile.');
   if(!authorization||authorization.accepted!==true||authorization.phrase!=='RIPRISTINA')
    return fail('Per procedere occorre una conferma esplicita.');
   const token=grant;
   grant=null;displayed=null;current='committing';
   try{
    // Consume before the await: neither repeated taps nor a second caller
    // can perform another physical replacement with the same grant.
    await driver.commit(token,true);
    current='verification-required';
   }catch(error){
    current='uncertain';invalidate();
    throw error; // No rollback and no claim that the previous DB2 survived.
   }
  },
  cancel(){
   if(current!=='idle'&&current!=='preparing'&&current!=='prepared')
    return fail('Una sostituzione eseguita non può essere annullata.');
   current='cancelled';++preparingGeneration;invalidate();
  },
  async verifyAfterReopen(){
   if(current!=='verification-required')return fail('Prima occorre completare il recupero.');
   current='verifying';
   try{
    const verified=await driver.verifyAfterReopen();
    current=verified===true?'completed':'uncertain';
    invalidate();
    return verified===true;
   }catch(error){current='uncertain';invalidate();throw error;}
  }
 };
}
