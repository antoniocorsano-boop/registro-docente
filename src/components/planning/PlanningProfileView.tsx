import React, { useState } from 'react';
import type {
  ArenaPlanningContext,
  ArenaPlanningContextPreview,
  TeachingProfile
} from '../../planning/types';
import { resolveClassGradeLevel, type PlanningFrameResolution } from '../../planning/planningFrameResolver';
import type { ResolvedLibraryTeachingContext } from '../../library/teachingContext';
import { DidacticContinuityBar } from '../DidacticContinuityBar';
import { ArenaPlanningContextPanel } from './ArenaPlanningContextPanel';
import { PlanningProfileEditor } from './PlanningProfileEditor';

interface PlanningProfileViewProps {
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  onSaveProfile: (profile: TeachingProfile) => Promise<void>;
  onAcceptArenaContext: (context: ArenaPlanningContextPreview) => Promise<void>;
  currentClassName?: string | null;
  planningFrame?: PlanningFrameResolution | null;
  focusedProfileId?: string | null;
  teachingContext?: ResolvedLibraryTeachingContext | null;
  udaTitle?: string | null;
  lessonTitle?: string | null;
  onOpenUda?: () => void;
  defaultSubjectCode?: string;
}

export const PlanningProfileView: React.FC<PlanningProfileViewProps> = ({
  profiles,
  arenaContexts,
  onSaveProfile,
  onAcceptArenaContext,
  currentClassName = null,
  planningFrame = null,
  focusedProfileId = null,
  teachingContext = null,
  udaTitle = null,
  lessonTitle = null,
  onOpenUda,
  defaultSubjectCode = 'tecnologia'
}) => {
  const hasClassContext = Boolean(currentClassName?.trim());
  // Manual choice is scoped to the current class/frame; it never updates the class itself.
  const [manualChoice, setManualChoice] = useState<{ scope: string; id: string } | null>(null);
  const scope = `${currentClassName ?? 'standalone'}:${focusedProfileId ?? 'unresolved'}`;
  const validFocusedId = focusedProfileId && profiles.some(p => p.id === focusedProfileId)
    ? focusedProfileId
    : null;
  const manualId = manualChoice?.scope === scope && profiles.some(p => p.id === manualChoice.id)
    ? manualChoice.id
    : null;
  const resolvedSelectedId = manualId ?? (hasClassContext ? validFocusedId : profiles[0]?.id ?? null);
  const selected = profiles.find(profile => profile.id === resolvedSelectedId);

  return (
    <section className="max-w-5xl mx-auto space-y-5">
      {hasClassContext && onOpenUda && (
        <DidacticContinuityBar
          className={currentClassName!}
          planningFrame={planningFrame}
          teachingContext={teachingContext}
          udaTitle={udaTitle}
          lessonTitle={lessonTitle}
          destination="uda-gantt"
          onNavigate={onOpenUda}
        />
      )}
      {profiles.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-sm text-slate-300">Profilo salvato
            <select
              value={resolvedSelectedId ?? ''}
              onChange={event => setManualChoice({ scope, id: event.target.value })}
              className="mt-1 min-h-[44px] w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              {hasClassContext && !resolvedSelectedId && (
                <option value="">Scegli un profilo: la classe non ha una cornice univoca</option>
              )}
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.schoolYear} · {profile.subjectCode} · classe {profile.gradeLevel}
                </option>
              ))}
            </select>
          </label>
          {hasClassContext && selected && selected.id !== validFocusedId && (
            <p className="mt-2 text-xs text-amber-200">
              Stai consultando manualmente un profilo diverso dalla cornice della classe selezionata.
              Questa scelta non cambia la classe o l'UDA attiva.
            </p>
          )}
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <PlanningProfileEditor
          key={selected?.id ?? `${scope}:${defaultSubjectCode}`}
          profile={selected}
          onSave={onSaveProfile}
          defaultSubjectCode={defaultSubjectCode}
          defaultGradeLevel={resolveClassGradeLevel(currentClassName ?? '') ?? 1}
        />
      </div>
      {selected && (
        <ArenaPlanningContextPanel
          profile={selected}
          acceptedContexts={arenaContexts}
          onAccept={onAcceptArenaContext}
        />
      )}
    </section>
  );
};
