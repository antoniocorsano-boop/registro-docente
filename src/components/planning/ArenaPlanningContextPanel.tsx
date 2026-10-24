import React, { useMemo, useState } from 'react';
import { previewArenaPlanningContext } from '../../planning/arenaPlanningContext';
import type {
  ArenaPlanningContext,
  ArenaPlanningContextPreview,
  TeachingProfile
} from '../../planning/types';

interface ArenaPlanningContextPanelProps {
  profile: TeachingProfile;
  acceptedContexts: ArenaPlanningContext[];
  onAccept: (context: ArenaPlanningContextPreview) => Promise<void>;
}

export const ArenaPlanningContextPanel: React.FC<ArenaPlanningContextPanelProps> = ({
  profile,
  acceptedContexts,
  onAccept
}) => {
  const [preview, setPreview] = useState<ArenaPlanningContextPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState('');

  const latestAccepted = useMemo(() => {
    const matching = acceptedContexts.filter(context => context.profileId === profile.id);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }, [acceptedContexts, profile.id]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setErrors([]);
    setMessage('');
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const result = previewArenaPlanningContext(parsed, profile);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setPreview(result.context);
    } catch {
      setErrors(['JSON_NON_VALIDO']);
    }
  };

  const acceptPreview = async () => {
    if (!preview || accepting) return;
    setAccepting(true);
    setMessage('');
    try {
      await onAccept(preview);
      setMessage('Contesto Arena collegato al profilo dopo conferma del docente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Associazione non riuscita.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-violet-900/60 bg-violet-950/15 p-4 sm:p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-violet-100">Contesto Arena</h3>
          <span className="rounded-full border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-200">Solo anteprima</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">Carica localmente un handoff JSON qualificato da Arena. Il file non viene inviato ad Arena e non modifica la programmazione finché non lo accetti esplicitamente.</p>
      </div>

      <label className="block text-sm text-slate-300">
        Handoff Arena (.json)
        <input type="file" accept="application/json,.json" onChange={handleFile} className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-violet-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
      </label>

      {errors.length > 0 && (
        <div role="alert" className="rounded border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          Handoff rifiutato in modalità fail-closed: {errors.join(', ')}
        </div>
      )}

      {preview && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Stato di autorità</p><p className="font-medium text-slate-100">{preview.authorityState}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Vigenza</p><p className="font-medium text-slate-100">{preview.vigencyStatus}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Regime</p><p className="font-medium text-slate-100">{preview.regimeRef}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Applicabilità</p><p className="font-medium text-slate-100">{preview.applicabilityStatus}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Master Arena</p><p className="font-medium text-slate-100">{preview.masterId} · v{preview.masterVersion}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-500">Fingerprint master</p><p className="break-all font-mono text-sm text-slate-200">{preview.structuralFingerprint.hash}</p></div>
            <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-slate-500">Commit sorgente</p><p className="break-all font-mono text-sm text-slate-200">{preview.provenance.sourceCommit}</p></div>
          </div>

          {preview.vigencyStatus === 'NON_VIGENTE' && (
            <div className="rounded border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
              Questo contesto non è vigente. Registro Docente lo conserva con lo stato ricevuto e non lo promuove ad autorità vigente.
            </div>
          )}

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Contenuti curricolari ricevuti</p>
            <ul className="space-y-2 text-sm text-slate-300">
              {preview.curricoloItems.map(item => (
                <li key={item.id} className="rounded border border-slate-800 p-3">
                  <p className="font-medium text-slate-100">{item.gradeLabel} · {item.kind}</p>
                  <p className="text-xs text-slate-500">Sezione sorgente {item.sourceSection}</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <button type="button" disabled={accepting} onClick={acceptPreview} className="rounded bg-violet-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
            {accepting ? 'Associazione…' : 'Accetta e collega al profilo'}
          </button>
        </div>
      )}

      {latestAccepted && (
        <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-100">
          Ultimo contesto accettato: master {latestAccepted.masterVersion} · {latestAccepted.authorityState} · {latestAccepted.vigencyStatus} · accettato il {latestAccepted.acceptedAt}.
        </div>
      )}

      {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
    </section>
  );
};
