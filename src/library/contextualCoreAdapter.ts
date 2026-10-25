import {
  createActionRegistry,
  createContextualCopilotCore,
  createFailClosedPolicyEngine,
  type CapabilityId,
  type ContextEntity,
  type ContextSnapshot,
  type ContextualAction,
  type CopilotRequest,
  type CopilotRequestResolution,
  type ResolvedAction
} from '@trama/contextual-copilot-core';
import type { LibraryPlanningContextResolution } from './planningContextBridge';
import type { LibrarySource } from './types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

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
    label: 'Prepara attività',
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

const LIBRARY_COPILOT_ALLOWED_CAPABILITIES: readonly CapabilityId[] = Object.freeze([
  'REVIEW',
  'LINK',
  'PREPARE',
  'SUMMARIZE'
]);

const actionRegistry = createActionRegistry(LIBRARY_CONTEXT_ACTIONS);
const policyEngine = createFailClosedPolicyEngine({ generativeMode: 'none' });
const libraryContextualCore = createContextualCopilotCore({
  registry: actionRegistry,
  policyEngine,
  generativeMode: 'none'
});

const remoteProposalActionRegistry = createActionRegistry(
  LIBRARY_CONTEXT_ACTIONS.filter(action => action.id !== 'summarize-source')
);
const remoteProposalPolicyEngine = createFailClosedPolicyEngine({ generativeMode: 'remote' });
const libraryRemoteProposalCore = createContextualCopilotCore({
  registry: remoteProposalActionRegistry,
  policyEngine: remoteProposalPolicyEngine,
  generativeMode: 'remote'
});

function libraryDataClasses(
  source: LibrarySource,
  teachingContext: ResolvedLibraryTeachingContext | null,
  planningContext: LibraryPlanningContextResolution | null = null
): ContextSnapshot['privacy']['dataClasses'] {
  const sourceClass = source.privacy === 'teacher-professional'
    ? 'TEACHER_PROFESSIONAL'
    : 'STUDENT_PERSONAL';

  return teachingContext || planningContext?.status === 'resolved'
    ? [sourceClass, 'CURRICOLO']
    : [sourceClass];
}

export function buildLibraryContextSnapshot(
  source: LibrarySource,
  teachingContext: ResolvedLibraryTeachingContext | null = null,
  planningContext: LibraryPlanningContextResolution | null = null
): ContextSnapshot {
  const entities: ContextEntity[] = [
    {
      type: 'library-source',
      id: source.id,
      kind: source.kind,
      status: source.status,
      privacy: source.privacy,
      linkCount: source.links.length
    }
  ];

  if (teachingContext) {
    entities.push({
      type: 'uda',
      id: teachingContext.udaId,
      className: teachingContext.className,
      period: teachingContext.period
    });

    if (teachingContext.lessonId) {
      entities.push({
        type: 'lesson',
        id: teachingContext.lessonId,
        udaId: teachingContext.udaId,
        ...(teachingContext.activityType ? { activityType: teachingContext.activityType } : {})
      });
    }
  }

  if (planningContext?.status === 'resolved') {
    entities.push({
      type: 'planning-profile',
      id: planningContext.profile.id,
      schoolYear: planningContext.profile.schoolYear,
      subjectCode: planningContext.profile.subjectCode,
      gradeLevel: planningContext.profile.gradeLevel,
      ...(planningContext.arenaContext
        ? { arenaContextId: planningContext.arenaContext.id }
        : {})
    });
  }

  return {
    appId: 'registro-docente',
    surface: teachingContext ? 'LIBRARY_SOURCE_TEACHING_CONTEXT' : 'LIBRARY_SOURCE',
    entities,
    capabilities: ['REVIEW', 'LINK', 'PREPARE', 'SUMMARIZE'],
    permissions: ['library:read', 'library:propose', 'library:link'],
    privacy: {
      dataClasses: libraryDataClasses(source, teachingContext, planningContext),
      remoteProviderAllowed: false
    },
    state: source.status
  };
}

export interface LibraryCopilotRequestInput {
  source: LibrarySource;
  teachingContext?: ResolvedLibraryTeachingContext | null;
  planningContext?: LibraryPlanningContextResolution | null;
  message: string;
}

export function buildLibraryCopilotRequest({
  source,
  teachingContext = null,
  planningContext = null,
  message
}: LibraryCopilotRequestInput): CopilotRequest {
  return {
    context: buildLibraryContextSnapshot(source, teachingContext, planningContext),
    message,
    allowedCapabilities: LIBRARY_COPILOT_ALLOWED_CAPABILITIES
  };
}

export function resolveLibraryCopilotRequest(
  input: LibraryCopilotRequestInput
): Promise<CopilotRequestResolution> {
  return libraryContextualCore.resolveRequest(buildLibraryCopilotRequest(input));
}

export function buildLibraryRemoteProposalSnapshot(
  source: LibrarySource,
  teachingContext: ResolvedLibraryTeachingContext,
  explicitRemoteOptIn: boolean
): ContextSnapshot {
  const base = buildLibraryContextSnapshot(source, teachingContext);
  return {
    ...base,
    privacy: {
      ...base.privacy,
      remoteProviderAllowed: source.privacy === 'teacher-professional' && explicitRemoteOptIn
    }
  };
}

export function resolveLibraryContextActions(
  source: LibrarySource,
  teachingContext: ResolvedLibraryTeachingContext | null = null
): Promise<readonly ResolvedAction[]> {
  return libraryContextualCore.resolveActions(buildLibraryContextSnapshot(source, teachingContext));
}

export function resolveLibraryRemoteProposalActions(
  source: LibrarySource,
  teachingContext: ResolvedLibraryTeachingContext,
  explicitRemoteOptIn: boolean
): Promise<readonly ResolvedAction[]> {
  return libraryRemoteProposalCore.resolveActions(
    buildLibraryRemoteProposalSnapshot(source, teachingContext, explicitRemoteOptIn)
  );
}

export interface DispatchLibraryContextActionInput<TOutput> {
  source: LibrarySource;
  teachingContext?: ResolvedLibraryTeachingContext | null;
  actionId: string;
  humanConfirmed?: boolean;
  executor: () => TOutput | Promise<TOutput>;
}

export function dispatchLibraryContextAction<TOutput>({
  source,
  teachingContext = null,
  actionId,
  humanConfirmed = false,
  executor
}: DispatchLibraryContextActionInput<TOutput>) {
  return libraryContextualCore.dispatch({
    context: buildLibraryContextSnapshot(source, teachingContext),
    actionId,
    humanConfirmed,
    executor: () => executor()
  });
}
