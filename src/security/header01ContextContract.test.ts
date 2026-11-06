import { describe, expect, test } from 'bun:test';
import type { ActiveTab } from '../types';
import { resolveHeaderContext } from '../components/headerContext';

const routes: Record<ActiveTab, string> = {
  home: 'Registro Docente',
  dashboard: 'Riepilogo',
  voti: 'Valutazioni',
  comportamenti: 'Comportamento',
  analytics: 'Analisi',
  tabellone: 'Tabellone',
  storico: 'Storico prove',
  report: 'Scheda alunno',
  dati: 'Gestione alunni',
  'verifiche-online': 'Verifiche online',
  'uda-gantt': 'UDA',
  programmazione: 'Programmazione',
  biblioteca: 'Biblioteca privata',
  impostazioni: 'Impostazioni',
  privacy: 'Privacy',
};

describe('HEADER-01 / Task 1 — contesto professionale dell’intestazione', () => {
  test('ogni superficie autorizzata espone un titolo esplicito senza dipendere dal marchio', () => {
    for (const [activeTab, title] of Object.entries(routes)) {
      const context = resolveHeaderContext({ activeTab: activeTab as ActiveTab });
      expect(context.title).toBe(title);
    }
  });

  test('Oggi non eredita una classe precedente né uno stato di modifica', () => {
    expect(resolveHeaderContext({
      activeTab: 'home',
      currentClassName: '2C',
      verifiedEditing: true,
    })).toEqual({
      title: 'Registro Docente',
      subtitle: 'Oggi',
      showBrand: true,
    });
  });

  test('le viste di classe usano esclusivamente la denominazione della classe effettivamente fornita', () => {
    expect(resolveHeaderContext({ activeTab: 'tabellone', currentClassName: ' 2C ' }))
      .toEqual({ title: 'Tabellone', subtitle: 'Classe 2C', showBrand: false });
    expect(resolveHeaderContext({ activeTab: 'tabellone', currentClassName: '  ' }))
      .toEqual({ title: 'Tabellone', subtitle: null, showBrand: false });
    expect(resolveHeaderContext({ activeTab: 'biblioteca' }))
      .toEqual({ title: 'Biblioteca privata', subtitle: null, showBrand: false });
  });

  test('Modifica in corso compare solo su segnale verificato, non dalla scheda Valutazioni', () => {
    expect(resolveHeaderContext({ activeTab: 'voti', currentClassName: '2C' }).subtitle)
      .toBe('Classe 2C');
    expect(resolveHeaderContext({
      activeTab: 'voti',
      currentClassName: '2C',
      verifiedEditing: true,
    }).subtitle).toBe('Classe 2C · Modifica in corso');
    expect(resolveHeaderContext({
      activeTab: 'programmazione',
      verifiedEditing: true,
    }).subtitle).toBe('Modifica in corso');
  });

  test('nessuna mutazione dei dati di input e nessun effetto collaterale', () => {
    const input = Object.freeze({
      activeTab: 'programmazione' as const,
      currentClassName: '3E',
      verifiedEditing: false,
    });
    expect(resolveHeaderContext(input)).toEqual({
      title: 'Programmazione',
      subtitle: 'Classe 3E',
      showBrand: false,
    });
    expect(input.currentClassName).toBe('3E');
  });
});
