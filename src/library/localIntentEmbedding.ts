const VECTOR_DIMENSION = 512;

function normalizeIntentText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function addFeature(vector: number[], feature: string, weight: number): void {
  const hash = fnv1a32(feature);
  const bucket = hash % VECTOR_DIMENSION;
  const sign = (hash & 0x80000000) === 0 ? 1 : -1;
  vector[bucket] += sign * weight;
}

function collectFeatures(normalized: string): Array<readonly [string, number]> {
  const features: Array<readonly [string, number]> = [];
  const words = normalized.split(' ').filter(Boolean);

  for (const word of words) {
    features.push([`w:${word}`, 2]);
  }

  for (let index = 0; index < words.length - 1; index += 1) {
    features.push([`b:${words[index]} ${words[index + 1]}`, 1.5]);
  }

  const compact = ` ${normalized} `;
  for (const size of [3, 4, 5] as const) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      features.push([`c${size}:${compact.slice(index, index + size)}`, 0.35]);
    }
  }

  return features;
}

export async function embedLocalIntentText(text: string): Promise<readonly number[]> {
  if (typeof text !== 'string') {
    throw new TypeError('intent text must be a string');
  }

  const normalized = normalizeIntentText(text);
  if (!normalized) {
    throw new TypeError('intent text must be non-empty after normalization');
  }

  const vector = Array.from({ length: VECTOR_DIMENSION }, () => 0);
  for (const [feature, weight] of collectFeatures(normalized)) {
    addFeature(vector, feature, weight);
  }

  const norm = Math.sqrt(vector.reduce((sum, component) => sum + (component * component), 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new TypeError('local intent embedding norm must be finite and non-zero');
  }

  return Object.freeze(vector.map((component) => component / norm));
}
