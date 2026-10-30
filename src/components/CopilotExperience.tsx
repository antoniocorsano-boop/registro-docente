import React, { useMemo } from 'react';
import type { AppSettings, UdaRecord } from '../types';
import type { PlanningState } from '../planning/types';
import type { LibraryStateV1 } from '../library/types';
import type { CopilotStateV1 } from '../copilot/state';
import { buildCopilotContextProjection } from '../copilot/contextProjection';
import { normalizeCopilotProactivity } from '../copilot/proactivity';
import { copilotPreferenceFactor } from '../copilot/preferenceLearning';
import {
  buildCopilotOpportunityDismissalFingerprint,
  resolveCopilotOpportunities,
  type CopilotOpportunityV1
} from '../copilot/opportunityResolver';
import {
  buildCopilotMissionPreview,
  buildMissionContextFingerprint,
  type CopilotMissionPreviewV1,
  type CopilotMissionV1,
  type MissionResumeDecision
} from '../copilot/mission';
import type { CopilotLaunchContext } from '../library/copilotLaunchContext';
import { resolvePlanningContextForLibraryRelevance } from '../library/relevancePresentation';
import { resolveLibraryTeachingContext } from '../library/teachingContext';
import { CopilotDeck } from './CopilotDeck';

type CopilotSurfaceMode = 'closed' | 'home' | 'compose';

interface CopilotExperienceProps {
  settings: AppSettings;
  copilotState: CopilotStateV1;
  library: LibraryStateV1;
  udas: UdaRecord[];
  planning: PlanningState;
  ambientContext: CopilotLaunchContext;
  onPutAside: (opportunity: CopilotOpportunityV1, contextFingerprint: string) => Promise<void>;
  onIgnore: (opportunity: CopilotOpportunityV1, contextFingerprint: string) => Promise<void>;
  onResume: (mission: CopilotMissionV1) => Promise<MissionResumeDecision>;
  onOpenConversation: () => void;
  surfaceMode: CopilotSurfaceMode;
  onSurfaceModeChange: (mode: CopilotSurfaceMode) => void;
  onStart?: (opportunity: CopilotOpportunityV1, preview: CopilotMissionPreviewV1, contextFingerprint: string) => Promise<void>;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CopilotExperience: React.FC<CopilotExperienceProps> = ({
  settings,
  copilotState,
  library,
  udas,
  planning,
  ambientContext,
  onPutAside,
  onIgnore,
  onResume,
  onOpenConversation,
  surfaceMode,
  onSurfaceModeChange,
  onStart
}) => {
  const projection = useMemo(() => buildCopilotContextProjection({
    surface: ambientContext.surface,
    className: ambientContext.className,
    udaId: ambientContext.udaId,
    lessonId: ambientContext.lessonId,
    sourceId: ambientContext.sourceId
  }), [ambientContext]);

  const contextFingerprint = useMemo(() => JSON.stringify(projection), [projection]);
  const now = new Date().toISOString();

  const opportunities = useMemo(() => resolveCopilotOpportunities({
    profile: normalizeCopilotProactivity(settings.copilotProactivity),
    now,
    today: localDateKey(),
    context: projection,
    udas,
    library,
    planning,
    preferenceFactor: kind => copilotPreferenceFactor(copilotState.preferences, kind, now),
    dismissed: copilotState.dismissals,
    deferred: copilotState.deferred,
    missions: copilotState.missions.map(mission => ({
      id: mission.id,
      opportunityId: mission.opportunityId,
      status: mission.status,
      contextRef: mission.contextRef
    })),
    contextFingerprint
  }), [settings.copilotProactivity, projection, udas, library, planning, copilotState, now, contextFingerprint]);

  const resolveMissionInputs = (opportunity: CopilotOpportunityV1) => {
    const uda = udas.find(candidate => candidate.id === opportunity.contextRef.udaId);
    if (!uda) return null;
    const sources = library.sources.filter(source => opportunity.proposedMission.sourceRefs.includes(source.id));
    if (sources.length !== opportunity.proposedMission.sourceRefs.length) return null;
    const teachingContext = resolveLibraryTeachingContext(udas, {
      udaId: opportunity.contextRef.udaId,
      ...(opportunity.contextRef.lessonId ? { lessonId: opportunity.contextRef.lessonId } : {})
    });
    if (!teachingContext || teachingContext.className !== opportunity.contextRef.className) return null;
    const planningContext = resolvePlanningContextForLibraryRelevance(teachingContext, planning);
    const currentPlanningProfileId = planningContext?.status === 'resolved'
      ? planningContext.profile.id
      : null;
    const context = buildCopilotContextProjection({
      surface: 'library',
      className: opportunity.contextRef.className,
      udaId: opportunity.contextRef.udaId,
      lessonId: opportunity.contextRef.lessonId,
      sourceId: opportunity.contextRef.sourceId,
      planningProfileId: currentPlanningProfileId
    });
    return { uda, sources, context, currentPlanningProfileId };
  };

  const resolvePreview = (opportunity: CopilotOpportunityV1): CopilotMissionPreviewV1 | null => {
    const inputs = resolveMissionInputs(opportunity);
    if (!inputs) return null;
    return buildCopilotMissionPreview(opportunity, {
      context: inputs.context,
      uda: inputs.uda,
      sources: inputs.sources,
      planningProfileId: inputs.currentPlanningProfileId,
      missionSettings: {
        aiBudgetProfile: settings.aiBudgetProfile ?? 'balanced',
        copilotProactivity: normalizeCopilotProactivity(settings.copilotProactivity)
      }
    });
  };

  const resolveMissionFingerprint = (opportunity: CopilotOpportunityV1): string => {
    const inputs = resolveMissionInputs(opportunity);
    if (!inputs) return '';
    return buildMissionContextFingerprint({
      context: inputs.context,
      uda: inputs.uda,
      sources: inputs.sources,
      planningProfileId: inputs.currentPlanningProfileId,
      missionSettings: {
        aiBudgetProfile: settings.aiBudgetProfile ?? 'balanced',
        copilotProactivity: normalizeCopilotProactivity(settings.copilotProactivity)
      }
    });
  };

  return (
    <CopilotDeck
      opportunities={opportunities}
      missions={copilotState.missions}
      resolvePreview={resolvePreview}
      resolveMaterialFingerprint={resolveMissionFingerprint}
      onPutAside={opportunity => onPutAside(opportunity, buildCopilotOpportunityDismissalFingerprint({
        opportunity, context: projection, udas, library
      }))}
      onIgnore={opportunity => onIgnore(opportunity, buildCopilotOpportunityDismissalFingerprint({
        opportunity, context: projection, udas, library
      }))}
      onResume={onResume}
      onOpenConversation={onOpenConversation}
      surfaceMode={surfaceMode}
      onSurfaceModeChange={onSurfaceModeChange}
      {...(onStart ? {
        onStart: (
          opportunity: CopilotOpportunityV1,
          preview: CopilotMissionPreviewV1,
          materialFingerprint: string
        ) => onStart(opportunity, preview, materialFingerprint)
      } : {})}
    />
  );
};
