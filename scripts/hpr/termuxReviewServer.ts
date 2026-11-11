import {createHash, randomBytes} from 'node:crypto';
import {
  closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync
} from 'node:fs';
import path from 'node:path';
import {createAndroidReviewApp} from './androidReviewApp.ts';

/**
 * This constant is compiled into the portable Node bundle by GitHub Actions.
 * Its value cannot be changed by a shell variable at launch time.
 */
declare const __HPR_QUALIFIED_SHA__: string;

interface LocalState {
  version: 1;
  commitSha: string;
  accessSecret: string;
  expiresAt: string;
}

const ISOLATED_PORT = 48721;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'hpr-manifest.json');
const STATE_PATH = path.join(ROOT, '.hpr-local-state.json');

if (process.env.HPR_TERMUX_MODE !== 'synthetic-only') {
  throw new Error('La prova locale si avvia solo dal comando avvia.sh.');
}
if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
  throw new Error('Rimuovere le chiavi dei servizi esterni prima della prova locale.');
}
if (!/^[a-f0-9]{40}$/.test(__HPR_QUALIFIED_SHA__)) {
  throw new Error('La compilazione non identifica un commit qualificato.');
}

const manifest: unknown = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
  throw new Error('Manifesto della prova assente o non valido.');
}
const m = manifest as Record<string, unknown>;
if (m.schemaVersion !== 1 || m.commitSha !== __HPR_QUALIFIED_SHA__
    || m.provider !== 'synthetic-only' || m.scope !== 'android-local-hpr') {
  throw new Error('Il pacchetto non corrisponde alla versione qualificata.');
}

process.umask(0o077);

function readOrCreateState(): LocalState {
  if (!existsSync(STATE_PATH)) {
    const state: LocalState = {
      version: 1,
      commitSha: __HPR_QUALIFIED_SHA__,
      accessSecret: randomBytes(36).toString('base64url'),
      expiresAt: new Date(Date.now() + THREE_DAYS_MS).toISOString()
    };
    const fd = openSync(STATE_PATH, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(state, null, 2)); }
    finally { closeSync(fd); }
    return state;
  }
  const stat = lstatSync(STATE_PATH);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error('Lo stato locale non è protetto. Non avviare la prova.');
  }
  const raw: unknown = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Stato locale non valido.');
  }
  const state = raw as Partial<LocalState>;
  if (state.version !== 1 || state.commitSha !== __HPR_QUALIFIED_SHA__
      || typeof state.accessSecret !== 'string' || state.accessSecret.length < 32
      || typeof state.expiresAt !== 'string') {
    throw new Error('Stato locale non conforme al pacchetto.');
  }
  if (Date.parse(state.expiresAt) <= Date.now()) {
    throw new Error('La prova è scaduta. Eliminare il pacchetto dopo il collaudo.');
  }
  return state as LocalState;
}

const state = readOrCreateState();
const app = createAndroidReviewApp({
  accessSecret: state.accessSecret,
  expectedSha: __HPR_QUALIFIED_SHA__,
  deployedSha: m.commitSha as string,
  expiresAt: state.expiresAt,
  staticRoot: path.join(ROOT, 'dist')
});

const server = app.listen(ISOLATED_PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + ISOLATED_PORT;
  console.log('\nREGISTRO DOCENTE — PROVA LOCALE ANDROID');
  console.log('Solo dati fittizi. Nessuna richiesta a servizi AI esterni.');
  console.log('Indirizzo: ' + url);
  console.log('Utente: docente-prova');
  console.log('Password (solo sul telefono): ' + state.accessSecret);
  console.log('Scadenza: ' + state.expiresAt);
  console.log('Per terminare: torna in Termux e premi Ctrl+C.\n');
});
server.on('error', error => {
  console.error('Avvio interrotto: ' + String(error));
  process.exitCode = 1;
});
