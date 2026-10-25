import type { IntentExampleSet } from '@trama/contextual-copilot-intent-embedding';

export const LIBRARY_INTENT_CATALOG = Object.freeze([
  {
    actionId: 'review-source',
    examples: Object.freeze([
      'rivedi questa fonte nel contesto della programmazione',
      'controlla questo materiale rispetto alla UDA',
      'valuta se questa fonte e adatta alla lezione',
      'esamina il documento rispetto al percorso didattico',
      'fammi una revisione didattica di questa fonte',
    ]),
  },
  {
    actionId: 'link-source-to-uda',
    examples: Object.freeze([
      'collega questa fonte alla UDA',
      'collega questa fonte al lavoro didattico corrente',
      'associa questo materiale alla UDA corrente',
      'aggiungi questa risorsa al percorso didattico',
      'lega questo documento alla programmazione della classe',
      'salva il collegamento tra questa fonte e la UDA',
    ]),
  },
  {
    actionId: 'prepare-from-source',
    examples: Object.freeze([
      'prepara una attivita per questa lezione usando la fonte',
      'crea una proposta didattica a partire da questo materiale',
      'usa questa fonte per preparare una attivita della UDA',
      'trasforma questo materiale in una proposta per la lezione',
      'prepara qualcosa da fare in classe partendo da questa fonte',
    ]),
  },
] satisfies readonly IntentExampleSet[]);
