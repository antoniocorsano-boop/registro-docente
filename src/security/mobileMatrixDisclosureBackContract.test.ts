import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  createMobileMatrixDisclosureState,
  isMobileMatrixDisclosureState
} from '../navigation/mobileMatrixDisclosureHistory';

describe('NAV-MOBILE-BACK-01 — inline Tabellone disclosure has a real Back step', () => {
  test('only the authorized class Tabellone route can create a marker', () => {
    const original = { classId: 'classe-a', tab: 'tabellone' };
    expect(createMobileMatrixDisclosureState(original, 'classe-a')).toEqual({
      classId: 'classe-a', tab: 'tabellone', matrixDisclosure: true
    });
    expect(original).toEqual({ classId: 'classe-a', tab: 'tabellone' });
    expect(createMobileMatrixDisclosureState(original, 'classe-b')).toBeNull();
    expect(createMobileMatrixDisclosureState({ classId: 'classe-a', tab: 'voti' }, 'classe-a')).toBeNull();
    expect(createMobileMatrixDisclosureState(null, 'classe-a')).toBeNull();
  });

  test('route marker contains no student identifiers, grades, names or private return context', () => {
    const fromOtherFields = {
      classId: 'classe-a', tab: 'tabellone',
      studentId: 'fittizio-alunno-a', studentSearch: 'Persona Fittizia',
      grade: 7, expandedStudentId: 'fittizio-alunno-a'
    };
    const state = createMobileMatrixDisclosureState(fromOtherFields, 'classe-a');
    expect(state).toEqual({ classId: 'classe-a', tab: 'tabellone', matrixDisclosure: true });
    expect(JSON.stringify(state)).not.toContain('fittizio');
    expect(JSON.stringify(state)).not.toContain('student');
    expect(JSON.stringify(state)).not.toContain('grade');
    expect(isMobileMatrixDisclosureState(state, 'classe-a')).toBe(true);
    expect(isMobileMatrixDisclosureState(state, 'classe-b')).toBe(false);
    expect(isMobileMatrixDisclosureState({ ...state, matrixDisclosure: false }, 'classe-a')).toBe(false);
    expect(isMobileMatrixDisclosureState({ ...state, tab: 'report' }, 'classe-a')).toBe(false);
  });

  test('only mobile MatrixView consumes the inline history entry; desktop remains unchanged', () => {
    const code = readFileSync('src/components/MatrixView.tsx', 'utf8');
    const browser = readFileSync('tests/browser/nav-mobile-disclosure-back.spec.cjs', 'utf8');
    expect(code).toContain('window.history.pushState(state,');
    expect(code).toContain("window.history.back();");
    expect(code).toContain("window.addEventListener('popstate', handleMobileDisclosurePopState)");
    expect(code).toContain('lastExpandedMobileStudentIdRef.current');
    expect(code).toContain('onToggle={() => handleToggleMobileStudent(s.id)}');
    expect(code).toContain('className="hidden md:block overflow-x-auto');
    expect(code).toContain('displayName={formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}');
    expect(browser).toContain('320');
    expect(browser).toContain('390');
    expect(browser).toContain('goBack');
    expect(browser).toContain('goForward');
    expect(browser).toContain('Scheda alunno');
  });
});
