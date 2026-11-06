import type { ActiveTab } from '../types';

/**
 * HEADER-01 — Presentational view context only.
 *
 * The real authority for the current class and editing lifecycle stays in App
 * and in the professional navigation/session contracts. This module deliberately
 * does not read storage, navigate, mutate state or infer edits from the route.
 */
export interface HeaderContext {
  title: string;
  subtitle: string | null;
  showBrand: boolean;
}

export interface HeaderContextInput {
  activeTab: ActiveTab;
  currentClassName?: string | null;
  /** Must come from an authoritative editor state, never inferred from a tab. */
  verifiedEditing?: boolean;
}

const titles: Record<ActiveTab, string> = {
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

export function resolveHeaderContext({
  activeTab,
  currentClassName,
  verifiedEditing = false,
}: HeaderContextInput): HeaderContext {
  if (activeTab === 'home') {
    // Home is context-neutral even if a stale class was provided by the caller.
    return { title: titles.home, subtitle: 'Oggi', showBrand: true };
  }

  const className = currentClassName?.trim() ?? '';
  const classLabel = className ? `Classe ${className}` : null;
  const subtitle = verifiedEditing
    ? [classLabel, 'Modifica in corso'].filter(Boolean).join(' · ')
    : classLabel;

  return {
    title: titles[activeTab],
    subtitle,
    showBrand: false,
  };
}
