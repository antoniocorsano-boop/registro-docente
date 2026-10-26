export type LibraryIntentExpected =
  | 'review-source'
  | 'link-source-to-uda'
  | 'prepare-from-source'
  | 'NO_INTENT_MATCH';

export type LibraryIntentFixtureClass =
  | 'canonical'
  | 'paraphrase'
  | 'noisy'
  | 'mixed'
  | 'hard-negative'
  | 'oos';

export interface LibraryIntentFixture {
  id: string;
  utterance: string;
  expected: LibraryIntentExpected;
  class: LibraryIntentFixtureClass;
}

export const LIBRARY_INTENT_REFERENCE_CORPUS: readonly LibraryIntentFixture[] = Object.freeze([
  // REVIEW — 12
  { id: 'review-canonical-01', utterance: 'rivedi questa fonte nel contesto della programmazione', expected: 'review-source', class: 'canonical' },
  { id: 'review-canonical-02', utterance: 'controlla questo materiale rispetto alla UDA', expected: 'review-source', class: 'canonical' },
  { id: 'review-paraphrase-01', utterance: 'dimmi se questa fonte è coerente con la lezione che sto preparando', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-paraphrase-02', utterance: 'verifica se questo documento è adatto al percorso didattico', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-paraphrase-03', utterance: 'controlla la pertinenza di questo materiale per la classe', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-paraphrase-04', utterance: 'valuta questo articolo rispetto agli obiettivi della UDA', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-paraphrase-05', utterance: 'esamina questa risorsa nel contesto didattico', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-paraphrase-06', utterance: 'vorrei una revisione didattica di questa fonte', expected: 'review-source', class: 'paraphrase' },
  { id: 'review-noisy-01', utterance: 'rivedi qsta fonte x la uda', expected: 'review-source', class: 'noisy' },
  { id: 'review-noisy-02', utterance: 'controlla materiale rispetto uda', expected: 'review-source', class: 'noisy' },
  { id: 'review-noisy-03', utterance: 'va bene questa fonte x lezione?', expected: 'review-source', class: 'noisy' },
  { id: 'review-noisy-04', utterance: 'revisiona sta fonte per il percorso', expected: 'review-source', class: 'noisy' },

  // LINK — 12
  { id: 'link-canonical-01', utterance: 'collega questa fonte alla UDA', expected: 'link-source-to-uda', class: 'canonical' },
  { id: 'link-canonical-02', utterance: 'salva il collegamento tra questa fonte e la UDA', expected: 'link-source-to-uda', class: 'canonical' },
  { id: 'link-paraphrase-01', utterance: 'associa questo articolo alla programmazione corrente', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-paraphrase-02', utterance: 'metti questa risorsa nella UDA che sto usando', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-paraphrase-03', utterance: 'lega il documento alla lezione corrente', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-paraphrase-04', utterance: 'voglio collegare questo materiale al percorso della classe', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-paraphrase-05', utterance: 'aggiungi la fonte come riferimento della UDA', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-paraphrase-06', utterance: 'registra questa fonte dentro la programmazione', expected: 'link-source-to-uda', class: 'paraphrase' },
  { id: 'link-noisy-01', utterance: 'collega qsta fonte alla uda', expected: 'link-source-to-uda', class: 'noisy' },
  { id: 'link-noisy-02', utterance: 'associa materiale a uda corrente', expected: 'link-source-to-uda', class: 'noisy' },
  { id: 'link-noisy-03', utterance: 'mettila nella programmaz della classe', expected: 'link-source-to-uda', class: 'noisy' },
  { id: 'link-noisy-04', utterance: 'lega sta risorsa alla lezione', expected: 'link-source-to-uda', class: 'noisy' },

  // PREPARE — 12
  { id: 'prepare-canonical-01', utterance: 'crea una proposta didattica a partire da questo materiale', expected: 'prepare-from-source', class: 'canonical' },
  { id: 'prepare-canonical-02', utterance: 'prepara una attivita per questa lezione usando la fonte', expected: 'prepare-from-source', class: 'canonical' },
  { id: 'prepare-paraphrase-01', utterance: "costruisci un'attività per la classe partendo da questa fonte", expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-paraphrase-02', utterance: "usa questo articolo per progettare un'attività della UDA", expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-paraphrase-03', utterance: 'fammi una proposta per lavorare in classe con questo materiale', expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-paraphrase-04', utterance: "trasforma questa risorsa in un'attività per la prossima lezione", expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-paraphrase-05', utterance: 'prepara un lavoro didattico basato su questo documento', expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-paraphrase-06', utterance: 'da questa fonte prepara qualcosa da fare con gli studenti', expected: 'prepare-from-source', class: 'paraphrase' },
  { id: 'prepare-noisy-01', utterance: 'prepara attivita con qsta fonte', expected: 'prepare-from-source', class: 'noisy' },
  { id: 'prepare-noisy-02', utterance: 'crea proposta x lezione da questo materiale', expected: 'prepare-from-source', class: 'noisy' },
  { id: 'prepare-noisy-03', utterance: 'fammi attivita per uda con sta risorsa', expected: 'prepare-from-source', class: 'noisy' },
  { id: 'prepare-noisy-04', utterance: 'trasforma qsto in lavoro x classe', expected: 'prepare-from-source', class: 'noisy' },

  // MIXED — 12, always abstain
  { id: 'mixed-01', utterance: "collega questa fonte alla UDA e prepara un'attività", expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-02', utterance: 'rivedi questa fonte e poi collegala alla lezione', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-03', utterance: 'controlla il materiale e prepara una proposta', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-04', utterance: 'associa la fonte alla UDA e fammi una revisione', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-05', utterance: 'prepara una attività e salva il collegamento alla programmazione', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-06', utterance: 'rivedi e prepara questa fonte per la classe', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-07', utterance: 'collega e prepara questa fonte', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-08', utterance: 'controlla e associa questo documento alla UDA', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-09', utterance: 'prepara e collega qsta risorsa', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-10', utterance: 'rivedi + collega questa fonte', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-11', utterance: 'valuta questa fonte e crea una proposta didattica', expected: 'NO_INTENT_MATCH', class: 'mixed' },
  { id: 'mixed-12', utterance: 'lega alla UDA e controlla se va bene', expected: 'NO_INTENT_MATCH', class: 'mixed' },

  // OOS / HARD NEGATIVE — 20, always abstain
  { id: 'oos-summary-01', utterance: 'riassumi questa fonte', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-summary-02', utterance: 'fammi una sintesi di questo articolo', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-summary-03', utterance: 'estrai i punti principali dal documento', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-summary-04', utterance: 'dimmi in breve cosa contiene questa fonte', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-delete-01', utterance: 'elimina questa fonte', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-delete-02', utterance: 'rimuovi il documento dalla biblioteca', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-delete-03', utterance: 'cancella questa risorsa', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-ask-01', utterance: 'cosa dice questa fonte?', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-ask-02', utterance: 'spiegami questo articolo', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-ask-03', utterance: 'rispondi a una domanda usando questa fonte', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'oos-ask-04', utterance: 'che ne pensi di questo documento?', expected: 'NO_INTENT_MATCH', class: 'oos' },
  { id: 'hard-create-01', utterance: 'crea una verifica a scelta multipla da questa fonte', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-create-02', utterance: 'genera una presentazione usando questo materiale', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-create-03', utterance: 'scrivi una circolare usando questo documento', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-create-04', utterance: 'crea una rubrica di valutazione da questo materiale', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-adjacent-01', utterance: 'traduci questa fonte in inglese', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-adjacent-02', utterance: 'cerca altre fonti simili a questa', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-adjacent-03', utterance: 'condividi questa fonte con i colleghi', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-adjacent-04', utterance: 'scarica questa fonte in pdf', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
  { id: 'hard-adjacent-05', utterance: 'dammi tre domande su questa fonte', expected: 'NO_INTENT_MATCH', class: 'hard-negative' },
]);
