import React, { useState } from 'react';
import type {
  ArenaPlanningContext,
  ArenaPlanningContextPreview,
  PlanningState,
  TeachingProfile
} from '../../planning/types';
import type { ClassData } from '../../types';
import { ArenaPlanningContextPanel } from './ArenaPlanningContextPanel';
import { DocenteOsProjectionPanel } from './DocenteOsProjectionPanel';
import { PlanningProfileEditor } from './PlanningProfileEditor';

interface PlanningProfileViewProps {
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  planning: PlanningState;
  classes: ClassData[];
  onSaveProfile: (profile: TeachingProfile) => Promise<void>;
  onAcceptArenaContext: (context: ArenaPlanningContextPreview) => Promise<void>;
  onAcceptDocenteOsProjection: (payload: unknown) => Promise<PlanningState>;
}

export const PlanningProfileView: React.FC<PlanningProfileViewProps> = ({
  profiles,
  arenaContexts,
  planning,
  classes,
  onSaveProfile,
  onAcceptArenaContext,
  onAcceptDocenteOsProjection
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const resolvedSelectedId = selectedId && profiles.some(profile => profile.id === selectedId)
    ? selectedId
    : profiles[0]?.id ?? null;
  const selected = profiles.find(profile => profile.id === resolvedSelectedId);

  return (
    <section className="max-w-5xl mx-auto space-y-5">
      {profiles.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-sm text-slate-300">Profilo salvato
            <select value={resolvedSelectedId ?? ''} onChange={event => setSelectedId(event.target.value || null)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2">
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.schoolYear} · {profile.subjectCode} · classe {profile.gradeLevel}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <PlanningProfileEditor profile={selected} onSave={onSaveProfile} />
      </div>
      {selected && (
        <ArenaPlanningContextPanel
          profile={selected}
          acceptedContexts={arenaContexts}
          onAccept={onAcceptArenaContext}
        />
      )}
      <DocenteOsProjectionPanel
        planning={planning}
        classes={classes}
        onAccept={onAcceptDocenteOsProjection}
      />
    </section>
  );
};
