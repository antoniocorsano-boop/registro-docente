import React, { useCallback, useRef, useState } from 'react';
import type { PlanningDraftGuard } from './PlanningProfileEditor';
import type {
  ArenaPlanningContext,
  ArenaPlanningContextPreview,
  PlanningState,
  TeachingProfile
} from '../../planning/types';
import { resolveClassGradeLevel, type PlanningFrameResolution } from '../../planning/planningFrameResolver';
import type { ResolvedLibraryTeachingContext } from '../../library/teachingContext';
import { DidacticContinuityBar } from '../DidacticContinuityBar';
import type { ClassData } from '../../types';
import { ArenaPlanningContextPanel } from './ArenaPlanningContextPanel';
import { DocenteOsProjectionPanel } from './DocenteOsProjectionPanel';
import { PlanningProfileEditor } from './PlanningProfileEditor';

interface PlanningProfileViewProps {
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  planning: PlanningState;
  classes: ClassData[];
  onAcceptDocenteOsProjection: (payload: unknown) => Promise<PlanningState>;
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
  subjectDisplayLabel?: string;
  onRegisterDraftGuard?: (guard: PlanningDraftGuard | null) => void;
}

export const PlanningProfileView: React.FC<PlanningProfileViewProps> = ({
  profiles,
  arenaContexts,
  planning,
  classes,
  onAcceptDocenteOsProjection,
  onSaveProfile,
  onAcceptArenaContext,
  currentClassName = null,
  planningFrame = null,
  focusedProfileId = null,
  teachingContext = null,
  udaTitle = null,
  lessonTitle = null,
  onOpenUda,
  defaultSubjectCode = 'tecnologia',
  subjectDisplayLabel = '',
  onRegisterDraftGuard
}) => {
  const hasClassContext = Boolean(currentClassName?.trim());
  // Manual choice is scoped to the current class/frame; it never updates the class itself.
  const [manualChoice, setManualChoice] = useState<{ scope: string; id: string } | null>(null);
  const scope = `${currentClassName ?? 'standalone'}:${focusedProfileId ?? 'unresolved'}`;
  const validFocusedId = focusedProfileId && profiles.some(p => p.id === focusedProfileId)
    ? focusedProfileId
    : null;
  const manualId = planningFrame?.status !== 'resolved'
    && manualChoice?.scope === scope && profiles.some(p => p.id === manualChoice.id)
      ? manualChoice.id : null;
  const resolvedSelectedId = manualId ?? (hasClassContext ? validFocusedId : profiles[0]?.id ?? null);
  const editorGuardRef = useRef<PlanningDraftGuard | null>(null);
  // Arena can become ambiguous while an editor is dirty. Keep its same-class
  // source profile mounted until an explicit save or discard, never reassign it.
  const retainedProfileRef = useRef<{ className: string | null; id: string } | null>(null);
  const isDirty = editorGuardRef.current?.hasUnsavedChanges() ?? false;
  const retainedId = isDirty && retainedProfileRef.current?.className === currentClassName
    ? retainedProfileRef.current.id : null;
  const selectedId = resolvedSelectedId ?? retainedId;
  const selected = profiles.find(profile => profile.id === selectedId);
  if (selected && !isDirty) {
    retainedProfileRef.current = { className: currentClassName, id: selected.id };
  }
  const [selectionWarning, setSelectionWarning] = useState('');
  const registerEditorGuard = useCallback((guard: PlanningDraftGuard | null) => {
    editorGuardRef.current = guard;
    onRegisterDraftGuard?.(guard);
  }, [onRegisterDraftGuard]);
  const chooseProfile = (id: string) => {
    if (editorGuardRef.current?.hasUnsavedChanges()) {
      setSelectionWarning('Salva le modifiche prima di passare a un altro profilo.');
      return;
    }
    setSelectionWarning('');
    setManualChoice({ scope, id });
  };
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [mobileArenaOpen, setMobileArenaOpen] = useState(false);
  const resolvedFrame = planningFrame?.status === 'resolved' ? planningFrame : null;
  // Keep the mounted editor and its unsaved draft even when visually collapsed.
  const mobileDetailsVisible = mobileDetailsOpen || !hasClassContext || !selected
    || planningFrame?.status !== 'resolved';

  return (
    <section className="max-w-5xl mx-auto space-y-5">
      {hasClassContext && (
        <section aria-label="Programmazione corrente" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Programmazione didattica</p>
            <h2 className="mt-1 text-xl font-bold text-white">Classe {currentClassName}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {subjectDisplayLabel.trim() || resolvedFrame?.profile.subjectCode || defaultSubjectCode}
              {resolvedFrame ? ` · ${resolvedFrame.profile.schoolYear}` : ''}
            </p>
          </div>
          <div role="status" aria-label="Stato della programmazione" className="text-sm font-semibold">
            <span className={resolvedFrame ? 'text-emerald-200' : 'text-amber-200'}>
              {resolvedFrame ? 'Programmazione disponibile'
                : planningFrame?.status === 'ambiguous' ? 'Cornice della classe da chiarire'
                : planningFrame?.status === 'unavailable' && planningFrame.reason === 'PLANNING_PROFILE_NOT_FOUND'
                  ? 'Programmazione da configurare' : 'Programmazione da verificare'}
            </span>
          </div>
          {teachingContext && (
            <p className="text-sm text-slate-300">
              UDA: {udaTitle?.trim() || 'selezionata'}
              {teachingContext.lessonId ? ` · Lezione: ${lessonTitle?.trim() || 'selezionata'}` : ''}
              {teachingContext.writableByRegistro === false ? ' · Docente OS (sola lettura)' : ''}
            </p>
          )}
          {onOpenUda && (
            <button type="button" onClick={onOpenUda}
              className="min-h-[44px] w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
              Apri UDA
            </button>
          )}
        </section>
      )}
      {hasClassContext && onOpenUda && (
        <div className="hidden sm:block">
          <DidacticContinuityBar
          className={currentClassName!}
          planningFrame={planningFrame}
          teachingContext={teachingContext}
          udaTitle={udaTitle}
          lessonTitle={lessonTitle}
          destination="uda-gantt"
          onNavigate={onOpenUda}
          />
        </div>
      )}
      {hasClassContext && (
        <div role="status" aria-label="Stato della programmazione" className="hidden rounded-lg sm:block border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
          {planningFrame?.status === 'resolved' ? (
            <>
              <p className="font-semibold text-emerald-200">Programmazione disponibile</p>
              <p className="mt-1">Il profilo della classe è utilizzabile e può essere aggiornato quando necessario.</p>
              {planningFrame.arenaContext ? (
                <p className="mt-2 text-emerald-200">Curricolo Arena collegato · approvato e vigente · sola lettura</p>
              ) : (
                <p className="mt-2 text-slate-300">Curricolo Arena da collegare (facoltativo). La Programmazione rimane utilizzabile.</p>
              )}
            </>
          ) : planningFrame?.status === 'ambiguous' ? (
            <>
              <p className="font-semibold text-amber-200">Cornice della classe da chiarire</p>
              <p className="mt-1">Sono presenti riferimenti non univoci. Scegli consapevolmente il profilo corretto, senza collegamenti automatici.</p>
            </>
          ) : planningFrame?.status === 'unavailable' && planningFrame.reason === 'PLANNING_PROFILE_NOT_FOUND' ? (
            <>
              <p className="font-semibold text-amber-200">Programmazione da configurare</p>
              <p className="mt-1">Non è ancora disponibile un profilo coerente per questa classe.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-200">Programmazione da verificare</p>
              <p className="mt-1">Verifica i dati della classe prima di definire la cornice annuale.</p>
            </>
          )}
        </div>
      )}
      {hasClassContext && selected && planningFrame?.status === 'resolved' && (
        <button type="button" aria-expanded={mobileDetailsVisible}
          aria-controls="int01-planning-details"
          onClick={() => setMobileDetailsOpen(open => !open)}
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-white sm:hidden">
          <span>Dettagli e modifica</span>
          <span aria-hidden="true" className="text-cyan-300">{mobileDetailsVisible ? '−' : '+'}</span>
        </button>
      )}
      {isDirty && planningFrame?.status === 'ambiguous' && selected && (
        <p role="status" className="rounded-lg border border-amber-700 p-3 text-sm text-amber-200">
          Cornice da verificare. La bozza rimane disponibile, ma non viene collegata automaticamente.
        </p>
      )}
      <div id="int01-planning-details" className={mobileDetailsVisible ? 'space-y-5' : 'hidden space-y-5 sm:block'}>
      {profiles.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          {hasClassContext && planningFrame?.status === 'resolved' ? (
            <div aria-label="Profilo salvato" className="text-sm text-slate-200">
              <p className="font-semibold">Profilo della classe corrente</p>
              <p className="mt-1 text-slate-400">{selected?.schoolYear} · {selected?.subjectCode} · classe {selected?.gradeLevel}</p>
            </div>
          ) : (
          <label className="text-sm text-slate-300">Profilo salvato
            <select
              value={resolvedSelectedId ?? ''}
              onChange={event => chooseProfile(event.target.value)}
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
          )}
          {selectionWarning && <p role="alert" className="mt-2 text-sm text-amber-200">{selectionWarning}</p>}
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
          onRegisterDraftGuard={registerEditorGuard}
          defaultSubjectCode={defaultSubjectCode}
          subjectDisplayLabel={subjectDisplayLabel}
          defaultGradeLevel={resolveClassGradeLevel(currentClassName ?? '') ?? 1}
        />
      </div>
      </div>
      {selected && (
        <section aria-label="Collegamento curricolo Arena" className="space-y-3">
          {hasClassContext && (
            <button type="button" aria-label="Apri strumenti Arena"
              aria-expanded={mobileArenaOpen} aria-controls="int01-arena-details"
              onClick={() => setMobileArenaOpen(open => !open)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left sm:hidden">
              <span>
                <span className="block text-sm font-semibold text-white">Curricolo Arena</span>
                <span className="block text-xs text-slate-400">
                  {resolvedFrame?.arenaContext ? 'Collegato · sola lettura' : 'Da collegare · facoltativo'}
                </span>
              </span>
              <span aria-hidden="true" className="text-cyan-300">{mobileArenaOpen ? '−' : '+'}</span>
            </button>
          )}
          <div id="int01-arena-details" className={mobileArenaOpen || !hasClassContext ? 'block' : 'hidden sm:block'}>
            <ArenaPlanningContextPanel profile={selected}
              acceptedContexts={arenaContexts} onAccept={onAcceptArenaContext} />
          </div>
        </section>
      )}
      <DocenteOsProjectionPanel
        planning={planning}
        classes={classes}
        onAccept={onAcceptDocenteOsProjection}
      />
    </section>
  );
};
