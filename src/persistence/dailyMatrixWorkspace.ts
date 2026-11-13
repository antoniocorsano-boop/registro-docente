import type { AppData, BehaviorRecord, Grade } from '../types';
import { applyObservationChanges, isObservationDate, recordedObservations, type ObservationStatus } from '../behavior/observationChanges';
import { BEHAVIOR_OPTIONS, normalizeGrade } from '../utils';
import { isMatrixDate, type MatrixProof } from './matrixCellMutation';

/** Existing batchId field, no schema migration. Only the daily workspace may
 * create this namespace. Other compatible historical batches require selection. */
export const DAILY_BATCH_PREFIX = 'daily_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createDailyBatchId(uuid: string): string {
  if (!UUID.test(uuid)) throw Error('Identità della prova non valida.');
  return DAILY_BATCH_PREFIX + uuid;
}
export function isDailyBatchId(value: string): boolean {
  return value.startsWith(DAILY_BATCH_PREFIX) && UUID.test(value.slice(DAILY_BATCH_PREFIX.length));
}

export interface DayProofCandidate {
  proof: MatrixProof;
  source: 'daily' | 'historical';
  grades: readonly Grade[];
}
export interface DailyWorkspaceContext {
  candidates: readonly DayProofCandidate[];
  /** Never auto-select a legacy or imported batch by label, date or type. */
  automaticBatchId: string | null;
  selectionRequired: boolean;
  /** Still available in Storico; never fused into a daily editable batch. */
  historicalOnlyCount: number;
  observations: ReadonlyMap<string, BehaviorRecord>;
}
const kinds = ['test','verifica','orale','disegno','osserv'];
export function resolveDailyWorkspace(data: AppData, classId: string, date: string): DailyWorkspaceContext {
  const targets = data.classes.filter(c=>c.id===classId);
  if(targets.length!==1||!isMatrixDate(date)) throw Error('Contesto della giornata non valido.');
  const target=targets[0];
  const rows=(target.grades||[]).filter(g=>g.date===date);
  const byBatch=new Map<string,Grade[]>();
  for(const g of rows) if(g.batchId) byBatch.set(g.batchId,[...(byBatch.get(g.batchId)||[]),g]);
  const all=data.classes.flatMap(c=>c.grades||[]);
  const roster=new Map<string,number>();
  for(const st of target.students) roster.set(st.id,(roster.get(st.id)||0)+1);
  const candidates:DayProofCandidate[]=[];
  let editableCount=0;
  for(const [id,grades] of byBatch){
    const first=grades[0];
    // Individual online submission batches are not class-wide assessments.
    if(id.startsWith('online_') || (id.startsWith(DAILY_BATCH_PREFIX)&&!isDailyBatchId(id))) continue;
    if(!first.title?.trim()||!kinds.includes(first.type)||!['Q1','Q2'].includes(first.period)||
      all.filter(g=>g.batchId===id).length!==grades.length||
      new Set(grades.map(g=>g.studentId)).size!==grades.length||
      grades.some(g=>!g.id||all.filter(other=>other.id===g.id).length!==1||
        roster.get(g.studentId)!==1||!normalizeGrade(g.value)||
        g.date!==date||g.title!==first.title||g.type!==first.type||
        g.period!==first.period||g.udaId!==first.udaId)) continue;
    const proof:MatrixProof={batchId:id,date,type:first.type,period:first.period,title:first.title,...(first.udaId?{udaId:first.udaId}:{})};
    candidates.push({proof,source:isDailyBatchId(id)?'daily':'historical',grades:grades.map(g=>({...g}))});
    editableCount+=grades.length;
  }
  candidates.sort((a,b)=>a.proof.batchId.localeCompare(b.proof.batchId));
  const daily=candidates.filter(c=>c.source==='daily');
  return {
    candidates,
    automaticBatchId:daily.length===1?daily[0].proof.batchId:null,
    selectionRequired:daily.length>1||(daily.length===0&&candidates.length>0),
    historicalOnlyCount:rows.length-editableCount,
    observations:new Map([...recordedObservations(target,date)].map(([id,record])=>[id,{...record}]))
  };
}

export interface DailyObservationWrite {
  date:string; studentId:string; status:ObservationStatus; expected:BehaviorRecord|null;
}
/** Same canonical observation engine; compare exact displayed record first.
 * This cannot erase marks, notes or any other day. */
export function applyDailyObservation(data:AppData,classId:string,request:DailyObservationWrite,newId:string):AppData {
  const {date,studentId,status,expected}=request;
  const targets=data.classes.filter(c=>c.id===classId);
  if(targets.length!==1||!isObservationDate(date)||!BEHAVIOR_OPTIONS.some(o=>o.label===status))throw Error('Contesto osservazione non valido.');
  const target=targets[0];
  if(target.students.filter(st=>st.id===studentId).length!==1)throw Error('Alunno non più disponibile.');
  const previous=recordedObservations(target,date).get(studentId);
  if(Boolean(previous)!==Boolean(expected)||(previous&&expected&&(
    previous.id!==expected.id||previous.studentId!==expected.studentId||previous.date!==expected.date||
    previous.status!==expected.status||previous.note!==expected.note)))throw Error('Osservazione modificata: aggiorna la giornata.');
  if(previous?.status===status)return data;
  const id=previous?.id||newId;
  if(!previous&&(!id||data.classes.some(c=>c.behaviors.some(b=>b.id===id))))throw Error('Identità osservazione non disponibile.');
  const change:BehaviorRecord={id,date,studentId,status};
  const updated=applyObservationChanges(target,[change]);
  return {...data,classes:data.classes.map(c=>c.id===classId?updated:c)};
}
