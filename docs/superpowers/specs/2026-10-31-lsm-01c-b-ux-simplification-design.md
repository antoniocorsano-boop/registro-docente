# LSM-01C-B — Semplificazione UX Biblioteca/Copilota

## Intento

Ridurre il percorso fonte → uso didattico → preparazione senza modificare i vincoli già qualificati di privacy, consenso, memoria semantica locale e autorità dei dati. Il docente deve ragionare in termini di materiale, contesto e azione, non di stati tecnici del Copilota.

## Flusso target

**Fonte → Usa → Dove vuoi usarla? → Cosa vuoi fare? → eventuale classificazione → azione**

La classificazione professionale è una proprietà della fonte e non richiede l'ingresso in un flusso di preparazione remota.

## Scheda della fonte

La scheda espone uno stato comprensibile:

- **Da classificare** — fonte acquisita ma non ancora autorizzata come materiale professionale;
- **Professionale** — fonte utilizzabile nei flussi didattici e sincronizzabile con LSM;
- **Da rivedere** — fonte non utilizzabile fino a una decisione esplicita.

Per una fonte `Da classificare`, **Gestisci** espone direttamente `Classifica come materiale professionale`.

La classificazione:

- è esclusivamente locale;
- non invia nulla a servizi remoti;
- richiede conferma che la fonte non contenga dati personali degli studenti;
- aggiorna immediatamente lo stato della fonte.

## Usa questo materiale

Toccando **Usa**, su mobile si apre una superficie a tutto schermo. Non compare immediatamente il Copilota conversazionale.

Il primo blocco è **Dove vuoi usarlo?**. Se esiste un solo contesto plausibile, viene proposto e può essere cambiato. Se ne esistono più di uno, il docente usa un singolo selettore che combina classe e UDA. Classe e UDA restano distinte nel modello dati ma non vengono richieste come due decisioni consecutive.

## Azioni principali

Dopo il contesto vengono mostrate tre sole azioni:

- **Prepara un'attività** — usa il materiale come base per una proposta didattica;
- **Rivedi nel contesto** — valuta pertinenza e possibile utilizzo rispetto alla UDA;
- **Collega alla UDA** — registra il collegamento tra fonte e contesto.

Il campo `Descrivi meglio cosa vuoi ottenere` resta facoltativo e compare solo dopo la scelta dell'azione.

## Classificazione contestuale

Se un'azione richiede una fonte professionale e la fonte è ancora `Da classificare`, lo stesso pannello mostra `Prima di continuare` con `Classifica come materiale professionale` e la conferma: `Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.`

Dopo la classificazione, il flusso prosegue automaticamente con l'azione già scelta. Non torna all'inizio e non richiede un secondo `Continua`.

## Preparazione assistita

Solo dopo le scelte locali compare **Preparazione assistita**. Deve essere evidente la separazione tra operazioni locali già effettuate e operazione remota eventuale. Il consenso remoto resta sempre esplicito. Se il servizio remoto non è disponibile, il percorso locale resta intatto.

## Mobile

Sotto la soglia mobile il Copilota diventa una pagina modale a tutto schermo:

- intestazione fissa;
- contenuto con un solo scorrimento;
- azione primaria fissa in basso;
- FAB Copilota nascosto durante l'apertura;
- controlli flottanti secondari nascosti;
- navigazione inferiore non concorrente;
- pulsanti principali a tutta larghezza;
- una sola azione primaria visibile per stato;
- nessun doppio `Continua`.

## Ricerca semantica e LSM

La Biblioteca mantiene `Ricerca per significato`. La gestione tecnica di LSM resta in `Impostazioni → Memoria semantica locale`. Dopo una modifica a una fonte professionale, le Impostazioni possono mostrare `1 elemento da sincronizzare`. La sincronizzazione resta sempre esplicita.

## Vincoli invariati

- Biblioteca e Memoria professionale restano canoniche;
- LSM resta un indice derivato e ricostruibile;
- nessun dato studente;
- token solo di sessione;
- nessun collegamento automatico all'avvio;
- nessun invio remoto senza consenso;
- nessun collegamento automatico fonte-UDA;
- nessun salvataggio automatico di proposte generate.

## Criteri di accettazione

Su mobile il percorso deve essere:

**Fonte → Usa → contesto → Prepara un'attività → eventuale classificazione → Preparazione assistita**

Il docente non deve:

- selezionare separatamente classe e UDA quando esiste già un contesto univoco;
- entrare nel Copilota per classificare una fonte;
- incontrare due pulsanti `Continua` nello stesso stato;
- vedere FAB o controlli flottanti sovrapposti al pannello;
- ripetere una scelta già effettuata;
- comprendere stati interni del motore per completare il percorso.

## Strategia di consegna

La PR #93 resta congelata sul candidato qualificato `b4ab11e53fe6405f4947db11c541a48df34125f3`. LSM-01C-B parte da quella baseline e interviene sulla superficie Biblioteca/Copilota e sui relativi contratti UX. Prima dell'eventuale integrazione sono richiesti contratti RED → GREEN, regressione A4-R1, regressione LSM-01C, verifica responsive mobile e nuova Human Visual / Design Review.