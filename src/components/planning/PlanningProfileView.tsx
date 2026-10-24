import React, { useState } from 'react';
import type { TeachingProfile } from '../../planning/types';
import { PlanningProfileEditor } from './PlanningProfileEditor';

interface PlanningProfileViewProps {
  profiles: TeachingProfile[];
  onSaveProfile: (profile: TeachingProfile) => Promise<void>;
}

export const PlanningProfileView: React.FC<PlanningProfileViewProps> = ({ profiles, onSaveProfile }) => {
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const selected = profiles.find(profile => profile.id === selectedId);

  return (
    <section className="max-w-5xl mx-auto space-y-5">
      {profiles.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-sm text-slate-300">Profilo salvato
            <select value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value || null)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2">
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.schoolYear} · {profile.subjectCode} · classe {profile.gradeLevel}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <PlanningProfileEditor profile={selected} onSave={onSaveProfile} />
      </div>
    </section>
  );
};
