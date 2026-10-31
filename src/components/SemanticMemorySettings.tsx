import React, { useState } from 'react';
import type { SemanticMemoryHealthV1 } from '../../vendor/contextual-copilot-semantic-memory/index';
import type { SemanticMemorySyncResult } from '../semanticMemory/sync';

export type SemanticMemorySessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'degraded'
  | 'rebuild-required'
  | 'error';

export interface SemanticMemorySessionView {
  status: SemanticMemorySessionStatus;
  endpoint: string | null;
  health: SemanticMemoryHealthV1 | null;
  sync: SemanticMemorySyncResult | null;
  errorCode?: string;
}

export interface SemanticMemoryConnectInput {
  endpoint: string;
  token: string;
}

interface SemanticMemorySettingsProps {
  session: SemanticMemorySessionView;
  isSyncing: boolean;
  onConnect: (input: SemanticMemoryConnectInput) => Promise<boolean>;
  onDisconnect: () => void;
  onSync: () => Promise<void>;
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765';

function sessionCopy(session: SemanticMemorySessionView): string {
  switch (session.status) {
    case 'connecting':
      return 'Verifica della memoria locale in corso…';
    case 'ready':
      return 'Memoria locale connessa e pronta.';
    case 'degraded':
      return 'Memoria locale connessa in modalità ridotta.';
    case 'rebuild-required':
      return 'L’indice locale deve essere ricostruito prima di sincronizzare o cercare.';
    case 'error':
      return 'Connessione locale non disponibile. Controlla Termux e riprova.';
    default:
      return 'Non connessa. La Biblioteca continua a usare la ricerca locale già disponibile.';
  }
}

function syncCopy(result: SemanticMemorySyncResult | null): string | null {
  if (!result) return null;
  if (result.status === 'synced') {
    const changed = result.counts.inserted + result.counts.replaced + result.counts.removed;
    return changed > 0
      ? `Indice locale aggiornato: ${changed} elementi modificati.`
      : 'Indice locale già allineato.';
  }
  if (result.status === 'reconciliation-required') {
    return 'L’indice locale è cambiato fuori da questa sessione: serve una nuova riconciliazione.';
  }
  if (result.status === 'rebuild-required') {
    return 'Il modello locale è cambiato: ricostruisci l’indice prima di continuare.';
  }
  return 'Sincronizzazione non completata. I dati canonici del Registro non sono stati modificati.';
}

export const SemanticMemorySettings: React.FC<SemanticMemorySettingsProps> = ({
  session,
  isSyncing,
  onConnect,
  onDisconnect,
  onSync,
}) => {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const canSync = session.status === 'ready' || session.status === 'degraded';
  const connected = canSync || session.status === 'rebuild-required';
  const resultCopy = syncCopy(session.sync);

  const handleConnect = async () => {
    if (!endpoint.trim() || !token.trim() || isConnecting) return;
    setIsConnecting(true);
    try {
      const connectedNow = await onConnect({ endpoint, token });
      if (connectedNow) setToken('');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3" data-testid="semantic-memory-settings">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Memoria semantica locale</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Collegamento facoltativo a Termux. Il token resta solo sul dispositivo e solo per questa sessione.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
          {session.status === 'ready' ? 'Pronta' : session.status === 'degraded' ? 'Ridotta' : session.status === 'rebuild-required' ? 'Da ricostruire' : 'Locale'}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400" aria-live="polite">{sessionCopy(session)}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="text-xs text-slate-400">
          Endpoint locale
          <input
            value={endpoint}
            onChange={event => setEndpoint(event.target.value)}
            inputMode="url"
            autoComplete="off"
            disabled={isConnecting || connected}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
          />
        </label>
        <label className="text-xs text-slate-400">
          Token di sessione
          <input
            type="password"
            value={token}
            onChange={event => setToken(event.target.value)}
            autoComplete="off"
            disabled={isConnecting || connected}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
          />
        </label>
        <div className="flex items-end gap-2">
          {connected ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-400"
            >
              Disconnetti
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={!endpoint.trim() || !token.trim() || isConnecting}
              className="min-h-11 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? 'Connessione…' : 'Connetti memoria locale'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onSync()}
          disabled={!canSync || isSyncing}
          className="min-h-11 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSyncing ? 'Sincronizzazione…' : 'Sincronizza'}
        </button>
        <span className="text-xs text-slate-500">
          Solo Biblioteca professionale e memoria professionale ammesse; nessun dato studente.
        </span>
      </div>

      {resultCopy && (
        <p className="mt-2 text-xs text-slate-300" aria-live="polite">{resultCopy}</p>
      )}
    </div>
  );
};
