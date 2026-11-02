import type { CopilotLaunchContext } from '../library/copilotLaunchContext';
import type { ActiveTab } from '../types';

export type PreparationIntent =
  | 'curriculum-frame'
  | 'uda-lesson'
  | 'material'
  | 'assessment'
  | 'copilot';

export type PreparationDestination =
  | { kind: 'tab'; tab: ActiveTab }
  | { kind: 'copilot'; intent: 'prepare' };

export interface PreparationOption {
  id: PreparationIntent;
  label: string;
  description: string;
  destination: PreparationDestination;
}

const PREPARATION_OPTIONS: readonly PreparationOption[] = [
  {
    id: 'curriculum-frame',
    label: 'Definisci la cornice',
    description: 'Programmazione e riferimenti professionali.',
    destination: { kind: 'tab', tab: 'programmazione' }
  },
  {
    id: 'uda-lesson',
    label: 'Sviluppa UDA o lezione',
    description: 'Organizza il percorso e le attività.',
    destination: { kind: 'tab', tab: 'uda-gantt' }
  },
  {
    id: 'material',
    label: 'Trova o usa un materiale',
    description: 'Apri la Biblioteca nel contesto della classe.',
    destination: { kind: 'tab', tab: 'biblioteca' }
  },
  {
    id: 'assessment',
    label: 'Prepara una verifica',
    description: 'Costruisci o gestisci una verifica online.',
    destination: { kind: 'tab', tab: 'verifiche-online' }
  },
  {
    id: 'copilot',
    label: 'Chiedi supporto',
    description: 'Apri il Copilota con il contesto già noto.',
    destination: { kind: 'copilot', intent: 'prepare' }
  }
];

export function getPreparationOptions(): readonly PreparationOption[] {
  return PREPARATION_OPTIONS;
}

export function buildPreparationCopilotLaunchContext(
  currentClass: { name: string } | null | undefined
): CopilotLaunchContext | null {
  const className = currentClass?.name.trim();
  if (!className) return null;

  return {
    surface: 'class-dashboard',
    className,
    intent: 'prepare'
  };
}
