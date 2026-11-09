import React, { useRef, useState } from 'react';
import type { ClassData, CouncilSession } from '../types';
import type { CouncilEvidenceOverviewV1 } from '../council/councilEvidenceOverview';
import { formatCouncilSnapshotCaptureTime } from '../council/councilSnapshotPresentation';
import {
  readCouncilSnapshots,
  type CouncilSnapshotContextV1,
  type CouncilSnapshotPreviewV1
} from '../council/councilEvidenceSnapshots';
import { formatCouncilDate, isCouncilSessionDateValid, normalizeSchoolYear } from '../council/councilModel';
import { today, uid } from '../utils';

interface CouncilSnapshotSectionProps {
  classData: ClassData;
  schoolYear: string;
  session: CouncilSession;
  currentOverview: CouncilEvidenceOverviewV1 | null;
  disabled: boolean;
  onPrepareSnapshot: (context: CouncilSnapshotContextV1) => Promise<CouncilSnapshotPreviewV1>;
  onConfirmSnapshot: (reviewed: CouncilSnapshotPreviewV1, snapshotId: string) => Promise<void>;
  onWorkingChange: (working: boolean) => void;
}

const COUNT_LABELS = [
  ['totalStudents', 'Alunni'],
  ['withNumericEvidence', 'Con prove numeriche'],
  ['withoutNumericEvidence', 'Senza prove numeriche'],
  ['numericEvidenceCount', 'Prove numeriche'],
  ['withSavedTeacherProposal', 'Con voto di ingresso salvato'],
  ['withoutSavedTeacherProposal', 'Senza voto di ingresso salvato']
] as const;

const earliestDate = (a: string, b: string): string => a < b ? a : b;

/**
 * P3: all previews are ephemeral. No state write occurs before a distinct
 * teacher confirmation and the App's durable, serialized Vault commit.
 */
