const DEFAULT_MIN_SIMILARITY = 0.75;
const DEFAULT_MIN_MARGIN = 0.08;

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function validateThreshold(name, value, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be finite and within [${minimum}, ${maximum}]`);
  }
  return value;
}

function snapshotCatalog(intents) {
  if (!Array.isArray(intents)) {
    throw new TypeError('intents must be an array');
  }

  const catalog = new Map();

  for (const intent of intents) {
    if (!intent || typeof intent.actionId !== 'string') {
      throw new TypeError('actionId must be a non-empty string');
    }

    const actionId = normalizeWhitespace(intent.actionId);
    if (!actionId) {
      throw new TypeError('actionId must be a non-empty string');
    }
    if (catalog.has(actionId)) {
      throw new TypeError(`duplicate actionId: ${actionId}`);
    }
    if (!Array.isArray(intent.examples) || intent.examples.length === 0) {
      throw new TypeError(`examples must contain at least one non-empty example for ${actionId}`);
    }

    const examples = intent.examples.map((example) => {
      if (typeof example !== 'string') {
        throw new TypeError(`example must be a string for ${actionId}`);
      }
      const normalized = normalizeWhitespace(example);
      if (!normalized) {
        throw new TypeError(`example must be non-empty for ${actionId}`);
      }
      return normalized;
    });

    catalog.set(actionId, Object.freeze(examples));
  }

  return catalog;
}

function validateEmbeddingVector(vector, expectedDimension = null) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new TypeError('embedding vector must be a non-empty array');
  }
  if (expectedDimension !== null && vector.length !== expectedDimension) {
    throw new TypeError(`embedding vector dimension mismatch: expected ${expectedDimension}, received ${vector.length}`);
  }

  let hasNonZeroComponent = false;
  for (const component of vector) {
    if (typeof component !== 'number' || !Number.isFinite(component)) {
      throw new TypeError('embedding vector components must be finite numbers');
    }
    if (component !== 0) {
      hasNonZeroComponent = true;
    }
  }

  if (!hasNonZeroComponent) {
    throw new TypeError('embedding vector norm must be non-zero');
  }

  return vector;
}

function cosineSimilarity(left, right) {
  let leftScale = 0;
  let rightScale = 0;

  for (let index = 0; index < left.length; index += 1) {
    leftScale = Math.max(leftScale, Math.abs(left[index]));
    rightScale = Math.max(rightScale, Math.abs(right[index]));
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftComponent = left[index] / leftScale;
    const rightComponent = right[index] / rightScale;
    dot += leftComponent * rightComponent;
    leftNorm += leftComponent * leftComponent;
    rightNorm += rightComponent * rightComponent;
  }

  const score = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  if (!Number.isFinite(score)) {
    throw new TypeError('cosine similarity score must be finite');
  }

  return Math.max(-1, Math.min(1, score));
}

async function rankMessageAgainstActions({
  message,
  actions,
  catalog,
  embed,
  minSimilarity,
  minMargin,
}) {
  if (typeof message !== 'string' || !message.trim()) {
    return [];
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return [];
  }

  const eligibleIds = new Set();
  for (const action of actions) {
    if (action && typeof action.id === 'string' && catalog.has(action.id)) {
      eligibleIds.add(action.id);
    }
  }

  if (eligibleIds.size === 0) {
    return [];
  }

  const messageVector = validateEmbeddingVector(await embed(message));
  const matches = [];

  for (const [actionId, examples] of catalog) {
    if (!eligibleIds.has(actionId)) {
      continue;
    }

    let bestScore = -Infinity;
    for (const example of examples) {
      const exampleVector = validateEmbeddingVector(await embed(example), messageVector.length);
      const score = cosineSimilarity(messageVector, exampleVector);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    if (bestScore >= minSimilarity) {
      matches.push({ actionId, score: bestScore });
    }
  }

  matches.sort((left, right) => (
    (right.score - left.score) || left.actionId.localeCompare(right.actionId)
  ));

  if (
    matches.length >= 2
    && (matches[0].score - matches[1].score) < minMargin
  ) {
    return [];
  }

  return matches;
}

export function createEmbeddingIntentPort(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('options are required');
  }
  if (typeof options.embed !== 'function') {
    throw new TypeError('embed must be a function');
  }

  const minSimilarity = validateThreshold(
    'minSimilarity',
    options.minSimilarity ?? DEFAULT_MIN_SIMILARITY,
    -1,
    1,
  );
  const minMargin = validateThreshold(
    'minMargin',
    options.minMargin ?? DEFAULT_MIN_MARGIN,
    0,
    2,
  );
  const catalog = snapshotCatalog(options.intents);

  const rank = (input) => rankMessageAgainstActions({
    message: input?.message,
    actions: input?.actions,
    catalog,
    embed: options.embed,
    minSimilarity,
    minMargin,
  });

  return Object.freeze({
    mode: 'local',
    resolve: rank,
    discover: rank,
  });
}
