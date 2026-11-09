import {describe,expect,test} from 'bun:test';
import {isAssessmentClassUnambiguous} from './assessmentGenerationClassGate';

const CLASSES=[
  {id:'class-3c',name:'3C'},
  {id:'class-2c',name:'2C'}
];

describe('INT-02/S3c-02 — univocità classe prima di inviare la fonte remota',()=>{
  test('accetta soltanto ID e nome classe corrispondenti, entrambi univoci',()=>{
    expect(isAssessmentClassUnambiguous(CLASSES,'class-3c','3C')).toBe(true);
    expect(isAssessmentClassUnambiguous(CLASSES,'class-2c','2C')).toBe(true);
    expect(isAssessmentClassUnambiguous(CLASSES,'class-3c','2C')).toBe(false);
    expect(isAssessmentClassUnambiguous(CLASSES,'missing','3C')).toBe(false);
    expect(isAssessmentClassUnambiguous(CLASSES,'class-3c',null)).toBe(false);
    expect(isAssessmentClassUnambiguous(CLASSES,null,'3C')).toBe(false);
  });

  test('rifiuta classe omonima anche con identificativo attivo corretto',()=>{
    const duplicate=[...CLASSES,{id:'second-3c',name:'3C'}];
    expect(isAssessmentClassUnambiguous(duplicate,'class-3c','3C')).toBe(false);
    expect(isAssessmentClassUnambiguous(duplicate,'second-3c','3C')).toBe(false);
    expect(isAssessmentClassUnambiguous(duplicate,'class-2c','2C')).toBe(true);
  });

  test('rifiuta ID duplicato o classe ricreata con lo stesso nome',()=>{
    const duplicateId=[...CLASSES,{id:'class-3c',name:'4C'}];
    expect(isAssessmentClassUnambiguous(duplicateId,'class-3c','3C')).toBe(false);
    expect(isAssessmentClassUnambiguous([{id:'new-3c',name:'3C'}],'class-3c','3C')).toBe(false);
  });
});
