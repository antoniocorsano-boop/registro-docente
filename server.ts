import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { evaluateDataFlow, type DataClassification } from './src/security/dataClassification.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

function isRemoteEmbeddingAllowed(
  classification: unknown,
  explicitTeacherOptIn: unknown
): boolean {
  if (typeof classification !== 'string') return false;
  return (
    evaluateDataFlow(
      classification as DataClassification,
      'REMOTE_PROVIDER',
      explicitTeacherOptIn === true
    ) === 'ALLOW'
  );
}

// API: Generate complete UDA description using Gemini
app.post('/api/gemini/generate-uda-description', async (req, res) => {
  try {
    const {
      title,
      durationMonths,
      hours,
      className,
      period,
      civicEducation,
      competencies,
      authenticTask
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Il titolo dell\'UDA è obbligatorio.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'La chiave GEMINI_API_KEY non è configurata nel server. Verifica la sezione Secrets.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const prompt = `Sei un esperto pedagogista e formatore scolastico ministeriale italiano, specializzato nella progettazione di Unità Didattiche di Apprendimento (UDA) per competenze secondo le Linee Guida e il D.M. 221/2025.

Il docente ha impostato la seguente programmazione nel Gantt didattico:
- Titolo UDA: "${title.trim()}"
- Durata temporale nel Gantt: ${durationMonths || 2} mesi
- Monte ore programmato: ${hours || 14} ore
- Classe di destinazione: ${className || 'Scuola secondaria'}
- Quadrimestre: ${period || 'Q1'}
${civicEducation ? '- Include esplicitamente il modulo trasversale di Educazione Civica (L. 92/2019, Agenda 2030, sostenibilità/cittadinanza)' : ''}
${competencies ? `- Competenze chiave indicate: ${competencies}` : ''}
${authenticTask ? `- Compito di realtà previsto: ${authenticTask}` : ''}

Compito:
Sviluppa una traccia testuale completa, organica e professionale per questa Unità Didattica, perfettamente calibrata sul titolo e sulla durata nel Gantt (${hours || 14}h in ${durationMonths || 2} mesi).

Struttura la descrizione nei seguenti punti chiari:
1. **Motivazione Didattica & Premessa**: Perché questa UDA è fondamentale per la fascia d'età e come sviluppa lo spirito critico e tecnologico.
2. **Articolazione Operativa del Percorso (${hours || 14} ore)**: Scansione temporale sintetica delle fasi (es. fase propedeutica di esplorazione, fase laboratoriale/grafica o sperimentale, fase di sintesi e produzione).
3. **Traguardi di Competenza Raggiungibili (D.M. 221/2025)**: Competenze disciplinari e trasversali (STEM, digitale, cittadinanza attiva).
4. **Compito di Realtà & Prodotto Autentico Finale**: Descrizione concreta dell'elaborato o prototipo atteso e modalità di presentazione o condivisione.

Usa un tono professionale, chiaro, rigoroso ed elegante, pronto per essere inserito nella scheda ufficiale dell'UDA e condiviso nel consiglio di classe. Non inserire saluti né preamboli introduttivi.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt
    });

    const generatedText = response.text || '';
    return res.json({ description: generatedText });
  } catch (err: any) {
    console.error('Gemini UDA Generation error:', err);
    return res.status(500).json({
      error: err.message || 'Si è verificato un errore durante la generazione della descrizione dell\'UDA.'
    });
  }
});

// Helper to fetch from local endpoint with timeout
async function fetchLocalEmbedding(baseUrl: string, body: any, headers: Record<string, string> = {}) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // Try /v1/embeddings first
    let res = await fetch(`${cleanUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
        return {
          embeddings: data.data.map((d: any) => d.embedding),
          model: data.model || body.model
        };
      }
    }

    // Fallback to llama.cpp native /embedding
    res = await fetch(`${cleanUrl}/embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ content: Array.isArray(body.input) ? body.input[0] : body.input }),
      signal: controller.signal
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embedding)) {
        return {
          embeddings: [data.embedding],
          model: body.model || 'llama.cpp'
        };
      }
    }

    throw new Error(`Endpoint ${cleanUrl} ha risposto con status ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

// API: Test embedding connectivity (Local llama-server / Ollama / Gemini)
app.post('/api/embeddings/test', async (req, res) => {
  try {
    const {
      config,
      prompt = 'Programmazione didattica per competenze D.M. 221/2025',
      classification,
      explicitTeacherOptIn
    } = req.body;

    if (!config) {
      return res.status(400).json({ error: 'Configurazione mancante.' });
    }

    if (config.provider === 'gemini') {
      if (!isRemoteEmbeddingAllowed(classification, explicitTeacherOptIn)) {
        return res.status(403).json({
          success: false,
          error: 'Flusso dati verso provider remoto non consentito dalla policy SEC-2.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY non configurata sul server.'
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: prompt
      });

      const values = response.embeddings?.[0]?.values || [];
      return res.json({
        success: true,
        dimensions: values.length,
        sampleVector: values.slice(0, 5),
        model: 'text-embedding-004'
      });
    }

    // Local provider (e.g. llama-server on Termux / localhost)
    const endpointUrl = config.endpointUrl || 'http://127.0.0.1:8080';
    const authHeaders: Record<string, string> = {};
    if (config.apiKey?.trim()) {
      authHeaders['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    const result = await fetchLocalEmbedding(
      endpointUrl,
      {
        input: prompt,
        model: config.modelName || 'models/embeddinggemma-2.gguf'
      },
      authHeaders
    );

    const firstVector = result.embeddings[0] || [];
    return res.json({
      success: true,
      dimensions: firstVector.length,
      sampleVector: firstVector.slice(0, 5),
      model: result.model || config.modelName
    });
  } catch (err: any) {
    console.error('Embedding test error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Errore durante la connessione all\'endpoint di embedding.'
    });
  }
});

// API: Batch generate embeddings (Local llama-server or Gemini)
app.post('/api/embeddings/generate', async (req, res) => {
  try {
    const { texts, config, classification, explicitTeacherOptIn } = req.body;
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Array di testi non valido.' });
    }

    if (!config) {
      return res.status(400).json({ error: 'Configurazione mancante.' });
    }

    if (config.provider === 'gemini') {
      if (!isRemoteEmbeddingAllowed(classification, explicitTeacherOptIn)) {
        return res.status(403).json({
          error: 'Flusso dati verso provider remoto non consentito dalla policy SEC-2.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY non configurata.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const embeddings: number[][] = [];
      for (const t of texts) {
        if (!t || !t.trim()) {
          embeddings.push([]);
          continue;
        }
        const resp = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: t
        });
        embeddings.push(resp.embeddings?.[0]?.values || []);
      }

      return res.json({
        embeddings,
        model: 'text-embedding-004'
      });
    }

    // Local provider
    const endpointUrl = config.endpointUrl || 'http://127.0.0.1:8080';
    const authHeaders: Record<string, string> = {};
    if (config.apiKey?.trim()) {
      authHeaders['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    const embeddings: number[][] = [];
    for (const t of texts) {
      if (!t || !t.trim()) {
        embeddings.push([]);
        continue;
      }
      const r = await fetchLocalEmbedding(
        endpointUrl,
        {
          input: t,
          model: config.modelName || 'models/embeddinggemma-2.gguf'
        },
        authHeaders
      );
      embeddings.push(r.embeddings[0] || []);
    }

    return res.json({
      embeddings,
      model: config.modelName
    });
  } catch (err: any) {
    console.error('Embedding generation error:', err);
    return res.status(500).json({
      error: err.message || 'Errore durante la generazione dei vettori di embedding.'
    });
  }
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server avviato su http://0.0.0.0:${PORT}`);
  });
}

start();
