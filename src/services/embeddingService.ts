import { LocalEmbeddingConfig } from '../types';
import {
  evaluateDataFlow,
  type DataClassification,
  type DestinationClass
} from '../security/dataClassification';

// In-memory cache for generated embeddings during session
const vectorCache = new Map<string, number[]>();

/**
 * High-precision Cosine Similarity calculation between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export interface EmbeddingTestResult {
  success: boolean;
  latencyMs: number;
  dimensions?: number;
  sampleVector?: number[];
  model?: string;
  error?: string;
  method?: 'direct-client' | 'server-proxy';
}

export interface EmbeddingDataContext {
  classification: DataClassification;
  explicitTeacherOptIn?: boolean;
}

/**
 * Existing embedding features are teacher/curriculum tools. Selecting and enabling
 * Gemini Cloud is treated as the teacher's explicit opt-in for those existing flows.
 * Callers handling a stricter class must pass it explicitly; sensitive classes are
 * denied by evaluateDataFlow regardless of opt-in.
 */
function defaultEmbeddingContext(config: LocalEmbeddingConfig): EmbeddingDataContext {
  return {
    classification: 'TEACHER_PROFESSIONAL',
    explicitTeacherOptIn: config.provider === 'gemini' && config.enabled
  };
}

function assertEmbeddingFlowAllowed(
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext
): void {
  const destination: DestinationClass =
    config.provider === 'gemini' ? 'REMOTE_PROVIDER' : 'LOCAL_PROVIDER';
  const decision = evaluateDataFlow(
    context.classification,
    destination,
    context.explicitTeacherOptIn === true
  );

  if (decision !== 'ALLOW') {
    throw new Error(
      `Flusso dati embedding non consentito: ${context.classification} -> ${destination}.`
    );
  }
}

/**
 * Standard test text for pedagogical and technological context
 */
const TEST_PROMPT = 'Programmazione didattica per competenze D.M. 221/2025 e tecnologia';

/**
 * Normalize endpoint URL by removing trailing slashes
 */
function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function isLoopbackEndpointUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
}

function assertLoopbackLocalEndpoint(config: LocalEmbeddingConfig): void {
  if (config.provider === 'local' && !isLoopbackEndpointUrl(config.endpointUrl)) {
    throw new Error('Endpoint embedding locale non consentito: usare esclusivamente loopback.');
  }
}

function assertSupportedEmbeddingProvider(config: LocalEmbeddingConfig): void {
  const provider: unknown = config.provider;
  if (provider !== 'local' && provider !== 'gemini') {
    throw new Error('Provider embedding non consentito.');
  }
}

/**
 * Attempt to generate an embedding directly from the client (e.g. Termux llama-server on localhost)
 */
