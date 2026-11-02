import type { ActiveTab } from '../types';

export type TodayAction = 'prepare' | 'conduct' | 'record' | 'review';
export type TodayContinuationAction = Exclude<TodayAction, 'prepare' | 'conduct'>;

export type TodayRouteDecision =
  | { status: 'needs-class'; action: TodayAction }
  | { status: 'class-entry'; action: TodayAction; classId: string; target: 'dashboard' };

export interface TodayContinuationOption {
  tab: ActiveTab;
  label: string;
}

const CONTINUATION_OPTIONS: Record<TodayContinuationAction, readonly TodayContinuationOption[]> = {
  record: [
    { tab: 'voti', label: 'Valutazioni' },
    { tab: 'comportamenti', label: 'Comportamento' }
  ],
  review: [
    { tab: 'tabellone', label: 'Tabellone' },
    { tab: 'analytics', label: 'Analisi' },
    { tab: 'storico', label: 'Storico' },
    { tab: 'report', label: 'Scheda alunno' }
  ]
};

export function resolveTodayRoute(
  action: TodayAction,
  currentClassId: string | null | undefined
): TodayRouteDecision {
  const classId = currentClassId?.trim();
  if (!classId) {
    return { status: 'needs-class', action };
  }

  return {
    status: 'class-entry',
    action,
    classId,
    target: 'dashboard'
  };
}

export function getTodayContinuationOptions(
  action: TodayContinuationAction
): readonly TodayContinuationOption[] {
  return CONTINUATION_OPTIONS[action];
}
