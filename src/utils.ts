import { CompetenceLevel, EvaluationType, Grade, Student, ClassData, UdaRecord, OnlineTest, AppSettings } from './types';

export const STORAGE_KEY = 'registro_docente_data_v35';
export const CUSTOM_TESTS_KEY = 'registro_custom_tests_v1';
export const SETTINGS_KEY = 'registro_settings_v1';
export const UDA_KEY = 'registro_uda_v1';
export const SUBMISSIONS_KEY = 'scuola_verifiche_submissions';
export const META_KEY = 'registro_meta';

export const TYPES_LABEL: Record<EvaluationType, string> = {
  test: 'Test / Quiz',
  verifica: 'Verifica Scritta',
  orale: 'Colloquio Orale',
  disegno: 'Disegno / Grafica',
  osserv: 'Osservazione'
};

export const LEVELS: CompetenceLevel[] = [
  { id: 'AV', label: 'Avanzato (8.5 - 10)', desc: 'Piena autonomia e padronanza complessa', min: 8.5, color: '#10b981', badgeClass: 'badge-ok' },
  { id: 'IN', label: 'Intermedio (7 - 8.4)', desc: 'Autonomia in contesti noti', min: 7.0, color: '#38bdf8', badgeClass: 'badge-info' },
  { id: 'BA', label: 'Base (6 - 6.9)', desc: 'Esecuzione con guida essenziale', min: 6.0, color: '#fbbf24', badgeClass: 'badge-warn' },
  { id: 'PA', label: 'In Via di Prima Acq. (< 6)', desc: 'Necessita di costante supporto e recupero', min: 0.0, color: '#f43f5e', badgeClass: 'badge-bad' }
];

export const BEHAVIOR_OPTIONS = [
  { label: 'Ottimale 🌟', colorClass: 'badge-ok', text: 'Ottimale' },
  { label: 'Costruttivo 👍', colorClass: 'badge-info', text: 'Costruttivo' },
  { label: 'Distratto ⚠️', colorClass: 'badge-warn', text: 'Distratto' },
  { label: 'Disattento ❌', colorClass: 'badge-bad', text: 'Disattento' }
] as const;

export const MONTHS_LABELS: string[] = ['Set', 'Ott', 'Nov', 'Dic', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'];


export const DEFAULT_EVALUATION_WEIGHTS: Record<EvaluationType, number> = {

  verifica: 100, // 100%
  orale: 100,    // 100%
  disegno: 100,  // 100%
  test: 80,      // 80% (formativo)
  osserv: 50     // 50% (osservazione continuativa)
};

export const DEFAULT_EMBEDDING_CONFIG: NonNullable<AppSettings['embeddingConfig']> = {
  provider: 'local',
  endpointUrl: 'http://127.0.0.1:8080',
  modelName: 'models/embeddinggemma-2.gguf',
  apiType: 'llama.cpp',
  apiKey: '',
  enabled: true
};

export const DEFAULT_SETTINGS: AppSettings = {
  school: 'I.C. "Vittorio De Sanctis"',
  year: '2026/2027',
  teacher: 'Prof. Antonio Corsano',
  subject: 'Tecnologia & Disegno Tecnico',
  theme: 'cyan',
  evaluationWeights: DEFAULT_EVALUATION_WEIGHTS,
  useWeightedAverage: true,
  embeddingConfig: DEFAULT_EMBEDDING_CONFIG
};


export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function today(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function sanitizeName(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').replace(/[’`´']/g, "'").replace(/\s+/g, ' ').trim();
}

const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export function getSortableKey(name: string): string {
  return sanitizeName(name).replace(/^\d+[\s.\-)]*/, '').trim();
}