async function fetchDirectLocalEmbedding(
  text: string,
  config: LocalEmbeddingConfig
): Promise<{ embedding: number[]; model: string }> {
  const baseUrl = normalizeUrl(config.endpointUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (config.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  // Strategy 1: OpenAI-compatible /v1/embeddings (standard in llama-server, Ollama, LM Studio)
  try {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify({
        input: text,
        model: config.modelName || 'models/embeddinggemma-2.gguf'
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
        return {
          embedding: data.data[0].embedding,
          model: data.model || config.modelName
        };
      }
    }
  } catch (err) {
    // If /v1/embeddings fails, try fallback endpoints
  }

  // Strategy 2: llama.cpp native /embedding endpoint
  try {
    const res = await fetch(`${baseUrl}/embedding`, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify({
        content: text
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embedding)) {
        return {
          embedding: data.embedding,
          model: config.modelName || 'llama.cpp'
        };
      }
      if (Array.isArray(data) && typeof data[0] === 'number') {
        return {
          embedding: data,
          model: config.modelName || 'llama.cpp'
        };
      }
    }
  } catch (err) {
    // Try strategy 3
  }

  // Strategy 3: Ollama native /api/embeddings endpoint
  try {
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify({
        model: config.modelName || 'nomic-embed-text',
        prompt: text
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embedding)) {
        return {
          embedding: data.embedding,
          model: data.model || config.modelName
        };
      }
    }
  } catch (err) {
    // Will throw below
  }

  throw new Error(`Impossibile contattare direttamente ${baseUrl}`);
}

/**
 * Fetch embedding via server-side proxy route (/api/embeddings/generate)
 */
async function fetchProxyEmbedding(
  text: string,
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext
): Promise<{ embedding: number[]; model: string }> {
  const res = await fetch('/api/embeddings/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts: [text],
      config,
      classification: context.classification,
      explicitTeacherOptIn: context.explicitTeacherOptIn === true
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Server proxy error HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.embeddings && data.embeddings.length > 0) {
    return {
      embedding: data.embeddings[0],
      model: data.model || config.modelName
    };
  }

  throw new Error('Nessun vettore restituito dal proxy server');
}

/**
 * Generate embedding for a single text using the configured provider
 */
export async function getEmbedding(
  text: string,
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext = defaultEmbeddingContext(config)
): Promise<number[]> {
  const cleanText = text.trim();
  if (!cleanText) return [];

  assertSupportedEmbeddingProvider(config);
  assertEmbeddingFlowAllowed(config, context);
  assertLoopbackLocalEndpoint(config);

  const cacheKey = `${config.provider}:${config.endpointUrl}:${config.modelName}:${cleanText}`;
  if (vectorCache.has(cacheKey)) {
    return vectorCache.get(cacheKey)!;
  }

  // If Gemini provider is selected, use the server proxy directly
  if (config.provider === 'gemini') {
    const result = await fetchProxyEmbedding(cleanText, config, context);
    vectorCache.set(cacheKey, result.embedding);
    return result.embedding;
  }

  // For Local provider, attempt direct client fetch first (fastest for Termux/localhost)
  try {
    const directResult = await fetchDirectLocalEmbedding(cleanText, config);
    vectorCache.set(cacheKey, directResult.embedding);
    return directResult.embedding;
  } catch (directErr) {
    // Fallback to server proxy
    try {
      const proxyResult = await fetchProxyEmbedding(cleanText, config, context);
      vectorCache.set(cacheKey, proxyResult.embedding);
      return proxyResult.embedding;
    } catch (proxyErr: any) {
      throw new Error(
        `Errore generazione embedding locale: ${directErr instanceof Error ? directErr.message : ''} (Fallback proxy: ${proxyErr?.message || ''})`
      );
    }
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function getEmbeddingsBatch(
  texts: string[],
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext = defaultEmbeddingContext(config)
): Promise<number[][]> {
  const results: number[][] = [];
  for (const t of texts) {
    if (!t.trim()) {
      results.push([]);
      continue;
    }
    const vec = await getEmbedding(t, config, context);
    results.push(vec);
  }
  return results;
}

/**
 * Test connectivity, latency and dimensionality of the configured embedding endpoint
 */
export async function testEmbeddingConnection(
  config: LocalEmbeddingConfig
): Promise<EmbeddingTestResult> {
  const start = performance.now();

  try {
    assertSupportedEmbeddingProvider(config);
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Math.round(performance.now() - start),
      error: err.message || 'Provider embedding non consentito.'
    };
  }

  if (config.provider === 'local') {
    try {
      assertLoopbackLocalEndpoint(config);
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: err.message || 'Endpoint embedding locale non consentito.'
      };
    }
  }

  if (config.provider === 'gemini') {
    try {
      const res = await fetch('/api/embeddings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          prompt: TEST_PROMPT,
          classification: 'PUBLIC_APP',
          explicitTeacherOptIn: true
        })
      });
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok || !data.success) {
        return {
          success: false,
          latencyMs,
          error: data.error || 'Errore nella connessione a Gemini Embeddings'
        };
      }

      return {
        success: true,
        latencyMs,
        dimensions: data.dimensions,
        sampleVector: data.sampleVector,
        model: data.model || 'text-embedding-004',
        method: 'server-proxy'
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: err.message || 'Impossibile completare il test Gemini'
      };
    }
  }

  // Local endpoint test: Try direct fetch first
  try {
    const directRes = await fetchDirectLocalEmbedding(TEST_PROMPT, config);
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: true,
      latencyMs,
      dimensions: directRes.embedding.length,
      sampleVector: directRes.embedding.slice(0, 5),
      model: directRes.model,
      method: 'direct-client'
    };
  } catch (directErr: any) {
    // Attempt fallback via backend server
    try {
      const proxyRes = await fetch('/api/embeddings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          prompt: TEST_PROMPT,
          classification: 'PUBLIC_APP',
          explicitTeacherOptIn: false
        })
      });
      const data = await proxyRes.json();
      const latencyMs = Math.round(performance.now() - start);

      if (proxyRes.ok && data.success) {
        return {
          success: true,
          latencyMs,
          dimensions: data.dimensions,
          sampleVector: data.sampleVector,
          model: data.model,
          method: 'server-proxy'
        };
      }

      return {
        success: false,
        latencyMs,
        error: `Connessione diretta fallita (${directErr.message || 'Network error'}). Anche il proxy server ha segnalato: ${data.error || 'Host non raggiungibile'}. Verifica che './build/bin/llama-server' sia in esecuzione su Termux/PC e che l'indirizzo sia corretto.`
      };
    } catch (proxyErr: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: `Impossibile raggiungere ${config.endpointUrl}: ${directErr.message || ''}. Se usi Termux su Android, assicurati che il comando 'llama-server --embeddings --port 8080' sia attivo.`
      };
    }
  }
}

