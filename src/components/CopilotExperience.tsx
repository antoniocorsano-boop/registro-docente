import React, { useMemo } from 'react';
import type { AppSettings, UdaRecord } from '../types';
import type { PlanningStateV1 } from '../planning/types';
import type { LibraryStateV1 } from '../library/types';
import type { CopilotStateV1 } from '../copilot/state';
import { buildCopilotContextProjection } from '../copilot/contextProjection';
import { normalizeCopilotProactivity } from '../copilot/proactivity';
import { copilotPreferenceFactor } from '../copilot/preferenceLearning';
import {
  resolveCopilotOpportunities,
  type CopilotOpportunityV1
} from '../copilot/opportunityResolver';
import {
  buildCopilotMissionPreview,
  type CopilotMissionPreviewV1,
  type CopilotMissionV1,
  type MissionResumeDecision
} from '../copilot/mission';
import type { CopilotLaunchContext } from '../library/copilotLaunchContext';
import { CopilotDeck } from './CopilotDeck';

interface CopilotExperienceProps {
  settings: AppSettings;
  copilotState: CopilotStateV1;
  library: LibraryStateV1;
  udas: UdaRecord[];
  planning: PlanningStateV1;
  ambientContext: CopilotLaunchContext;
  onPutAside: (opportunity: CopilotOpportunityV1, contextFingerprint: string) => Promise<void>;
  onIgnore: (opportunity: CopilotOpportunityV1, contextFingerprint: string) => Promise<void>;
  onResume: (mission: CopilotMissionV1) => Promise<MissionResumeDecision>;
  onOpenConversation: () => void;
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

  const resolvePreview = (opportunity: CopilotOpportunityV1): CopilotMissionPreviewV1 | null => {
    const uda = udas.find(candidate => candidate.id === opportunity.contextRef.udaId);
    if (!uda) return null;
    const sources = library.sources.filter(source => opportunity.proposedMission.sourceRefs.includes(source.id));
    if (sources.length !== opportunity.proposedMission.sourceRefs.length) return null;

    return buildCopilotMissionPreview(opportunity, {
      context: buildCopilotContextProjection({
        surface: projection.surface,
        className: opportunity.contextRef.className,
        udaId: opportunity.contextRef.udaId,
        lessonId: opportunity.contextRef.lessonId,
        sourceId: opportunity.contextRef.sourceId
      }),
      uda,
      sources,
      planningProfileId: projection.planningProfileId,
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
      onPutAside={opportunity => onPutAside(opportunity, contextFingerprint)}
      onIgnore={opportunity => onIgnore(opportunity, contextFingerprint)}
      onResume={onResume}
      onOpenConversation={onOpenConversation}
      {...(onStart ? {
        onStart: (opportunity: CopilotOpportunityV1, preview: CopilotMissionPreviewV1) => (
          onStart(opportunity, preview, contextFingerprint)
        )
      } : {})}
    />
  );
};
