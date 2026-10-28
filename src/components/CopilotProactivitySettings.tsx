import React, { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import type { AppSettings } from '../types';
import {
  normalizeCopilotProactivity,
  type CopilotProactivityProfile
} from '../copilot/proactivity';

interface CopilotProactivitySettingsProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onResetCopilotPreferences: () => Promise<void>;
}

const PROFILES: Array<{
  id: CopilotProactivityProfile;
  label: string;
  description: string;
}> = [
  {
    id: 'essential',
    label: 'Essenziale',
    description: 'Mostra solo opportunità molto rilevanti e vicine al lavoro corrente.'
  },
  {
    id: 'balanced',
    label: 'Equilibrato',
    description: 'Combina poche opportunità contestuali e della giornata. È il profilo predefinito.'
  },
  {
    id: 'present',
    label: 'Presente',
    description: 'Propone più spesso possibilità utili, mantenendo sempre il Play del docente.'
  }
];

export const CopilotProactivitySettings: React.FC<CopilotProactivitySettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetCopilotPreferences
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = normalizeCopilotProactivity(settings.copilotProactivity);

  const updateProfile = async (profile: CopilotProactivityProfile) => {
    if (isSaving || profile === selected) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdateSettings({ copilotProactivity: profile });
    } catch {
      setError('La preferenza di proattività non è stata salvata.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetPreferences = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setError(null);
    try {
      await onResetCopilotPreferences();
    } catch {
      setError('Le preferenze apprese del Copilota non sono state reimpostate.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section aria-labelledby="copilot-proactivity-title" className="neon-card p-5 space-y-4">
      <div>
        <h3 id="copilot-proactivity-title" className="flex items-center gap-2 text-base font-bold text-slate-100">
          <Sparkles className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          Proattività del Copilota
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Regola quanto spesso il Copilota propone opportunità. Non modifica l’autorità del Copilota né l’Uso delle risorse IA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Proattività del Copilota">
        {PROFILES.map(profile => {
          const active = selected === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isSaving}
              onClick={() => void updateProfile(profile.id)}
              className={`min-h-[44px] rounded-xl border px-3 py-3 text-left transition ${active ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}
            >
              <strong className="block text-sm text-slate-100">{profile.label}</strong>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">{profile.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => void resetPreferences()}
          disabled={isResetting}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-600 disabled:opacity-50"
        >
          <RotateCcw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Reimposta preferenze del Copilota
        </button>
        <span className="text-xs text-slate-500">Biblioteca, Memoria professionale, UDA e Registro non vengono cancellati.</span>
      </div>

      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    </section>
  );
};
