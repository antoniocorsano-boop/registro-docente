import {
  createActionRegistry,
  createContextualCopilotCore,
  createFailClosedPolicyEngine,
  type ContextSnapshot,
  type ContextualAction,
  type ResolvedAction
} from '@trama/contextual-copilot-core';
import type { LibrarySource } from './types';

const LIBRARY_CONTEXT_ACTIONS: ContextualAction[] = [
  {
    id: 'review-source',
    capability: 'REVIEW',
    label: 'Rivedi nel contesto',
    priority: 100,
    risk: 'PROPOSE',
    requiresGenerativeAI: false,
    requiresSemanticSearch: false
  },
  {
    id: 'link-source-to-uda',
    capability: 'LINK',
    label: 'Collega a una UDA',
    priority: 90,
    risk: 'WRITE_REVERSIBLE',
    requiresGenerativeAI: false,
    requiresSemanticSearch: false
  },
  {
    id: 'prepare-from-source',
    capability: 'PREPARE',
    label: 'Prepara materiale',
    priority: 80,
    risk: 'PROPOSE',
    requiresGenerativeAI: true,
    requiresSemanticSearch: false
  },
  {
    id: 'summarize-source',
    capability: 'SUMMARIZE',
    label: 'Sintetizza la fonte',
    priority: 70,
    risk: 'PROPOSE',
    requiresGenerativeAI: true,
    requiresSemanticSearch: false
  }
];

const actionRegistry = createActionRegistry(LIBRARY_CONTEXT_ACTIONS);
const policyEngine = createFailClosedPolicyEngine({ generativeMode: 'none' });
const libraryContextualCore = createContextualCopilotCore({
  registry: actionRegistry,
  policyEngine,
  generativeMode: 'none'
});

function libraryDataClasses(source: LibrarySource): ContextSnapshot['privacy']['dataClasses'] {
  if (source.privacy === 'teacher-professional') return ['TEACHER_PROFESSIONAL'];
  return ['STUDENT_PERSONAL'];
}

export function buildLibraryContextSnapshot(source: LibrarySource): ContextSnapshot {
  return {
    appId: 'registro-docente',
    surface: 'LIBRARY_SOURCE',
    entities: [
      {
        type: 'library-source',
        id: source.id,
        kind: source.kind,
        status: source.status,
        privacy: source.privacy,
        linkCount: source.links.length
      }
    ],
    capabilities: ['REVIEW', 'LINK', 'PREPARE', 'SUMMARIZE'],
    permissions: ['library:read', 'library:propose', 'library:link'],
    privacy: {
      dataClasses: libraryDataClasses(source),
      remoteProviderAllowed: false
    },
    state: source.status
  };
}

export function resolveLibraryContextActions(source: LibrarySource): Promise<readonly ResolvedAction[]> {
  return libraryContextualCore.resolveActions(buildLibraryContextSnapshot(source));
}

export interface DispatchLibraryContextActionInput<TOutput> {
  source: LibrarySource;
  actionId: string;
  humanConfirmed?: boolean;
  executor: () => TOutput | Promise<TOutput>;
}

export function dispatchLibraryContextAction<TOutput>({
  source,
  actionId,
  humanConfirmed = false,
  executor
}: DispatchLibraryContextActionInput<TOutput>) {
  return libraryContextualCore.dispatch({
    context: buildLibraryContextSnapshot(source),
    actionId,
    humanConfirmed,
    executor: () => executor()
  });
}
