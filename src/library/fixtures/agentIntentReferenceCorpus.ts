export type AgentIntentExpected =
  | 'REVIEW'
  | 'LINK'
  | 'PREPARE'
  | 'CLARIFY'
  | 'UNSUPPORTED';

export type AgentIntentFixtureClass =
  | 'canonical'
  | 'nominal'
  | 'paraphrase'
  | 'elliptical'
  | 'noisy'
  | 'mixed'
  | 'unsupported';

export interface AgentIntentFixture {
  id: string;
  utterance: string;
  expected: AgentIntentExpected;
  class: AgentIntentFixtureClass;
}

export const AGENT_INTENT_REFERENCE_CORPUS: readonly AgentIntentFixture[] = Object.freeze([
  // PREPARE — include the real production finding verbatim.
  {
    id: 'prepare-real-01',
    utterance: 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica',
    expected: 'PREPARE',
    class: 'nominal'
  },
  { id: 'prepare-canonical-01', utterance: "Prepara un'attività per far capire come funziona una centrale elettrica", expected: 'PREPARE', class: 'canonical' },
  { id: 'prepare-nominal-02', utterance: 'Attività didattica sul funzionamento della centrale elettrica', expected: 'PREPARE', class: 'nominal' },
  { id: 'prepare-paraphrase-01', utterance: 'Vorrei costruire un lavoro per la classe usando questo materiale', expected: 'PREPARE', class: 'paraphrase' },
  { id: 'prepare-paraphrase-02', utterance: 'Come posso trasformare questa fonte in qualcosa da fare durante la lezione?', expected: 'PREPARE', class: 'paraphrase' },
  { id: 'prepare-elliptical-01', utterance: 'Qualcosa di pratico su questo argomento per la prossima lezione', expected: 'PREPARE', class: 'elliptical' },
  { id: 'prepare-elliptical-02', utterance: 'Per questa UDA mi serve un lavoro da far fare agli alunni', expected: 'PREPARE', class: 'elliptical' },
  { id: 'prepare-noisy-01', utterance: 'preparaz attivita x capire centrale elettrica', expected: 'PREPARE', class: 'noisy' },
  { id: 'prepare-noisy-02', utterance: 'mi fai una attivita x la lez di domani con qsta fonte', expected: 'PREPARE', class: 'noisy' },
  { id: 'prepare-noisy-03', utterance: 'progettare attivita classe partendo da questo', expected: 'PREPARE', class: 'noisy' },

  // REVIEW
  { id: 'review-canonical-01', utterance: 'Controlla se questa fonte è adatta alla UDA corrente', expected: 'REVIEW', class: 'canonical' },
  { id: 'review-nominal-01', utterance: 'Valutazione della pertinenza di questo materiale per la lezione', expected: 'REVIEW', class: 'nominal' },
  { id: 'review-paraphrase-01', utterance: 'Secondo il contesto didattico, questo documento ci sta bene?', expected: 'REVIEW', class: 'paraphrase' },
  { id: 'review-elliptical-01', utterance: 'Va bene per quello che stiamo facendo?', expected: 'REVIEW', class: 'elliptical' },
  { id: 'review-noisy-01', utterance: 'qsta fonte va bene x uda?', expected: 'REVIEW', class: 'noisy' },
  { id: 'review-noisy-02', utterance: 'controlla pertinenza materiale classe', expected: 'REVIEW', class: 'noisy' },

  // LINK
  { id: 'link-canonical-01', utterance: 'Collega questa fonte alla UDA corrente', expected: 'LINK', class: 'canonical' },
  { id: 'link-nominal-01', utterance: 'Collegamento del materiale alla lezione di oggi', expected: 'LINK', class: 'nominal' },
  { id: 'link-paraphrase-01', utterance: 'Vorrei conservare questa fonte come riferimento della UDA', expected: 'LINK', class: 'paraphrase' },
  { id: 'link-elliptical-01', utterance: 'Mettila dentro il lavoro didattico che sto facendo', expected: 'LINK', class: 'elliptical' },
  { id: 'link-noisy-01', utterance: 'collega qsta alla uda', expected: 'LINK', class: 'noisy' },
  { id: 'link-noisy-02', utterance: 'associa fonte lez corrente', expected: 'LINK', class: 'noisy' },

  // Ambiguous mixed requests must ask, not guess.
  { id: 'mixed-01', utterance: "Collega questa fonte e prepara un'attività", expected: 'CLARIFY', class: 'mixed' },
  { id: 'mixed-02', utterance: 'Controlla il materiale e poi usalo per una nuova attività', expected: 'CLARIFY', class: 'mixed' },
  { id: 'mixed-03', utterance: 'Vorrei usarla nella UDA, magari preparando qualcosa', expected: 'CLARIFY', class: 'mixed' },
  { id: 'mixed-04', utterance: 'Rivedi e collega questa risorsa', expected: 'CLARIFY', class: 'mixed' },
  { id: 'mixed-05', utterance: 'Prepara oppure collega questa fonte, non so quale sia meglio', expected: 'CLARIFY', class: 'mixed' },
  { id: 'mixed-06', utterance: 'Che possiamo farci con questa fonte?', expected: 'CLARIFY', class: 'mixed' },

  // Understood but not yet executable in this product slice.
  { id: 'unsupported-01', utterance: 'Crea una verifica a scelta multipla da questa fonte', expected: 'UNSUPPORTED', class: 'unsupported' },
  { id: 'unsupported-02', utterance: 'Fammi una presentazione con questo materiale', expected: 'UNSUPPORTED', class: 'unsupported' },
  { id: 'unsupported-03', utterance: 'Riassumi questo articolo', expected: 'UNSUPPORTED', class: 'unsupported' },
  { id: 'unsupported-04', utterance: 'Traduci questa fonte in inglese', expected: 'UNSUPPORTED', class: 'unsupported' },
  { id: 'unsupported-05', utterance: 'Elimina questa fonte dalla biblioteca', expected: 'UNSUPPORTED', class: 'unsupported' },
  { id: 'unsupported-06', utterance: 'Cerca sul web altre fonti simili', expected: 'UNSUPPORTED', class: 'unsupported' }
]);
