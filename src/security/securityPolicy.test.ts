import { describe, expect, test } from 'bun:test';
import {
  evaluateDataFlow,
  sanitizePersistedSettings,
  type DataClassification,
  type DestinationClass
} from './dataClassification';

describe('SEC-0 data flow policy', () => {
  test('denies unknown or sensitive flows by default', () => {
    expect(evaluateDataFlow('STUDENT_PERSONAL', 'RAG_INDEX')).toBe('DENY');
    expect(evaluateDataFlow('STUDENT_PERSONAL', 'REMOTE_PROVIDER')).toBe('DENY');
    expect(evaluateDataFlow('SECRET', 'PLAINTEXT_STORAGE')).toBe('DENY');
    expect(evaluateDataFlow('SECRET', 'STANDARD_BACKUP')).toBe('DENY');
    expect(evaluateDataFlow('SECRET', 'REMOTE_PROVIDER')).toBe('DENY');

    expect(
      evaluateDataFlow('UNKNOWN' as DataClassification, 'UNKNOWN' as DestinationClass)
    ).toBe('DENY');
  });

  test('allows institutional curriculum in the RAG index', () => {
    expect(evaluateDataFlow('INSTITUTIONAL_CURRICULUM', 'RAG_INDEX')).toBe('ALLOW');
  });

  test('strips persisted embedding API keys without mutating input', () => {
    const settings = {
      teacher: 'Docente',
      embeddingConfig: {
        provider: 'local',
        endpointUrl: 'http://127.0.0.1:8080',
        modelName: 'model.gguf',
        apiType: 'llama.cpp',
        enabled: true,
        apiKey: 'secret-token'
      }
    };

    const sanitized = sanitizePersistedSettings(settings);

    expect(sanitized.embeddingConfig?.apiKey).toBeUndefined();
    expect(settings.embeddingConfig.apiKey).toBe('secret-token');
  });
});
