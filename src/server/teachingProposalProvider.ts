import { GoogleGenAI } from '@google/genai';
import type { LibraryProposalRequestV1 } from '../library/teachingProposal';

export interface TeachingProposalProviderInput {
  source: LibraryProposalRequestV1['source'];
  context: LibraryProposalRequestV1['context'];
}

export interface TeachingProposalProvider {
  readonly id: string;
  readonly model: string;
  generate(input: TeachingProposalProviderInput): Promise<unknown>;
}

function buildTeachingProposalPrompt(input: TeachingProposalProviderInput): string {
  const { source, context } = input;
  return `Sei un assistente di progettazione didattica per un docente italiano della scuola secondaria di primo grado.

Devi trasformare una fonte professionale del docente in UNA proposta di attività concreta, utilizzabile nel contesto didattico fornito.

CONTESTO DIDATTICO
- Classe: ${context.className}
- Periodo: ${context.period}
- UDA: ${context.udaTitle}
${context.lessonTopic ? `- Lezione: ${context.lessonTopic}` : ''}
${context.activityType ? `- Tipo di attività: ${context.activityType}` : ''}

FONTE
- Titolo: ${source.title}
${source.text ? `- Contenuto: ${source.text}` : '- Il contenuto è fornito come allegato inline.'}

VINCOLI
- Usa soltanto la fonte e il contesto forniti.
- Non inventare dati sugli studenti, livelli individuali, voti, bisogni personali o osservazioni di classe.
- Proponi un'attività realizzabile e coerente con Tecnologia nella scuola secondaria di primo grado.
- Scrivi in italiano, senza saluti e senza metadiscorso.
- Restituisci esclusivamente JSON valido, senza markdown, con esattamente queste chiavi:
  title, objective, teacherSetup, studentTask, steps, questions, adaptationHint.
- title, objective, teacherSetup, studentTask e adaptationHint devono essere stringhe non vuote.
- steps e questions devono essere array non vuoti di stringhe non vuote.`;
}

function parseProviderJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Il provider non ha restituito contenuto.');
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(withoutFence);
}

export function createGeminiTeachingProposalProvider(apiKey: string | undefined): TeachingProposalProvider {
  const id = 'google-gemini';
  const model = 'gemini-3.8-flash';

  return {
    id,
    model,
    async generate(input) {
      if (!apiKey?.trim()) {
        throw new Error('GEMINI_API_KEY non configurata sul server.');
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const parts: Array<Record<string, unknown>> = [
        { text: buildTeachingProposalPrompt(input) }
      ];
      if (input.source.dataBase64 && input.source.mimeType) {
        parts.push({
          inlineData: {
            mimeType: input.source.mimeType,
            data: input.source.dataBase64
          }
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }] as any
      });

      return parseProviderJson(response.text || '');
    }
  };
}
