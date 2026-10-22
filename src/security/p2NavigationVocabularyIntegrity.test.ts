import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const between = (text: string, start: string, end: string) => {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
};

describe('P2-NAV-01 navigation and vocabulary consolidation', () => {
  test('teacher-facing navigation uses one canonical vocabulary', async () => {
    const navbar = await source('components/Navbar.tsx');
    const dashboard = await source('components/DashboardView.tsx');
    const home = await source('components/HomeView.tsx');

    for (const label of [
      'Riepilogo',
      'Valutazioni',
      'Comportamento',
      'Tabellone',
      'Analisi',
      'Scheda alunno',
      'Storico prove',
      'UDA',
      'Verifiche online',
      'Classi',
    ]) {
      expect(navbar).toContain(label);
    }

    expect(home).toContain('Le mie classi');
    expect(home).toContain('Apri classe');

    for (const legacyLabel of [
      'Inserisci Voti',
      'Inserisci Valutazioni',
      'Valutazione Comportamenti',
      'Note Comportamento',
      'Analisi & indicatori',
      'Analisi Soglie',
      '>Analytics<',
      'Dashboard Classe',
      '>Dashboard<',
      'Cruscotto Istituto',
      '>Cruscotto<',
      'UDA & Gantt',
      'Programmazione UDA & Gantt',
      'Verifiche Online & Flashcards',
    ]) {
      expect(navbar).not.toContain(legacyLabel);
      expect(dashboard).not.toContain(legacyLabel);
    }

    expect(home).not.toContain("Cruscotto Globale d'Istituto");
    expect(home).not.toContain('Apri Dashboard');
    expect(home).not.toContain('Cross-Class');
  });

  test('drawer is reserved for secondary functions and does not duplicate daily navigation', async () => {
    const navbar = await source('components/Navbar.tsx');
    const drawer = between(navbar, '{/* Side Drawer */}', '{/* Drawer footer with backup actions */}');

    expect(drawer).toContain('Altre funzioni');
    for (const dailyTab of ['dashboard', 'voti', 'comportamenti', 'tabellone', 'analytics']) {
      expect(drawer).not.toContain(`handleNav('${dailyTab}')`);
    }

    for (const secondaryTab of ['storico', 'report', 'dati', 'verifiche-online', 'uda-gantt', 'impostazioni', 'privacy']) {
      expect(drawer).toContain(`handleNav('${secondaryTab}')`);
    }
  });

  test('primary navigation has no 640-767px breakpoint gap', async () => {
    const navbar = await source('components/Navbar.tsx');
    const mobile = between(navbar, '{/* Bottom Navigation for mobile */}', '</nav>');
    const desktop = between(
      navbar,
      '{/* Desktop / Tablet Workflow Hub Bar',
      '{/* Class active banner for small screens */}',
    );

    expect(mobile).toContain('md:hidden');
    expect(mobile).not.toContain('sm:hidden');
    expect(desktop).toContain('hidden md:flex');
  });

  test('content keeps bottom-navigation clearance until the desktop breakpoint', async () => {
    const app = await source('App.tsx');

    expect(app).toContain('pb-16 md:pb-8');
    expect(app).not.toContain('pb-16 sm:pb-8');
  });

  test('primary desktop and mobile navigation still expose every daily route', async () => {
    const navbar = await source('components/Navbar.tsx');
    const desktop = between(
      navbar,
      '{/* Desktop / Tablet Workflow Hub Bar',
      '{/* Class active banner for small screens */}',
    );
    const mobile = between(navbar, '{/* Bottom Navigation for mobile */}', '</nav>');

    for (const dailyTab of ['dashboard', 'voti', 'comportamenti', 'tabellone', 'analytics']) {
      expect(desktop).toContain(`handleNav('${dailyTab}')`);
      expect(mobile).toContain(`handleNav('${dailyTab}')`);
    }

    expect(desktop).toContain('Riepilogo');
    expect(desktop).toContain('Valutazioni');
    expect(desktop).toContain('Comportamento');
    expect(desktop).toContain('Tabellone');
    expect(desktop).toContain('Analisi');

    expect(mobile).toContain('Riepilogo');
    expect(mobile).toContain('Valutazioni');
    expect(mobile).toContain('Comportamento');
    expect(mobile).toContain('Tabellone');
    expect(mobile).toContain('Analisi');
  });
});
