# Operating Rules

Regole stabili del progetto. Applicare tutte le voci `ACTIVE` pertinenti.

## OR-001 — Exact candidate discipline
- Stato: ACTIVE
- Regola: ogni qualificazione deve dichiarare e verificare l'exact candidate SHA. Il checkout o l'ambiente di prova non possono essere assunti equivalenti al candidate senza verifica esplicita.
- Origine: MEM-QUAL-01.

## OR-002 — RED → GREEN causale
- Stato: ACTIVE
- Regola: per modifiche di comportamento o contratti verificabili, ottenere un RED causale prima della correzione e un GREEN sullo stesso contratto dopo la correzione. Un test che non fallisce per la causa attesa non costituisce RED valido.
- Origine: cicli PERSIST-01/PERSIST-01H; formalizzata da MEM-QUAL-01.

## OR-003 — No false PASS
- Stato: ACTIVE
- Regola: un gate non può dichiarare PASS prima del completamento dell'evidenza che pretende di certificare. Failure, timeout, mismatch SHA o readiness incompleta sono FAIL, non warning.
- Origine: MEM-QUAL-01.

## OR-004 — Browser certification environment
- Stato: ACTIVE
- Regola: la certificazione browser canonica usa un runner GitHub effimero e Playwright sull'exact candidate SHA. Sandbox conversazionali o browser manuali possono supportare la diagnosi, ma non sostituiscono la certificazione canonica quando la disponibilità dell'ambiente non è garantita.
- Origine: LL-001.

## OR-005 — Synthetic-only qualification data
- Stato: ACTIVE
- Regola: gate automatici e prove di qualificazione usano dati sintetici e non richiedono dati studente reali, credenziali o secret salvo eccezione esplicitamente autorizzata e documentata.
- Origine: MEM-QUAL-01.

## OR-006 — No automatic merge/deploy from qualification
- Stato: ACTIVE
- Regola: una qualificazione tecnica non autorizza automaticamente merge, deploy o pubblicazione. Queste azioni restano decisioni separate.
- Origine: MEM-QUAL-01.

## OR-007 — Fix the demonstrated cause
- Stato: ACTIVE
- Regola: quando un gate fallisce, correggere la causa dimostrata. Non indebolire asserzioni, trasformare failure in warning o cambiare candidato per ottenere verde.
- Origine: MEM-QUAL-01.

## OR-008 — Memory proportionality
- Stato: ACTIVE
- Regola: aggiornare la memoria episodica solo per integrazioni, incidenti, failure importanti, cambi di architettura/processo o scoperte riutilizzabili. I micro-fix senza apprendimento generalizzabile non richiedono una Memory Capsule.
- Origine: MEM-QUAL-01.

## OR-009 — Branch-before-write for repository contents mutations
- Stato: ACTIVE
- Regola: prima di qualsiasi `create_file`/`update_file`/`delete_file` destinata a un branch non-default, creare il branch, verificarne l'exact base SHA e passare esplicitamente quel branch alla mutation. Non usare `main` come fallback quando il branch target manca o una mutation fallisce.
- Origine: LL-003.
