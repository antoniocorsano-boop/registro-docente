import {describe,test,expect} from 'bun:test';
import {listEvidenceInterpretationOptions} from '../assessment/evidenceInterpretationOptions';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';

const list=(d:unknown=boardDocument,s:unknown=boardScope,a:unknown='a2',c:unknown='c1')=>listEvidenceInterpretationOptions(d,s,a,c);
describe('VAL-01/S6c.2 — frozen interpretation options',()=>{
 test('historical rubric exact revision, never latest or automatic level',()=>{
  const r=list();if(!r.valid||r.mode!=='rubric')throw Error('missing rubric');
  expect(r.rubricRevisionId).toBe('rubric-v1');
  expect(r.levels.map(l=>l.levelId)).toEqual(['l1','l2']);
  expect(Object.keys(r).sort()).toEqual(['levels','mode','rubricRevisionId','valid']);
 });
 test('no rubric exposes descriptive mode without fabricated levels',()=>{
  expect(list(boardDocument,boardScope,'a2','c2')).toEqual({valid:true,mode:'descriptive'});
 });
 test('rejects unrelated scope, planned revision and unknown criterion',()=>{
  expect(list(boardDocument,{...boardScope,classId:'foreign'})).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  expect(list(boardDocument,boardScope,'a1')).toEqual({valid:false,issue:'INVALID_SELECTION'});
  expect(list(boardDocument,boardScope,'a2','foreign')).toEqual({valid:false,issue:'INVALID_SELECTION'});
 });
 test('detached result does not mutate source',()=>{
  const before=JSON.stringify(boardDocument);const r=list();if(!r.valid||r.mode!=='rubric')throw Error('missing rubric');
  expect(r.levels).not.toBe(boardDocument.rubrics[0].criteria[0].levels);expect(JSON.stringify(boardDocument)).toBe(before);
 });
 test('domain rejects latest level and descriptive rubric bypass; no-rubric level rejected',()=>{
  const base={evidenceId:'e-new',revisionId:'r-new',observationEventId:'event-new',assessmentRevisionId:'a2',studentId:'s4',criterionRevisionId:'c1',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:00:00.000Z',state:'observed',fact:{kind:'product',description:'Schema',method:'Elaborato'}};
  const preview=(interpretation:unknown,criterionRevisionId='c1')=>previewIndividualObservation(boardDocument,boardScope,{...base,criterionRevisionId,interpretation});
  expect(preview({kind:'level',levelId:'l2'}).valid).toBe(true);
  expect(preview({kind:'level',levelId:'new'}).valid).toBe(false);
  expect(preview({kind:'description',description:'Descrizione'}).valid).toBe(false);
  expect(preview({kind:'level',levelId:'l2'},'c2').valid).toBe(false);
  expect(preview({kind:'description',description:'Descrizione'},'c2').valid).toBe(true);
  expect(preview({kind:'pending'}).valid).toBe(true);
 });
});