export function formatStudentNameWithPrivacy(name: string, isPrivacyActive: boolean): string {
  if (!isPrivacyActive || !name) return name;
  const parts = sanitizeName(name).split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0].charAt(0)}. ••••`;
  }
  const initials = parts.map(p => `${p.charAt(0).toUpperCase()}.`).join(' ');
  return `${initials} ••••`;
}


export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => collator.compare(getSortableKey(a.name), getSortableKey(b.name)));
}

export function normalizeGrade(raw: string | number): { value: string; delayed: boolean } | null {
  let str = String(raw).trim().toUpperCase().replace(',', '.');
  let hasDelay = false;
  if (str.endsWith('R') || str.endsWith('RIT')) {
    hasDelay = true;
    str = str.replace(/RIT|R/g, '').trim();
  }
  if (['A', 'NC', 'G'].includes(str)) {
    return { value: str, delayed: hasDelay };
  }
  const m = str.match(/^(\d{1,2})(\.\d+)?([+\-½])?$/);
  if (!m) return null;
  const n = parseFloat(m[1] + (m[2] || ''));
  if (n < 0 || n > 10 || (n === 10 && m[3] === '+')) return null;
  return { value: str, delayed: hasDelay };
}

export function parseGrade(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  let str = String(val).toUpperCase().trim().replace(',', '.');
  if (['A', 'NC', 'G'].includes(str)) return null;
  if (str.endsWith('+')) return parseFloat(str) + 0.25;
  if (str.endsWith('-')) return parseFloat(str) - 0.25;
  if (str.includes('½')) return parseFloat(str) + 0.5;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

export function calcAvg(grades: Grade[]): number | null {
  const nums = grades.map(g => parseGrade(g.value)).filter((v): v is number => typeof v === 'number');
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function calcWeightedAvg(
  grades: Grade[],
  weights: Record<EvaluationType, number> = DEFAULT_EVALUATION_WEIGHTS
): number | null {
  let totalWeightedScore = 0;
  let totalWeights = 0;

  grades.forEach(g => {
    const num = parseGrade(g.value);
    if (num !== null && !isNaN(num)) {
      const w = weights[g.type] !== undefined ? weights[g.type] : 100;
      if (w > 0) {
        totalWeightedScore += num * (w / 100);
        totalWeights += w / 100;
      }
    }
  });

  if (totalWeights === 0) return null;
  return totalWeightedScore / totalWeights;
}


export function formatGrade(v: number | string | null | undefined): string {
  if (v == null) return '–';
  if (typeof v === 'number') {
    return isNaN(v) ? '–' : v.toFixed(1).replace('.', ',');
  }
  return String(v);
}

export function getCompetenceLevel(avg: number | null): CompetenceLevel | null {
  if (avg == null || isNaN(avg)) return null;
  if (avg >= 8.5) return LEVELS[0];
  if (avg >= 7.0) return LEVELS[1];
  if (avg >= 6.0) return LEVELS[2];
  return LEVELS[3];
}

export const INITIAL_TESTS: Record<string, OnlineTest> = {
  energia: {
    id: 'energia',
    title: "A cosa serve l'energia",
    category: 'Tecnologia / Energia',
    questions: [
      {
        q: "Circa il 95% dell'energia totale sulla Terra proviene da quale fonte?",
        options: ["Dalla geotermia", "Dalla Terra", "Dal Sole"],
        correct: 2,
        explanation: "Il Sole alimenta il ciclo dell'acqua, i venti e la fotosintesi clorofilliana, costituendo l'origine diretta o indiretta di circa il 95% dell'energia terrestre."
      },
      {
        q: "L'energia elettrica è classificata come una fonte energetica:",
        options: ["Primaria", "Secondaria", "Terziaria"],
        correct: 1,
        explanation: "L'energia elettrica non si trova libera in natura in forma sfruttabile, ma deve essere ottenuta trasformando fonti energetiche primarie."
      },
      {
        q: "Come ottiene elettricità la cella a combustibile?",
        options: ["Facendo reagire idrogeno e ossigeno dell'aria", "Combinando acqua e metano", "Bruciando combustibile fossile"],
        correct: 0,
        explanation: "La cella elettrochimica a combustibile ricombina idrogeno gassoso con l'ossigeno dell'aria, producendo corrente elettrica e vapore acqueo puro come unico scarto."
      },
      {
        q: "L'energia cinetica è associata prevalentemente a:",
        options: ["La posizione di un corpo", "Il calore", "Il movimento di un corpo"],
        correct: 2,
        explanation: "L'energia cinetica è l'energia posseduta da un corpo per effetto del suo movimento (proporzionale alla massa e al quadrato della velocità)."
      },
      {
        q: "Cosa fa girare una turbina generando corrente elettrica nell'alternatore?",
        options: ["Un generatore termico", "L'alternatore stesso tramite magneti", "La forza motrice / fluido in pressione"],
        correct: 2,
        explanation: "Un fluido in pressione (vapore, acqua o vento) investe le pale della turbina trasformando l'energia termica o fluidodinamica in rotazione meccanica."
      },
      {
        q: "Le biomasse sono considerate fonti energetiche:",
        options: ["Rinnovabili", "Non rinnovabili", "Secondarie"],
        correct: 0,
        explanation: "Le biomasse sono rinnovabili purché il prelievo di materiale organico e vegetale rispetti i tempi naturali di ricrescita e riassorbimento di CO2."
      },
      {
        q: "Da dove proviene l'energia geotermica?",
        options: ["Dal calore naturale del sottosuolo terrestre", "Dai pannelli solari termici", "Dalle correnti oceaniche"],
        correct: 0,
        explanation: "L'energia geotermica sfrutta il calore endogeno rilasciato dal nucleo e dal mantello della Terra attraverso gradienti termici e sorgenti idrotermali."
      },
      {
        q: "Nel mercato elettrico, quando si registra solitamente una minore richiesta di energia?",
        options: ["Di giorno, durante le attività lavorative", "Di notte, quando le aziende sono chiuse", "Il lunedì mattina"],
        correct: 1,
        explanation: "Nelle ore notturne la domanda industriale, commerciale e domestica diminuisce drasticamente, determinando una fascia a minor consumo e costo (Fascia F3)."
      },
      {
        q: "Quale grandezza misura il rapporto tra energia ricavata e energia spesa per ottenerla?",
        options: ["LCOH", "EROEI", "BESS"],
        correct: 1,
        explanation: "L'EROEI (Energy Return on Energy Invested) esprime l'efficienza complessiva di una filiera energetica: un EROEI elevato indica un grande guadagno netto di energia."
      },
      {
        q: "Qual è la sequenza corretta del flusso energetico in una centrale tradizionale?",
        options: ["Fonte ➔ Turbina ➔ Alternatore ➔ Trasformatore ➔ Rete", "Alternatore ➔ Turbina ➔ Fonte ➔ Rete", "Rete ➔ Trasformatore ➔ Fonte ➔ Turbina"],
        correct: 0,
        explanation: "L'energia della fonte aziona la turbina (energia meccanica), l'alternatore genera tensione alternata e il trasformatore ne innalza il voltaggio per il trasporto a lungo raggio in rete."
      }
    ]
  },
  materiali: {
    id: 'materiali',
    title: "Materiali, Risorse e Sostenibilità",
    category: 'Tecnologia / Materiali',
    questions: [
      {
        q: "Quale tra questi materiali è un polimero naturale?",
        options: ["Polietilene", "Caucciù / Gomma naturale", "Nylon"],
        correct: 1,
        explanation: "Il caucciù o lattice estratto dall'albero Hevea brasiliensis è un polimero di origine biologica naturale."
      },
      {
        q: "Il riciclo dell'alluminio rispetto alla produzione dal minerale bauxite consente un risparmio energetico fino al:",
        options: ["20%", "50%", "95%"],
        correct: 2,
        explanation: "Rifondere alluminio già lavorato richiede solo il 5% dell'energia necessaria all'elettrolisi iniziale della bauxite (risparmio del 95%)."
      },
      {
        q: "Cosa descrive l'approccio dell'Economia Circolare?",
        options: ["Produrre, usare e gettare in discarica", "Ridurre, riusare, riparare e riciclare", "Utilizzare solo materie prime vergini"],
        correct: 1,
        explanation: "L'economia circolare punta ad azzerare gli scarti mantenendo i materiali nel ciclo produttivo il più a lungo possibile."
      },
      {
        q: "La tenacità di un materiale indica:",
        options: ["La resistenza all'urto senza rompersi", "La capacità di essere ridotto in lamine sottili", "La durezza superficiale contro la scalfittura"],
        correct: 0,
        explanation: "La tenacità è la proprietà meccanica di assorbire colpi ed energia di deformazione senza fratturarsi."
      },
      {
        q: "Quale gas è il principale responsabile dell'effetto serra antropico?",
        options: ["Elio", "Anidride carbonica (CO2)", "Ossigeno"],
        correct: 1,
        explanation: "Le emissioni di CO2 derivanti dalla combustione di combustibili fossili costituiscono oltre il 70% delle emissioni climalteranti complessive."
      }
    ]
  }
};

export const INITIAL_CLASSES: ClassData[] = [
  {
    id: 'cls-3a',
    name: '3ª A - Secondaria I Grado',
    students: [
      { id: 'st-01', name: 'Barone Francesca' },
      { id: 'st-02', name: 'Castoldi Matteo' },
      { id: 'st-03', name: 'De Luca Sofia' },
      { id: 'st-04', name: 'Esposito Leonardo' },
      { id: 'st-05', name: 'Ferrari Giulia' },
      { id: 'st-06', name: 'Galli Christian' },
      { id: 'st-07', name: 'Marino Alessia' },
      { id: 'st-08', name: 'Rizzo Alessandro' }
    ],
    grades: [
      { id: 'g-1', batchId: 'b-1', studentId: 'st-01', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '9', udaId: 'uda-1' },
      { id: 'g-2', batchId: 'b-1', studentId: 'st-02', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '6.5', udaId: 'uda-1' },
      { id: 'g-3', batchId: 'b-1', studentId: 'st-03', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '8.5', udaId: 'uda-1' },
      { id: 'g-4', batchId: 'b-1', studentId: 'st-04', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '5.5', udaId: 'uda-1' },
      { id: 'g-5', batchId: 'b-1', studentId: 'st-05', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '10', udaId: 'uda-1' },
      { id: 'g-6', batchId: 'b-1', studentId: 'st-06', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '7', udaId: 'uda-1' },
      { id: 'g-7', batchId: 'b-1', studentId: 'st-07', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '7.5', udaId: 'uda-1' },
      { id: 'g-8', batchId: 'b-1', studentId: 'st-08', date: '2026-10-05', type: 'test', period: 'Q1', title: "Test Energia e Fonti Rinnovabili", value: '6', udaId: 'uda-1' },

      { id: 'g-9', batchId: 'b-2', studentId: 'st-01', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '9.5', udaId: 'uda-2' },
      { id: 'g-10', batchId: 'b-2', studentId: 'st-02', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '7', udaId: 'uda-2' },
      { id: 'g-11', batchId: 'b-2', studentId: 'st-03', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '8', udaId: 'uda-2' },
      { id: 'g-12', batchId: 'b-2', studentId: 'st-04', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '5', delayed: true, udaId: 'uda-2' },
      { id: 'g-13', batchId: 'b-2', studentId: 'st-05', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '9', udaId: 'uda-2' },
      { id: 'g-14', batchId: 'b-2', studentId: 'st-06', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '6.5', udaId: 'uda-2' },
      { id: 'g-15', batchId: 'b-2', studentId: 'st-07', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '8.5', udaId: 'uda-2' },
      { id: 'g-16', batchId: 'b-2', studentId: 'st-08', date: '2026-10-15', type: 'disegno', period: 'Q1', title: "Proiezioni Ortogonali Solidi Composti", value: '6+', udaId: 'uda-2' }
    ],
    behaviors: [
      { id: 'b-st-01', studentId: 'st-01', date: today(), status: 'Ottimale 🌟' },
      { id: 'b-st-02', studentId: 'st-02', date: today(), status: 'Costruttivo 👍' },
      { id: 'b-st-03', studentId: 'st-03', date: today(), status: 'Ottimale 🌟' },
      { id: 'b-st-04', studentId: 'st-04', date: today(), status: 'Distratto ⚠️' },
      { id: 'b-st-05', studentId: 'st-05', date: today(), status: 'Ottimale 🌟' },
      { id: 'b-st-06', studentId: 'st-06', date: today(), status: 'Costruttivo 👍' },
      { id: 'b-st-07', studentId: 'st-07', date: today(), status: 'Ottimale 🌟' },
      { id: 'b-st-08', studentId: 'st-08', date: today(), status: 'Costruttivo 👍' }
    ]
  },
  {
    id: 'cls-3b',
    name: '3ª B - Secondaria I Grado',
    students: [
      { id: 'st-10', name: 'Bianchi Tommaso' },
      { id: 'st-11', name: 'Colombo Martina' },
      { id: 'st-12', name: 'Fontana Gabriele' },
      { id: 'st-13', name: 'Greco Elena' },
      { id: 'st-14', name: 'Lombardi Marco' },
      { id: 'st-15', name: 'Santoro Camilla' }
    ],
    grades: [
      { id: 'g-20', batchId: 'b-3', studentId: 'st-10', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '8', udaId: 'uda-1' },
      { id: 'g-21', batchId: 'b-3', studentId: 'st-11', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '7.5', udaId: 'uda-1' },
      { id: 'g-22', batchId: 'b-3', studentId: 'st-12', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '6', udaId: 'uda-1' },
      { id: 'g-23', batchId: 'b-3', studentId: 'st-13', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '9', udaId: 'uda-1' },
      { id: 'g-24', batchId: 'b-3', studentId: 'st-14', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '5.5', udaId: 'uda-1' },
      { id: 'g-25', batchId: 'b-3', studentId: 'st-15', date: '2026-10-08', type: 'test', period: 'Q1', title: "Test Energia e Macchine Elettriche", value: '8.5', udaId: 'uda-1' }
    ],
    behaviors: []
  }
];

export const INITIAL_UDAS: UdaRecord[] = [
  {
    id: 'uda-1',
    title: 'UDA 1: Transizione Energetica e Fonti Rinnovabili',
    className: '3ª A',
    hours: 14,
    period: 'Q1',
    startMonth: 0, // Settembre
    durationMonths: 2,
    description: 'Analisi scientifica e tecnologica dei flussi energetici, generazione da fonti rinnovabili e impatto climatico.',
    competencies: 'Competenza in materia di cittadinanza (Agenda 2030), Competenza matematica e competenze in scienze, tecnologie e ingegneria (STEM).',
    authenticTask: 'Progettazione e presentazione di un modello di comunità energetica rinnovabile scolastica con calcolo del risparmio di CO2.',
    rubricLevels: {
      av: 'Piena autonomia nella modellazione dei flussi e argomentazione critica delle soluzioni sostenibili con rigore tecnico.',
      in: 'Analisi corretta delle fonti e buona comprensione dei principi di funzionamento delle centrali.',
      ba: 'Riconoscimento delle principali fonti energetiche e distinzione tra rinnovabili e fossili su guida.',
      pa: 'Comprensione parziale o frammentaria dei concetti di energia e trasformazione, necessita di continuo supporto.'
    },
    lessons: [
      { id: 'les-1', date: '2026-09-18', topic: 'Definizione di energia, lavoro e potenza. Fonti primarie e secondarie', hours: 2 },
      { id: 'les-2', date: '2026-09-25', topic: 'Energia solare termica e fotovoltaica: funzionamento e celle al silicio', hours: 2 },
      { id: 'les-3', date: '2026-10-02', topic: 'Energia eolica e idroelettrica: turbine e alternatori', hours: 2 },
      { id: 'les-4', date: '2026-10-05', topic: 'Sessione di verifica e flashcards formative sul rendimento energetico', hours: 2 }
    ]
  },
  {
    id: 'uda-2',
    title: 'UDA 2: Modellazione Geometrica e Proiezioni Assonometriche',
    className: '3ª A',
    hours: 18,
    period: 'Q1',
    startMonth: 2, // Novembre
    durationMonths: 3,
    description: 'Sviluppo delle competenze grafiche e spaziali attraverso il disegno tecnico manuale e assistito.',
    competencies: 'Consapevolezza ed espressione culturale, Competenze digitali e geometriche applicate.',
    authenticTask: 'Realizzazione di un elaborato tavola tecnica quotata di un prototipo d\'arredo con assonometria isometrica.',
    rubricLevels: {
      av: 'Tratteggio e quotatura impeccabili, visione tridimensionale complessa e rispetto assoluto delle convenzioni UNI.',
      in: 'Esecuzione corretta con precisione grafica adeguata e rispetto delle norme di base.',
      ba: 'Rappresentazione semplice con qualche imprecisione di tratto o scala.',
      pa: 'Difficoltà nella trasposizione spaziale dal 3D al piano bidimensionale.'
    },
    lessons: [
      { id: 'les-20', date: '2026-11-04', topic: 'Richiamo proiezioni ortogonali e introduzione alle terne assonometriche', hours: 2 },
      { id: 'les-21', date: '2026-11-11', topic: 'Assonometria cavaliera rapida e isometrica di solidi piramidali', hours: 2 }
    ],
    dependencies: ['uda-1']
  },
  {
    id: 'uda-3',
    title: 'UDA 3: Sostenibilità dei Materiali ed Economia Circolare',
    className: '3ª B',
    hours: 16,
    period: 'Q2',
    startMonth: 5, // Febbraio
    durationMonths: 2,
    description: 'Ciclo di vita dei materiali tecnologici, riciclo dell\'alluminio, plastiche ed eco-design.',
    competencies: 'Competenza imprenditoriale, Competenza in materia di cittadinanza attiva e transizione ecologica.',
    authenticTask: 'Eco-audit dei materiali utilizzati a scuola e proposta di una linea guida per l\'acquisto circolare.',
    rubricLevels: {
      av: 'Analisi approfondita del ciclo LCA (Life Cycle Assessment) e proposte innovative di riuso.',
      in: 'Comprensione della classificazione dei polimeri e dei processi di riciclo.',
      ba: 'Conoscenza basilare della raccolta differenziata e delle proprietà generali dei metalli.',
      pa: 'Incertezza nell\'individuare le caratteristiche primarie dei materiali.'
    },
    lessons: []
  }
];

