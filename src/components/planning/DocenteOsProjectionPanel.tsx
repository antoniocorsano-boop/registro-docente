import React, { useMemo, useState } from 'react';
import type { ClassData } from '../../types';
import {
  previewDocenteOsTeachingProjection,
  type DocenteOsProjectionValidationErrorCode,
  type DocenteOsTeachingProjectionV1
} from '../../planning/docenteOsTeachingProjection';
import {
  findAcceptedDocenteOsTeachingProjectionForSlot,
  reconcileDocenteOsTeachingProjectionClasses
} from '../../planning/docenteOsProjectionReconciliation';
import type {
  DocenteOsProjectionClassReconciliation,
  PlanningState
} from '../../planning/types';

interface DocenteOsProjectionPanelProps {
  planning: PlanningState;
  classes: ClassData[];
  onAccept: (payload: unknown) => Promise<PlanningState>;
}

interface ProjectionPreviewState {
  projection: DocenteOsTeachingProjectionV1;
  reconciliation: DocenteOsProjectionClassReconciliation[];
  udaCount: number;
}

type UiValidationCode = DocenteOsProjectionValidationErrorCode | 'INVALID_JSON';

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('it-IT');
}

export const DocenteOsProjectionPanel: React.FC<DocenteOsProjectionPanelProps> = ({
  planning,
  classes,
  onAccept
}) => {
  const [preview, setPreview] = useState<ProjectionPreviewState | null>(null);
  const [validationCode, setValidationCode] = useState<UiValidationCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const canAccept = useMemo(
    () => preview !== null && preview.reconciliation.every(item => item.status === 'resolved'),
    [preview]
  );

  const handleAccept = async () => {
    if (!preview || !canAccept || isAccepting) return;
    setIsAccepting(true);
    setErrorMessage(null);
    setValidationCode(null);
    try {
      await onAccept(preview.projection);
      setSuccessMessage('Proiezione Docente OS accettata e salvata.');
    } catch (error) {
      setErrorMessage(error instanceof Error
        ? error.message
        : 'Non è stato possibile salvare la proiezione. Riprova.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleFile = async (file: File) => {
    setPreview(null);
    setValidationCode(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const result = previewDocenteOsTeachingProjection(payload);
      if (!result.ok) {
        setValidationCode(result.code);
        setErrorMessage('Il file non contiene una proiezione Docente OS valida.');
        return;
      }

      const previousAccepted = findAcceptedDocenteOsTeachingProjectionForSlot(
        planning,
        result.projection
      );
      const reconciliation = reconcileDocenteOsTeachingProjectionClasses(
        result.projection,
        classes,
        previousAccepted?.classReconciliation
      );
      const udaCount = result.projection.classes.reduce(
        (total, section) => total + section.udas.length,
        0
      );
      setPreview({ projection: result.projection, reconciliation, udaCount });
    } catch {
      setValidationCode('INVALID_JSON');
      setErrorMessage('Il file selezionato non è un JSON leggibile.');
    }
  };

  const projection = preview?.projection;

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-200">
        Importa da Docente OS
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-slate-400">
          Seleziona il file JSON esportato da Docente OS. Il file viene letto e verificato in questo dispositivo prima di qualsiasi accettazione.
        </p>
        <label className="block rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-300">
          <span className="mb-2 block font-medium">File di proiezione</span>
          <input
            type="file"
            accept="application/json,.json"
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:text-white"
            disabled={isAccepting}
            onChange={event => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              void handleFile(file).finally(() => {
                input.value = '';
              });
            }}
          />
        </label>

        {errorMessage && (
          <div role="alert" className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3 text-sm text-rose-200">
            <p>{errorMessage}</p>
            {validationCode && (
              <details className="mt-2 text-xs text-rose-300">
                <summary>Dettagli tecnici</summary>
                <code className="mt-1 block break-all">{validationCode}</code>
              </details>
            )}
          </div>
        )}

        {projection && preview && (
          <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-950/40 p-4">
            <div>
              <h3 className="font-semibold text-slate-100">Anteprima della programmazione</h3>
              <p className="mt-1 text-sm text-slate-400">Controlla provenienza, contenuto e associazione alle classi del Registro prima di accettare.</p>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Anno scolastico</dt><dd className="text-slate-200">{projection.schoolYear}</dd></div>
              <div><dt className="text-slate-500">Disciplina</dt><dd className="text-slate-200">{projection.disciplineName}</dd></div>
              <div><dt className="text-slate-500">Classi</dt><dd className="text-slate-200">{projection.classes.length}</dd></div>
              <div><dt className="text-slate-500">UDA</dt><dd className="text-slate-200">{preview.udaCount}</dd></div>
              <div><dt className="text-slate-500">Generata</dt><dd className="text-slate-200">{formatGeneratedAt(projection.generatedAt)}</dd></div>
              <div><dt className="text-slate-500">Commit sorgente</dt><dd className="break-all font-mono text-xs text-slate-300">{projection.provenance.sourceCommit}</dd></div>
            </dl>

            <div>
              <h4 className="text-sm font-semibold text-slate-200">Riconciliazione classi</h4>
              <ul className="mt-2 space-y-2">
                {preview.reconciliation.map(item => {
                  const source = projection.classes.find(section => section.sourceSectionId === item.sourceSectionId);
                  const registroClass = item.status === 'resolved'
                    ? classes.find(candidate => candidate.id === item.registroClassId)
                    : undefined;
                  const label = item.status === 'resolved'
                    ? 'Associata'
                    : item.status === 'ambiguous'
                      ? 'Ambigua'
                      : 'Non associata';
                  return (
                    <li key={item.sourceSectionId} className="flex flex-col gap-1 rounded border border-slate-800 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-200">{source?.displayLabel ?? item.sourceSectionId}</span>
                      <span className={item.status === 'resolved' ? 'text-emerald-300' : 'text-amber-300'}>
                        {label}{registroClass ? ` · ${registroClass.name}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {!canAccept && (
              <p className="rounded border border-amber-800/60 bg-amber-950/20 p-3 text-sm text-amber-200">
                Prima dell'accettazione tutte le classi devono avere una corrispondenza univoca nel Registro.
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={!canAccept || isAccepting}
              className="min-h-11 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAccepting ? 'Salvataggio…' : 'Accetta e salva la proiezione'}
            </button>
          </div>
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
