import React, { useMemo, useState } from 'react';
import type { ClassData } from '../../types';
import type { PlanningState } from '../../planning/types';
import {
  previewDocenteOsTeachingProjection,
  type DocenteOsTeachingProjectionV1,
  type DocenteOsProjectionValidationErrorCode
} from '../../planning/docenteOsTeachingProjection';
import {
  findAcceptedDocenteOsTeachingProjectionForSlot,
  reconcileDocenteOsTeachingProjectionClasses
} from '../../planning/docenteOsProjectionReconciliation';

interface DocenteOsProjectionPanelProps {
  planning: PlanningState;
  classes: ClassData[];
  onAccept: (payload: unknown) => Promise<PlanningState>;
}

type ValidationCode = DocenteOsProjectionValidationErrorCode | 'INVALID_JSON' | 'FILE_TOO_LARGE';

export const DocenteOsProjectionPanel: React.FC<DocenteOsProjectionPanelProps> = ({
  planning, classes, onAccept
}) => {
  const [preview, setPreview] = useState<DocenteOsTeachingProjectionV1 | null>(null);
  const [validationCode, setValidationCode] = useState<ValidationCode | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

  // Recompute on every change of canonical classes or stored projections:
  // a file preview does not authorize a later write with obsolete identities.
  const reconciliation = useMemo(() => {
    if (!preview) return [];
    const previous = findAcceptedDocenteOsTeachingProjectionForSlot(planning, preview);
    return reconcileDocenteOsTeachingProjectionClasses(
      preview, classes, previous?.classReconciliation
    );
  }, [preview, planning, classes]);

  const canAccept = preview !== null
    && reconciliation.length === preview.classes.length
    && reconciliation.every(item => item.status === 'resolved');

  const handleFile = async (file: File) => {
    if (isAccepting) return;
    setPreview(null);
    setErrorMessage('');
    setSuccessMessage('');
    setValidationCode(null);

    if (file.size > 8 * 1024 * 1024) {
      setValidationCode('FILE_TOO_LARGE');
      setErrorMessage('Il file supera il limite di 8 MB previsto per l’anteprima locale.');
      return;
    }

    try {
      const text = await file.text();
      const result = previewDocenteOsTeachingProjection(JSON.parse(text) as unknown);
      if (!result.ok) {
        setValidationCode(result.code);
        setErrorMessage('Il file non contiene una proiezione Docente OS valida.');
        return;
      }
      setPreview(result.projection);
    } catch {
      setValidationCode('INVALID_JSON');
      setErrorMessage('Il file selezionato non è un JSON leggibile.');
    }
  };

  const handleAccept = async () => {
    if (!preview || !canAccept || isAccepting) return;
    setIsAccepting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await onAccept(preview.projection);
      setPreview(null);
      setSuccessMessage('Proiezione Docente OS accettata e salvata.');
    } catch (error) {
      // Display only the controlled message; never print the uploaded source.
      setErrorMessage(error instanceof Error
        ? error.message
        : 'Non è stato possibile salvare la proiezione.');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <details aria-label="Importa da Docente OS" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <summary className="flex min-h-[44px] cursor-pointer select-none items-center text-sm font-semibold text-slate-200">
        Importa da Docente OS
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-slate-400">
          Seleziona una proiezione JSON esportata da Docente OS. Il file viene letto e verificato sul dispositivo:
          l’anteprima non modifica i dati. L’acquisizione richiede una conferma esplicita.
        </p>
        <label className="block rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-300">
          <span className="mb-2 block font-medium">File di proiezione (.json)</span>
          <input
            type="file"
            accept="application/json,.json"
            className="block w-full min-h-[44px] text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:text-white"
            disabled={isAccepting}
            onChange={event => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              void handleFile(file).finally(() => { input.value = ''; });
            }}
          />
        </label>

        {errorMessage && (
          <div role="alert" className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3 text-sm text-rose-200">
            {errorMessage}
            {validationCode && (
              <details className="mt-2 text-xs text-rose-300">
                <summary>Dettagli tecnici</summary>
                <code className="mt-1 block break-all">{validationCode}</code>
              </details>
            )}
          </div>
        )}

        {preview && (
          <section aria-label="Anteprima proiezione Docente OS" className="space-y-4 rounded-lg border border-slate-700 bg-slate-950/40 p-4">
            <div>
              <h3 className="font-semibold text-slate-100">Anteprima della programmazione</h3>
              <p className="mt-1 text-sm text-slate-400">
                Controlla la provenienza e la corrispondenza delle classi prima dell’accettazione.
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Anno scolastico</dt><dd className="text-slate-200">{preview.schoolYear}</dd></div>
              <div><dt className="text-slate-500">Disciplina</dt><dd className="text-slate-200">{preview.disciplineName}</dd></div>
              <div><dt className="text-slate-500">Classi</dt><dd className="text-slate-200">{preview.classes.length}</dd></div>
              <div><dt className="text-slate-500">UDA</dt><dd className="text-slate-200">{preview.classes.reduce((total, section) => total + section.udas.length, 0)}</dd></div>
              <div><dt className="text-slate-500">Generata</dt><dd className="text-slate-200">{preview.generatedAt}</dd></div>
              <div><dt className="text-slate-500">Commit sorgente</dt><dd className="break-all font-mono text-xs text-slate-300">{preview.provenance.sourceCommit}</dd></div>
            </dl>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Riconciliazione classi</h4>
              <ul className="mt-2 space-y-2">
                {reconciliation.map(item => {
                  const source = preview.classes.find(section => section.sourceSectionId === item.sourceSectionId);
                  const registroClass = item.status === 'resolved'
                    ? classes.find(candidate => candidate.id === item.registroClassId) : null;
                  return (
                    <li key={item.sourceSectionId} className="flex flex-col gap-1 rounded border border-slate-800 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-200">{source?.displayLabel ?? item.sourceSectionId}</span>
                      <span className={item.status === 'resolved' ? 'text-emerald-300' : 'text-amber-300'}>
                        {item.status === 'resolved' ? 'Associata'
                          : item.status === 'ambiguous' ? 'Ambigua' : 'Non associata'}
                        {registroClass ? ` · ${registroClass.name}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {!canAccept && (
              <p role="status" className="rounded border border-amber-800/60 bg-amber-950/20 p-3 text-sm text-amber-200">
                Prima dell’accettazione tutte le classi devono avere una corrispondenza univoca nel Registro.
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={!canAccept || isAccepting}
              className="min-h-[44px] rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAccepting ? 'Salvataggio…' : 'Accetta e salva la proiezione'}
            </button>
          </section>
        )}

        {successMessage && (
          <p role="status" className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-3 text-sm text-emerald-200">
            {successMessage}
          </p>
        )}
      </div>
    </details>
  );
};