export const CouncilSnapshotSection: React.FC<CouncilSnapshotSectionProps> = ({
  classData, schoolYear, session, currentOverview, disabled,
  onPrepareSnapshot, onConfirmSnapshot, onWorkingChange
}) => {
  const [snapshotCutoff, setSnapshotCutoff] = useState(() => earliestDate(session.date, today()));
  const [snapshotPreview, setSnapshotPreview] = useState<CouncilSnapshotPreviewV1 | null>(null);
  const [snapshotWorking, setSnapshotWorking] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const snapshotWorkingRef = useRef(false);

  const snapshots = readCouncilSnapshots(classData, schoolYear, session.id);
  const selectedSnapshot = snapshots.find(item => item.id === selectedSnapshotId) ?? snapshots.at(-1) ?? null;
  const year = normalizeSchoolYear(schoolYear);
  const start = year ? year.slice(0, 4) + '-09-01' : '';
  const maxCutoff = earliestDate(session.date, today());
  const cutoffValid = isCouncilSessionDateValid(snapshotCutoff, schoolYear)
    && snapshotCutoff <= maxCutoff;
  const busy = disabled || snapshotWorking;

  const setWorking = (value: boolean) => {
    snapshotWorkingRef.current = value;
    setSnapshotWorking(value);
    onWorkingChange(value);
  };

  const prepare = async () => {
    if (busy || snapshotWorkingRef.current || !cutoffValid) return;
    setWorking(true);
    setSnapshotPreview(null);
    setSnapshotStatus('Preparazione della fotografia, senza salvataggio…');
    try {
      const reviewed = await onPrepareSnapshot({
        classId: classData.id, schoolYear, sessionId: session.id, cutoff: snapshotCutoff
      });
      setSnapshotPreview(reviewed);
      setSnapshotStatus('Anteprima non salvata. Verifica gli indicatori e le date.');
    } catch {
      setSnapshotStatus('Anteprima non disponibile: controlla seduta, data limite e dati salvati.');
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    if (busy || snapshotWorkingRef.current || !snapshotPreview) return;
    const reviewed = snapshotPreview;
    setWorking(true);
    setSnapshotStatus('Salvataggio della fotografia nell’archivio cifrato…');
    try {
      await onConfirmSnapshot(reviewed, uid());
      setSnapshotPreview(null);
      setSelectedSnapshotId('');
      setSnapshotStatus('Fotografia confermata e salvata. Le versioni precedenti sono conservate.');
    } catch {
      // The preview is no longer trustworthy following a competing mutation
      // or a failed durable write; require explicit preparation again.
      setSnapshotPreview(null);
      setSnapshotStatus('Fotografia non salvata. Riesamina i dati e prepara una nuova anteprima.');
    } finally {
      setWorking(false);
    }
  };

  // Review a preview completely; archived snapshots show secondary counts only
  // on request, without changing what the record stores.
  const counts = (aggregates: CouncilSnapshotPreviewV1['aggregates'],
    omitSavedVotes = false) => (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {COUNT_LABELS.filter(([key]) => !omitSavedVotes || key !== 'withSavedTeacherProposal')
        .map(([key, label]) => (
          <div key={key} className="min-w-0 rounded-lg border border-[var(--border)] p-2">
            <dt className="text-xs leading-snug text-slate-300">{label}</dt>
            <dd className="text-lg font-bold tabular-nums text-white">{aggregates[key]}</dd>
          </div>
        ))}
    </dl>
  );

  return (
    <section className="mt-3 min-w-0 max-w-full space-y-3 border-t border-[var(--border)] pt-3"
      aria-label="Fotografie storiche della seduta">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-white">Fotografie confermate</h3>
        {selectedSnapshot && (
          <span className="rounded-full border border-emerald-700/60 bg-emerald-950/50 px-2.5 py-1 text-xs font-semibold text-emerald-200">
            Confermata
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-slate-300">
        Dati aggregati del docente, non un verbale ufficiale.
      </p>

      {snapshots.length > 0 && (
        <label className="block text-sm font-semibold text-slate-200">
          Versione da consultare
          <select aria-label="Seleziona versione fotografica" value={selectedSnapshot?.id ?? ''}
            onChange={event => setSelectedSnapshotId(event.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-slate-900 p-2 text-white">
            {snapshots.map(item => (
              <option key={item.id} value={item.id}>
                Revisione {item.revision} · {formatCouncilDate(item.captureLocalDate)}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedSnapshot ? (
        <div className="min-w-0 space-y-3 rounded-lg border border-[var(--border)] bg-slate-900/50 p-3"
          aria-label="Fotografia archiviata">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Fotografia confermata · revisione {selectedSnapshot.revision}
            </p>
            <p className="text-xs text-slate-200">
              <time dateTime={selectedSnapshot.capturedAt}>
                Acquisita il {formatCouncilSnapshotCaptureTime(
                  selectedSnapshot.capturedAt, selectedSnapshot.captureLocalDate,
                  selectedSnapshot.captureUtcOffsetMinutes
                )}
              </time>
            </p>
            <p className="text-xs text-slate-400">
              Seduta: {formatCouncilDate(selectedSnapshot.sessionDate)} ·
              prove fino al {formatCouncilDate(selectedSnapshot.requestedCutoff)}
            </p>
          </div>
          <section aria-label="Confronto tra fotografia e quadro corrente" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-lg border border-cyan-800/60 bg-cyan-950/20 p-3"
                aria-label="Voti salvati nella fotografia">
                <p className="text-xs leading-snug text-slate-200">Voti salvati nella fotografia</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                  {selectedSnapshot.aggregates.withSavedTeacherProposal}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--border)] bg-slate-950/50 p-3"
                aria-label="Voti salvati nel quadro corrente">
                <p className="text-xs leading-snug text-slate-200">Voti salvati nel quadro corrente</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                  {currentOverview?.withSavedTeacherProposal ?? '—'}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              La fotografia resta invariata. Il quadro corrente usa le prove fino al
              {' '}{currentOverview ? formatCouncilDate(currentOverview.effectiveCutoff) : 'limite non disponibile'}.
              La data limite riguarda le prove, non certifica quando i voti furono inseriti.
            </p>
          </section>
          <details className="rounded-lg border border-[var(--border)] p-2.5"
            aria-label="Altri indicatori della fotografia">
            <summary className="min-h-[32px] cursor-pointer text-sm font-semibold text-slate-200">
              Altri cinque indicatori della fotografia
            </summary>
            <div className="pt-3">
              {counts(selectedSnapshot.aggregates, true)}
            </div>
          </details>
          <details className="rounded-lg border border-[var(--border)] px-2.5 py-2">
            <summary className="cursor-pointer text-xs text-slate-400">Dettagli tecnici dell’acquisizione</summary>
            <p className="break-all pt-2 text-xs text-slate-400">
              Istante originale UTC: {selectedSnapshot.capturedAt} ·
              scostamento in minuti: {selectedSnapshot.captureUtcOffsetMinutes}.
            </p>
          </details>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Nessuna fotografia confermata per questa seduta.</p>
      )}

      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3"
        aria-label="Nuova fotografia della seduta">
        <label className="block text-sm font-semibold text-slate-200">
          Data limite delle prove per la fotografia
          <input aria-label="Data limite delle prove per la fotografia" type="date"
            value={snapshotCutoff} min={start || undefined} max={maxCutoff}
            onChange={event => {
              setSnapshotCutoff(event.target.value);
              setSnapshotPreview(null);
              setSnapshotStatus('');
            }}
            disabled={busy}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-slate-900 p-2 text-white" />
        </label>
        {!cutoffValid && <p role="alert" className="text-xs text-amber-300">
          La data limite deve appartenere all’anno scolastico e non superare né la seduta né oggi.
        </p>}
        <button type="button" onClick={() => { void prepare(); }}
          disabled={busy || !cutoffValid}
          className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {snapshotWorking ? 'Operazione in corso…' : snapshots.length > 0 ? 'Acquisisci nuova versione' : 'Prepara fotografia'}
        </button>
        {snapshotPreview && (
          <div className="min-w-0 space-y-3 rounded-lg border border-cyan-500/40 bg-slate-800/70 p-3"
            aria-label="Anteprima della fotografia non salvata">
            <p className="text-sm font-bold text-cyan-200">
              Anteprima non salvata · revisione {snapshotPreview.revision}
            </p>
            <p className="text-xs text-slate-200">
              Seduta {formatCouncilDate(snapshotPreview.sessionDate)} ·
              prove fino al {formatCouncilDate(snapshotPreview.requestedCutoff)} ·
              acquisizione proposta il {formatCouncilDate(snapshotPreview.captureLocalDate)}.
            </p>
            {counts(snapshotPreview.aggregates)}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { void confirm(); }}
                disabled={busy}
                className="min-h-[44px] rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-black disabled:opacity-50">
                Conferma e salva fotografia
              </button>
              <button type="button" onClick={() => {
                setSnapshotPreview(null);
                setSnapshotStatus('Anteprima annullata: nessuna fotografia aggiunta.');
              }} disabled={busy}
                className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
                Annulla anteprima
              </button>
            </div>
          </div>
        )}
        <p role="status" aria-live="polite" className="text-xs text-slate-300">{snapshotStatus}</p>
      </div>
    </section>
  );
};
