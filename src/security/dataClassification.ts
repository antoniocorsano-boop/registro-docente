export type DataClassification =
  | 'PUBLIC_APP'
  | 'INSTITUTIONAL_CURRICULUM'
  | 'TEACHER_PROFESSIONAL'
  | 'STUDENT_PERSONAL'
  | 'SECRET';

export type DestinationClass =
  | 'PLAINTEXT_STORAGE'
  | 'RAG_INDEX'
  | 'LOCAL_PROVIDER'
  | 'REMOTE_PROVIDER'
  | 'STANDARD_BACKUP';

export type DataFlowDecision = 'ALLOW' | 'DENY';

const KNOWN_CLASSIFICATIONS = new Set<DataClassification>([
  'PUBLIC_APP',
  'INSTITUTIONAL_CURRICULUM',
  'TEACHER_PROFESSIONAL',
  'STUDENT_PERSONAL',
  'SECRET'
]);

const KNOWN_DESTINATIONS = new Set<DestinationClass>([
  'PLAINTEXT_STORAGE',
  'RAG_INDEX',
  'LOCAL_PROVIDER',
  'REMOTE_PROVIDER',
  'STANDARD_BACKUP'
]);

export function evaluateDataFlow(
  classification: DataClassification,
  destination: DestinationClass,
  explicitTeacherOptIn = false
): DataFlowDecision {
  if (!KNOWN_CLASSIFICATIONS.has(classification) || !KNOWN_DESTINATIONS.has(destination)) {
    return 'DENY';
  }

  if (classification === 'SECRET' || classification === 'STUDENT_PERSONAL') {
    return 'DENY';
  }

  if (destination === 'REMOTE_PROVIDER') {
    return explicitTeacherOptIn ? 'ALLOW' : 'DENY';
  }

  if (classification === 'PUBLIC_APP') {
    return destination === 'RAG_INDEX' ? 'DENY' : 'ALLOW';
  }

  if (classification === 'INSTITUTIONAL_CURRICULUM') {
    return 'ALLOW';
  }

  if (classification === 'TEACHER_PROFESSIONAL') {
    return destination === 'PLAINTEXT_STORAGE' ? 'DENY' : 'ALLOW';
  }

  return 'DENY';
}

export function sanitizePersistedSettings<
  T extends { embeddingConfig?: { apiKey?: string } }
>(settings: T): T {
  if (!settings.embeddingConfig) {
    return { ...settings };
  }

  const { apiKey: _apiKey, ...safeEmbeddingConfig } = settings.embeddingConfig;

  return {
    ...settings,
    embeddingConfig: safeEmbeddingConfig
  } as T;
}
