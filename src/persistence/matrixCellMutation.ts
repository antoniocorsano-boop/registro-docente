import type { AppData, EvaluationType, Grade, UdaRecord } from '../types';
import { normalizeGrade } from '../utils';

export interface MatrixProof {
  batchId:string; period:'Q1'|'Q2'; type:EvaluationType; date:string; title:string; udaId?:string;
}
export interface MatrixCellWrite {
  proof:MatrixProof; studentId:string; value:string; delayed:boolean;
  expected:Grade|null; existingBatch:boolean;
}
export function isMatrixDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
/** One cell, one durable mutation. Never replace the rest of the batch. */
export function applyMatrixCell(current:AppData,classId:string,request:MatrixCellWrite,udas:readonly UdaRecord[],newId:string):AppData {
  const {proof,studentId,expected,existingBatch}=request;
  const parsed=normalizeGrade(request.value);
  const classes=current.classes.filter(c=>c.id===classId);
  if(classes.length!==1||!proof.batchId||!proof.title.trim()||!isMatrixDate(proof.date)||!['Q1','Q2'].includes(proof.period)||!['test','verifica','orale','disegno','osserv'].includes(proof.type)||!parsed||typeof request.delayed!=='boolean')throw Error('Dati della valutazione non validi.');
  const target=classes[0];
  if(target.students.filter(st=>st.id===studentId).length!==1)throw Error('Alunno non più disponibile.');
  if(proof.udaId&&(udas.filter(u=>u.id===proof.udaId).length!==1||!udas.some(u=>u.id===proof.udaId&&u.className===target.name)))throw Error('UDA non più disponibile.');
  const all=current.classes.flatMap(c=>c.grades||[]);
  const batch=(target.grades||[]).filter(g=>g.batchId===proof.batchId);
  if(all.filter(g=>g.batchId===proof.batchId).length!==batch.length||Boolean(batch.length)!==existingBatch||
    batch.some(g=>g.date!==proof.date||g.type!==proof.type||g.period!==proof.period||g.title!==proof.title||g.udaId!==proof.udaId)||
    new Set(batch.map(g=>g.studentId)).size!==batch.length)throw Error('Prova non più disponibile.');
  const rows=batch.filter(g=>g.studentId===studentId);
  if(rows.length!==(expected?1:0))throw Error('Valutazione modificata: riaprire la prova.');
  if(expected){const old=rows[0];if(old.id!==expected.id||old.value!==expected.value||!!old.delayed!==!!expected.delayed||old.studentId!==expected.studentId||old.batchId!==expected.batchId)throw Error('Valutazione modificata: riaprire la prova.');}
  if(!expected&&(!newId||all.some(g=>g.id===newId)))throw Error('Identità della valutazione non disponibile.');
  const grade:Grade={...proof,id:expected?.id||newId,studentId,value:parsed.value,delayed:request.delayed||parsed.delayed};
  return {...current,classes:current.classes.map(c=>c.id===classId?{...c,grades:expected?c.grades.map(g=>g.id===expected.id&&g.studentId===studentId&&g.batchId===proof.batchId?grade:g):[...(c.grades||[]),grade]}:c)};
}
