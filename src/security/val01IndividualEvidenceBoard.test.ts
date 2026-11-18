import {describe,test,expect} from 'bun:test';
import {projectEvidenceBoard} from '../assessment/individualEvidenceBoard';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
const project=(d:unknown=boardDocument,s:unknown=boardScope,a:unknown='a2',c:unknown='c1')=>projectEvidenceBoard(d,s,a,c);
describe('VAL-01/S6c.1 — individual evidence board',()=>{
 test('valid fixture, roster order, four distinct states and exact criterion',()=>{
  expect(validateAssessmentEvidenceV1(boardDocument,boardScope).valid).toBe(true);
  const p=project();expect(p.valid).toBe(true);if(!p.valid)throw Error(p.issue);
  expect(p.rows.map(r=>[r.studentId,r.entries.map(e=>e.state)])).toEqual([['s1',['observed']],['s2',['not_observed']],['s3',['not_applicable']],['s4',[]],['s5',[]]]);
  const other=project(boardDocument,boardScope,'a2','c2');if(!other.valid)throw Error(other.issue);
  expect(other.rows.map(r=>r.entries.length)).toEqual([0,0,0,0,1]);
 });
 test('rejects historical or unknown selection and foreign scope',()=>{
  expect(project(boardDocument,boardScope,'a1')).toEqual({valid:false,issue:'INVALID_SELECTION'});
  expect(project(boardDocument,boardScope,'a2','foreign')).toEqual({valid:false,issue:'INVALID_SELECTION'});
  expect(project(boardDocument,{...boardScope,classId:'foreign'})).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
 });
 test('keeps correction once, excludes withdrawn revision, source unchanged',()=>{
  const original=boardDocument.evidence[0];
  const revised={...original,revisionId:'corrected',supersedesRevisionId:original.revisionId,recordedAt:'2026-11-21T09:00:00.000Z',confirmedAt:'2026-11-21T10:00:00.000Z'};
  const d={...boardDocument,evidence:[...boardDocument.evidence,revised]};
  const before=JSON.stringify(d),p=project(d);if(!p.valid)throw Error(p.issue);
  expect(p.rows[0].entries.map(e=>e.revisionId)).toEqual(['corrected']);expect(JSON.stringify(d)).toBe(before);
  const {state:unusedState,...identity}=revised;
  // Strip observed-only fields before creating the withdrawal.
  const withdrawal={...identity,revisionId:'withdrawn',supersedesRevisionId:'corrected',state:'withdrawn',reason:'Rilevazione ritirata',recordedAt:'2026-11-22T09:00:00.000Z',confirmedAt:'2026-11-22T10:00:00.000Z'};
  const clean=Object.fromEntries(Object.entries(withdrawal).filter(([k])=>k!=='fact'&&k!=='interpretation'));
  const w=project({...d,evidence:[...d.evidence,clean]});if(!w.valid)throw Error(w.issue);
  expect(w.rows[0].entries).toEqual([]);
 });
 test('rejects accessors without invocation',()=>{
  let called=false;const d={...boardDocument,get evidence(){called=true;return [];}};
  expect(project(d)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});expect(called).toBe(false);
 });
});
