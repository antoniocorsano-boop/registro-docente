import {describe,expect,test} from 'bun:test';
import {applyMatrixCell,type MatrixCellWrite} from '../persistence/matrixCellMutation';
import type {AppData} from '../types';
const data:AppData={currentClassId:'a',classes:[{id:'a',name:'A',students:[{id:'x',name:'Fittizio X'},{id:'y',name:'Fittizio Y'}],grades:[],behaviors:[]},{id:'b',name:'B',students:[{id:'z',name:'Fittizio Z'}],grades:[],behaviors:[]}]};
const request:MatrixCellWrite={proof:{batchId:'batch',date:'2026-11-13',period:'Q1',type:'test',title:'Prova'},studentId:'x',value:'8',delayed:false,expected:null,existingBatch:false};
describe('VAL-01 cell mutation',()=>{
 test('inserts only one cell, retains siblings, edits stable id',()=>{
  const one=applyMatrixCell(data,'a',request,[],'g1');const two=applyMatrixCell(one,'a',{...request,studentId:'y',value:'NC',existingBatch:true},[],'g2');
  const edited=applyMatrixCell(two,'a',{...request,value:'9',existingBatch:true,expected:two.classes[0].grades[0]},[],'ignored');
  expect(edited.classes[0].grades.map(g=>[g.id,g.value])).toEqual([['g1','9'],['g2','NC']]);expect(edited.classes[1]).toEqual(data.classes[1]);expect(data.classes[0].grades).toEqual([]);
 });
 test('rejects stale, ambiguous, invalid, blank, foreign roster or changed proof',()=>{
  const one=applyMatrixCell(data,'a',request,[],'g1');
  for(const invalid of [{...request,value:''},{...request,value:'xyz'},{...request,studentId:'z'},{...request,existingBatch:true},{...request,proof:{...request.proof,title:'Altro'},existingBatch:true},{...request,proof:{...request.proof,udaId:'unknown'}}])expect(()=>applyMatrixCell(one,'a',invalid,[],'g2')).toThrow();
  expect(()=>applyMatrixCell(one,'b',request,[],'g2')).toThrow();
  expect(()=>applyMatrixCell(one,'a',{...request,expected:{...one.classes[0].grades[0],value:'7'},existingBatch:true},[],'g2')).toThrow();
 });
});
