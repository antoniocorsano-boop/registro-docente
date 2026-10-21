import React, { useState } from 'react';
import type { VaultGateState } from '../security/secureAppStorage';

export interface VaultGateProps {
  state: VaultGateState;
  children: React.ReactNode;
  onSetup: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onMigrate: (password: string) => Promise<void>;
  onRetry: () => void;
  errorMessage?: string | null;
}

export const VaultGate: React.FC<VaultGateProps> = ({
  state,
  children,
  onSetup,
  onUnlock,
  onMigrate,
  onRetry,
  errorMessage
}) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (state === 'READY') {
    return <>{children}</>;
  }

  const runSecureAction = async (action: (value: string) => Promise<void>) => {
    if (!password) {
      setActionError('Inserisci la password locale.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      await action(password);
      setPassword('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Operazione di sicurezza non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  let title = 'Protezione del Registro';
  let description = 'Verifica dello stato di sicurezza locale in corso.';
  let actionLabel: string | null = null;
  let action: ((value: string) => Promise<void>) | null = null;

  if (state === 'SETUP_REQUIRED') {
    title = 'Configura archivio protetto';
    description = 'Crea una password locale per proteggere i dati del Registro sul dispositivo.';
    actionLabel = 'Configura archivio protetto';
    action = onSetup;
  } else if (state === 'MIGRATION_REQUIRED') {
    title = 'Proteggi i dati esistenti';
    description = 'I dati locali esistenti devono essere trasferiti nel Secure Local Vault prima di aprire il Registro.';
    actionLabel = 'Proteggi i dati esistenti';
    action = onMigrate;
  } else if (state === 'LOCKED') {
    title = 'Sblocca Registro';
    description = 'Il Secure Local Vault è bloccato. Inserisci la password locale per accedere ai dati.';
    actionLabel = 'Sblocca Registro';
    action = onUnlock;
  } else if (state === 'MIGRATING') {
    title = 'Protezione dati in corso';
    description = 'Il Registro sta verificando e trasferendo i dati nel vault cifrato. I dati restano nascosti fino al completamento.';
  } else if (state === 'ERROR') {
    title = 'Sicurezza non disponibile';
    description = errorMessage || 'Il Registro non può aprire i dati in modo sicuro. Nessun fallback in chiaro è consentito.';
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Secure Local Vault</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>

        {action && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runSecureAction(action);
            }}
          >
            <label className="block text-sm font-medium" htmlFor="vault-password">
              Password locale
            </label>
            <input
              id="vault-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-slate-100"
            />
            {actionError && <p className="text-sm text-rose-300">{actionError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Operazione in corso…' : actionLabel}
            </button>
          </form>
        )}

        {state === 'ERROR' && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 w-full rounded-lg border border-slate-600 px-4 py-3 font-semibold"
          >
            Riprova controllo sicurezza
          </button>
        )}
      </section>
    </div>
  );
};
