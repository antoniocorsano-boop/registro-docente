# LSM-01D — Registro Zero-Token Activation

**Data:** 2026-11-01  
**Stato:** DESIGN — DOCS ONLY  
**Baseline:** `33d486db1e2258a82ccd016274ab8db0d3e1b691`  
**Autorità cross-repo:** `trama-ecosistema/docs/superpowers/specs/2026-11-01-lsm-01d-local-trust-bridge-design.md`

## Intento

Semplificare l’attivazione della memoria semantica locale nel Registro eliminando completamente l’inserimento manuale del token, senza persistere segreti nel browser, nel vault o nei backup.

## Esperienza utente

Stato iniziale della sessione:

```text
Memoria semantica locale   Non attiva
Usa il motore locale sul dispositivo. Nessun dato viene inviato a servizi remoti.
[ Attiva memoria locale ]
```

Dopo il tap:

```text
Memoria semantica locale   Pronta
Memoria locale connessa e pronta.
[ Sincronizza ] [ Disattiva ]
```

Non esiste più il campo `Token di sessione`.

## Regole

- nessun probe del loopback al semplice caricamento della pagina;
- il tap `Attiva memoria locale` è il trigger esplicito del bootstrap;
- il bootstrap restituisce una capacità effimera che vive solo in memoria;
- nessun segreto entra in `AppSettings`, Secure Vault, IndexedDB canonico, backup o URL;
- `Attiva` non sincronizza automaticamente;
- `Sincronizza` resta gesto distinto;
- dopo reload/nuova sessione lo stato torna `Non attiva` e serve un solo nuovo tap, senza token;
- errore runtime/origin/sessione scaduta degrada in sicurezza e non modifica dati canonici;
- classi dati e proiezioni LSM-01C restano invariate.

## Consumer contract

Nuovo bootstrap locale:

```ts
export interface SemanticMemorySessionBootstrapResult {
  token: string;
  expiresAt: string;
  health: SemanticMemoryHealthV1;
}

export async function activateSemanticMemorySession(input: {
  endpointUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SemanticMemorySessionBootstrapResult>;
```

La funzione:

1. valida endpoint HTTP loopback con le stesse regole del client attuale;
2. esegue solo dopo gesto utente `POST /v1/session`;
3. usa `credentials: 'omit'`, `cache: 'no-store'`, `redirect: 'error'`, `targetAddressSpace: 'loopback'`;
4. valida schema, token non vuoto, expiry ISO e health v1;
5. non persiste nulla;
6. restituisce la capacità al chiamante che crea il normale `LocalSemanticMemoryPort`.

## Stato UI

`SemanticMemorySessionView` aggiunge `expiresAt: string | null` solo per rappresentazione session-only. Il token non entra nello state serializzabile: resta chiuso nel client conservato in `semanticMemoryPortRef`.

## Errori

- bootstrap network/origin → `Memoria locale non disponibile. Avvia Termux e riprova.`;
- capability scaduta/401 durante sync o search → disconnessione sessione e messaggio `Sessione locale scaduta. Riattiva la memoria locale.`;
- rebuild-required mantiene il comportamento esistente;
- nessun retry automatico di mutazioni o sincronizzazione.

## Mobile

- CTA primaria full width su mobile;
- nessun campo tecnico token;
- endpoint spostabile sotto `Configurazione avanzata` oppure mostrato in sola lettura nel primo incremento;
- nessun FAB sovrapposto alla scheda quando un dialog/modal è aperto;
- copy centrata sull’azione professionale, non sul protocollo.

## Accettazione

1. pagina appena caricata: zero request a `:8765`;
2. tap `Attiva memoria locale`: una bootstrap request, poi health ready già validata;
3. UI `Pronta`, `Sincronizza` attivo;
4. nessun token nel DOM, localStorage, sessionStorage, IndexedDB canonico o backup;
5. sync manuale e ricerca semantica continuano a funzionare;
6. reload: `Non attiva`, zero auto-probe;
7. nuovo tap: `Pronta` senza digitazione;
8. runtime assente: errore chiaro, Biblioteca continua a funzionare senza LSM.

## Non-obiettivi

- auto-start di Termux;
- auto-sync;
- persistenza credenziali;
- accesso LAN;
- modifica alle policy privacy o ai dati ammessi;
- modifica della PR #97 già qualificata.
