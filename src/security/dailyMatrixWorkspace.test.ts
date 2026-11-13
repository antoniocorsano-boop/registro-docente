import {describe,expect,test} from 'bun:test';
import type {AppData,Grade,BehaviorRecord} from '../types';
import {applyDailyObservation,createDailyBatchId,resolveDailyWorkspace} from '../persistence/dailyMatrixWorkspace';
const date='2026-11-13';
const daily=createDailyBatchId('12345678-1234-4234-8234-123456789abc');
const daily2=createDailyBatchId('22345678-1234-4234-8234-123456789abc');
const grade=(id:string,studentId:string,batchId?:string,patch:Partial<Grade>={}):Grade=>({id,studentId,batchId,date,type:'disegno',period:'Q1',title:'Prova sintetica',value:'8',...patch});
const obs:BehaviorRecord={id:'obs',studentId:'x',date,status:'Ottimale 🌟',note:'Nota sintetica'};
const data=(grades:Grade[]=[],behaviors:BehaviorRecord[]=[]):AppData=>({currentClassId:'a',classes:[{id:'a',name:'A',students:[{id:'x',name:'Fittizio X'},{id:'y',name:'Fittizio Y'}],grades,behaviors},{id:'b',name:'B',students:[{id:'z',name:'Fittizio Z'}],grades:[],behaviors:[]}]});
describe('VAL-01/S4b1 daily context',()=>{
 test('empty day, canonical daily recovery and isolation of imported/legacy rows',()=>{
  expect(resolveDailyWorkspace(data(),'a',date).automaticBatchId).toBeNull();
  const source=data([grade('g1','x',daily),grade('g2','y',daily),grade('g3','x','online_sub'),grade('g4','y'),grade('g5','x','other',{date:'2026-11-12'})],[obs]);
  const result=resolveDailyWorkspace(source,'a',date);
  expect(result.automaticBatchId).toBe(daily);expect(result.candidates.length).toBe(1);expect(result.candidates[0].grades.length).toBe(2);
  expect(result.historicalOnlyCount).toBe(2);expect(result.observations.get('x')).toEqual(obs);
  expect(resolveDailyWorkspace(source,'b',date).candidates).toEqual([]);
 });
 test('multiple proofs require selection, historical batch never auto-selected',()=>{
  const one=resolveDailyWorkspace(data([grade('g1','x','legacy')]),'a',date);
  expect(one.automaticBatchId).toBeNull();expect(one.selectionRequired).toBe(true);expect(one.candidates[0].source).toBe('historical');
  const two=resolveDailyWorkspace(data([grade('g1','x',daily),grade('g2','x',daily2,{type:'orale'})]),'a',date);
  expect(two.automaticBatchId).toBeNull();expect(two.selectionRequired).toBe(true);expect(two.candidates.length).toBe(2);
 });
 test('ambiguous, inconsistent, cross-class or off-roster batches remain read-only',()=>{
  for(const grades of [[grade('g1','x',daily),grade('g2','x',daily)],[grade('g1','x',daily),grade('g2','y',daily,{type:'orale'})],[grade('g1','z',daily)],[grade('g1','x','daily_invalid')],[grade('g1','x',daily),grade('g2','y',daily,{date:'2026-11-12'})]]){
   const result=resolveDailyWorkspace(data(grades),'a',date);expect(result.candidates).toEqual([]);expect(result.automaticBatchId).toBeNull();
  }
  const cross=data([grade('g1','x',daily)]);cross.classes[1].grades=[grade('g2','z',daily)];expect(resolveDailyWorkspace(cross,'a',date).candidates).toEqual([]);
  expect(()=>resolveDailyWorkspace(data(),'a','2026-02-30')).toThrow();
 });
 test('observation update preserves note, older duplicate, other days, marks and classes',()=>{
  const old={...obs,id:'old',status:'Distratto ⚠️' as const};const prior={...obs,id:'prior',date:'2026-11-12'};
  const original=data([grade('g1','x',daily)],[old,obs,prior]);
  const changed=applyDailyObservation(original,'a',{date,studentId:'x',status:'Costruttivo 👍',expected:obs},'unused');
  expect(changed.classes[0].behaviors).toEqual([old,{...obs,status:'Costruttivo 👍'},prior]);
  expect(changed.classes[0].grades).toEqual(original.classes[0].grades);expect(changed.classes[1]).toEqual(original.classes[1]);expect(original.classes[0].behaviors[1]).toEqual(obs);
  expect(applyDailyObservation(original,'a',{date,studentId:'x',status:obs.status,expected:obs},'unused')).toBe(original);
 });
 test('new observation only when explicit, stale or missing recipient rejected',()=>{
  const original=data([], [obs]);
  const req={date,studentId:'y',status:'Costruttivo 👍' as const,expected:null};
  const next=applyDailyObservation(original,'a',req,'new');
  expect(next.classes[0].behaviors).toHaveLength(2);expect(next.classes[0].grades).toEqual([]);
  expect(()=>applyDailyObservation(next,'a',req,'another')).toThrow();
  expect(()=>applyDailyObservation(original,'a',{...req,studentId:'x',expected:{...obs,status:'Distratto ⚠️'}},'other')).toThrow();
  expect(()=>applyDailyObservation(original,'a',{...req,studentId:'z'},'new')).toThrow();
  expect(()=>applyDailyObservation(original,'a',req,'obs')).toThrow();
 });
});