/**
 * Standard Ministerial Key Competencies (D.M. 221/2025) Descriptors for Semantic Matching
 */
export const MINISTERIAL_COMPETENCY_DESCRIPTORS = [
  {
    id: 'stem',
    name: 'STEM & Metodo Tecnologico',
    code: 'STEM-01',
    description:
      'Scienze, tecnologie, ingegneria, metodo sperimentale, disegno tecnico, progettazione di manufatti, modellazione e problem solving applicato.'
  },
  {
    id: 'digitale',
    name: 'Competenza Digitale & Algoritmi',
    code: 'DIG-02',
    description:
      'Informatica, coding, programmazione a blocchi, pensiero computazionale, sicurezza delle reti, intelligenza artificiale, robotica e uso consapevole dei media.'
  },
  {
    id: 'cittadinanza',
    name: 'Cittadinanza, Sostenibilità & Agenda 2030',
    code: 'CIT-03',
    description:
      'Educazione civica, transizione ecologica, economia circolare, fonti energetiche rinnovabili, sicurezza sul lavoro e tutela del bene comune.'
  },
  {
    id: 'personale',
    name: 'Personale, Sociale e Imparare a Imparare',
    code: 'IMP-04',
    description:
      'Lavoro collaborativo in gruppo, autovalutazione, gestione del tempo di laboratorio, metodo di studio, motivazione e resilienza operativa.'
  },
  {
    id: 'imprenditoriale',
    name: 'Spirito di Iniziativa & Compito di Realtà',
    code: 'IMP-05',
    description:
      'Ideazione e pianificazione di progetti autonomi, realizzazione di prototipi fisici o digitali, trasformazione delle idee in soluzioni pratiche e verificabili.'
  },
  {
    id: 'comunicazione',
    name: 'Comunicazione & Linguaggi Normalizzati',
    code: 'COM-06',
    description:
      'Disegno tecnico normalizzato UNI, proiezioni ortogonali, assonometrie, quotature, scale dimensionali, relazioni tecniche e lessico disciplinare rigoroso.'
  }
];

/**
 * Rank candidate items by semantic cosine similarity against a query
 */
export async function rankBySemanticSimilarity<T extends { id: string; text: string }>(
  query: string,
  candidates: T[],
  config: LocalEmbeddingConfig,
  context: EmbeddingDataContext = defaultEmbeddingContext(config)
): Promise<Array<{ item: T; similarity: number }>> {
  if (!query.trim() || candidates.length === 0) {
    return candidates.map(item => ({ item, similarity: 0 }));
  }

  const queryVector = await getEmbedding(query, config, context);
  if (!queryVector || queryVector.length === 0) {
    return candidates.map(item => ({ item, similarity: 0 }));
  }

  const scored: Array<{ item: T; similarity: number }> = [];

  for (const cand of candidates) {
    try {
      const candVector = await getEmbedding(cand.text, config, context);
      const sim = cosineSimilarity(queryVector, candVector);
      scored.push({ item: cand, similarity: Math.max(0, sim) });
    } catch {
      scored.push({ item: cand, similarity: 0 });
    }
  }

  return scored.sort((a, b) => b.similarity - a.similarity);
}
