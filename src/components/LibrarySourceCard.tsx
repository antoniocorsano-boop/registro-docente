import React, { useState } from 'react';
import { ExternalLink, Image as ImageIcon, Link2, MoreHorizontal, Trash2 } from 'lucide-react';
import type { UdaRecord } from '../types';
import type { LibrarySource, LibrarySourceLink } from '../library/types';
import type { LibrarySourcePatch } from '../library/libraryState';

interface LibrarySourceCardProps {
  source: LibrarySource;
  udas: UdaRecord[];
  isPending: boolean;
  isSelected: boolean;
  onUse: (sourceId: string) => void;
  onUpdate: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onUnlink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
  onDelete: (sourceId: string) => Promise<void>;
}

const KIND_LABELS: Record<LibrarySource['kind'], string> = {
  image: 'Immagine',
  file: 'File',
  web: 'Web',
  text: 'Testo',
  note: 'Appunto',
  concept: 'Idea',
  internal: 'Materiale interno'
};

const STATUS_LABELS: Record<LibrarySource['status'], string> = {
  captured: 'Acquisita',
  ready: 'Pronta',
  'needs-review': 'Da rivedere',
  restricted: 'Uso limitato',
  failed: 'Da riprovare'
};

export const LibrarySourceCard: React.FC<LibrarySourceCardProps> = ({
  source,
  udas,
  isPending,
  isSelected,
  onUse,
  onUpdate,
  onLink,
  onUnlink,
  onDelete
}) => {
  const [targetUdaId, setTargetUdaId] = useState('');
  const excerpt = source.extractedText || source.payload.text;

  const handleRename = async () => {
    const title = prompt('Nuovo titolo della fonte:', source.title)?.trim();
    if (!title || title === source.title) return;
    try {
      await onUpdate(source.id, { title });
    } catch {
      // The parent keeps the committed source and exposes the durable error state.
    }
  };

  const handleLink = async () => {
    if (!targetUdaId) return;
    try {
      await onLink(source.id, { targetType: 'uda', targetId: targetUdaId });
      setTargetUdaId('');
    } catch {
      // Keep the selected target available for retry.
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminare dalla biblioteca “${source.title}”?`)) return;
    try {
      await onDelete(source.id);
    } catch {
      // The source remains visible because publication happens only after persistence.
    }
  };

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
      <div className="flex gap-3 items-start">
        {source.kind === 'image' && source.payload.dataUrl ? (
          <img
            src={source.payload.dataUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover border border-[var(--border)] bg-slate-950 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--primary)]">
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-1">
            <span>{KIND_LABELS[source.kind]}</span>
            <span aria-hidden="true">·</span>
            <span>{STATUS_LABELS[source.status]}</span>
          </div>
          <h3 className="font-semibold text-white leading-snug break-words">{source.title}</h3>
          {source.origin && <p className="text-xs text-slate-400 mt-1 break-words">{source.origin}</p>}
        </div>
      </div>

      {excerpt && (
        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{excerpt}</p>
      )}

      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline break-all"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Apri origine
        </a>
      )}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => onUse(source.id)}
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-slate-950 font-semibold text-sm disabled:opacity-50"
        >
          Usa
        </button>

        <details className="relative flex-1 group">
          <summary className="list-none min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-variant)] text-slate-200 text-sm inline-flex items-center gap-2 cursor-pointer select-none">
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            Gestisci
          </summary>
          <div className="mt-2 p-3 rounded-lg border border-[var(--border)] bg-slate-950/70 space-y-3">
            <button
              type="button"
              onClick={() => void handleRename()}
              disabled={isPending}
              className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50"
            >
              Rinomina
            </button>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block" htmlFor={`link-${source.id}`}>
                Collega a UDA
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id={`link-${source.id}`}
                  value={targetUdaId}
                  onChange={event => setTargetUdaId(event.target.value)}
                  disabled={isPending || udas.length === 0}
                  className="min-h-[44px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="">Seleziona UDA</option>
                  {udas.map(uda => <option key={uda.id} value={uda.id}>{uda.title}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => void handleLink()}
                  disabled={isPending || !targetUdaId}
                  className="min-h-[44px] px-3 rounded-md border border-slate-700 text-sm text-slate-200 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  Collega
                </button>
              </div>
            </div>

            {source.links.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Collegamenti</p>
                {source.links.map(link => {
                  const label = link.targetType === 'uda'
                    ? udas.find(uda => uda.id === link.targetId)?.title || link.targetId
                    : link.targetId;
                  return (
                    <div key={`${link.targetType}:${link.targetId}`} className="flex items-center justify-between gap-2 text-xs bg-slate-900 rounded-md px-2 py-1.5">
                      <span className="truncate text-slate-300">{label}</span>
                      <button
                        type="button"
                        onClick={() => void onUnlink(source.id, link).catch(() => undefined)}
                        disabled={isPending}
                        className="min-h-[44px] px-2 text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        Scollega
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isPending}
              className="min-h-[44px] px-3 rounded-md border border-red-900/60 text-red-300 text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Elimina
            </button>
          </div>
        </details>
      </div>

      {isSelected && (
        <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100">
          <strong className="block">Funzioni contestuali disponibili con il copilota</strong>
          <span className="text-cyan-200/80">La fonte resta selezionata senza modificare UDA o lezioni.</span>
        </div>
      )}
    </article>
  );
};
