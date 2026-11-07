import { describe, expect, test } from 'bun:test';
import {
  recallSpecialistTarget,
  forgetSpecialistTarget,
  rememberSpecialistTarget,
  updateStudentSpecialistTarget,
  type SpecialistTargetMemory
} from './specialistTargetMemory';

describe('REG-NAV-01 — session-only specialist history targets', () => {
  test('restores evaluation A after B without confusing entries, classes or tabs', () => {
    const memory: SpecialistTargetMemory = new Map();
    expect(rememberSpecialistTarget(memory, 'entry-A', 'class-1', 'voti',
      { kind: 'evaluation', batchId: 'batch-A' })).toBe(true);
    expect(rememberSpecialistTarget(memory, 'entry-B', 'class-1', 'voti',
      { kind: 'evaluation', batchId: 'batch-B' })).toBe(true);
    expect(recallSpecialistTarget(memory, 'entry-A', 'class-1', 'voti'))
      .toEqual({ kind: 'evaluation', batchId: 'batch-A' });
    expect(recallSpecialistTarget(memory, 'entry-B', 'class-1', 'voti'))
      .toEqual({ kind: 'evaluation', batchId: 'batch-B' });
    expect(recallSpecialistTarget(memory, 'entry-A', 'class-2', 'voti')).toBeNull();
    expect(recallSpecialistTarget(memory, 'entry-A', 'class-1', 'report')).toBeNull();
    expect(recallSpecialistTarget(memory, 'foreign-entry', 'class-1', 'voti')).toBeNull();
  });

  test('restores distinct student reports and updates an internal selection only for its entry', () => {
    const memory: SpecialistTargetMemory = new Map();
    rememberSpecialistTarget(memory, 'report-A', 'class-1', 'report',
      { kind: 'student', studentId: 'student-A' });
    rememberSpecialistTarget(memory, 'report-B', 'class-1', 'report',
      { kind: 'student', studentId: 'student-B' });

    expect(updateStudentSpecialistTarget(memory, 'report-A', 'class-2', 'student-C')).toBe(false);
    expect(updateStudentSpecialistTarget(memory, 'report-A', 'class-1', 'student-C')).toBe(true);
    expect(recallSpecialistTarget(memory, 'report-A', 'class-1', 'report'))
      .toEqual({ kind: 'student', studentId: 'student-C' });
    expect(recallSpecialistTarget(memory, 'report-B', 'class-1', 'report'))
      .toEqual({ kind: 'student', studentId: 'student-B' });
    memory.clear(); // Lock/unmount: no persistent history target data.
    expect(recallSpecialistTarget(memory, 'report-A', 'class-1', 'report')).toBeNull();
  });

  test('refuses mismatched tabs or empty targets', () => {
    const memory: SpecialistTargetMemory = new Map();
    expect(rememberSpecialistTarget(memory, 'wrong', 'class-1', 'report',
      { kind: 'evaluation', batchId: 'batch-A' })).toBe(false);
    expect(rememberSpecialistTarget(memory, 'empty', null, 'report',
      { kind: 'student', studentId: 'student-A' })).toBe(false);
    expect(rememberSpecialistTarget(memory, '', 'class-1', 'report',
      { kind: 'student', studentId: 'student-A' })).toBe(false);
    expect(memory.size).toBe(0);
  });

  test('annullamento modifica invalida solo il batch associato alla entry corrente', () => {
    const memory: SpecialistTargetMemory = new Map();
    rememberSpecialistTarget(memory, 'edit-A', 'class-1', 'voti',
      { kind: 'evaluation', batchId: 'batch-A' });
    rememberSpecialistTarget(memory, 'edit-B', 'class-1', 'voti',
      { kind: 'evaluation', batchId: 'batch-B' });

    expect(forgetSpecialistTarget(memory, 'edit-A', 'class-2', 'voti')).toBe(false);
    expect(recallSpecialistTarget(memory, 'edit-A', 'class-1', 'voti'))
      .toEqual({ kind: 'evaluation', batchId: 'batch-A' });
    expect(forgetSpecialistTarget(memory, 'edit-A', 'class-1', 'voti')).toBe(true);
    expect(recallSpecialistTarget(memory, 'edit-A', 'class-1', 'voti')).toBeNull();
    expect(recallSpecialistTarget(memory, 'edit-B', 'class-1', 'voti'))
      .toEqual({ kind: 'evaluation', batchId: 'batch-B' });
  });

});
