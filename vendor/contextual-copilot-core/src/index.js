export const CAPABILITIES = Object.freeze([
  'ASK',
  'SEARCH',
  'OPEN',
  'CREATE',
  'ANNOTATE',
  'SUMMARIZE',
  'PREPARE',
  'CONTINUE',
  'REMIND',
  'LINK',
  'IMPORT',
  'REVIEW',
  'EXPLAIN',
]);

export const ACTION_RISKS = Object.freeze([
  'READ_ONLY',
  'PROPOSE',
  'WRITE_REVERSIBLE',
  'WRITE_EXTERNAL',
  'INSTITUTIONAL_DECISION',
]);

export const DATA_CLASSES = Object.freeze([
  'PUBLIC_APP',
  'TEACHER_PROFESSIONAL',
  'CURRICOLO',
  'STUDENT_PERSONAL',
  'STUDENT_SENSITIVE',
  'INSTITUTIONAL',
]);

const CAPABILITY_SET = new Set(CAPABILITIES);
const RISK_SET = new Set(ACTION_RISKS);
const DATA_CLASS_SET = new Set(DATA_CLASSES);
const PROTECTED_REMOTE_CLASSES = new Set(['STUDENT_PERSONAL', 'STUDENT_SENSITIVE']);
const HUMAN_CONFIRMATION_RISKS = new Set(['WRITE_REVERSIBLE', 'WRITE_EXTERNAL']);
const SEMANTIC_MODES = new Set(['local', 'remote']);
const GENERATIVE_MODES = new Set(['none', 'local', 'remote']);

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertStringArray(value, name) {
  invariant(Array.isArray(value), `${name} must be an array`);
  for (const item of value) invariant(nonEmptyString(item), `${name} must contain non-empty strings`);
}

function createDefensiveContextSnapshot(context) {
  const entities = Object.freeze(context.entities.map((entity) => Object.freeze({ ...entity })));
  const capabilities = Object.freeze([...context.capabilities]);
  const permissions = Object.freeze([...context.permissions]);
  const privacy = Object.freeze({
    ...context.privacy,
    dataClasses: Object.freeze([...context.privacy.dataClasses]),
  });
  const temporal = context.temporal === undefined
    ? undefined
    : Object.freeze({ ...context.temporal });

  return Object.freeze({
    ...context,
    entities,
    capabilities,
    permissions,
    privacy,
    ...(temporal === undefined ? {} : { temporal }),
  });
}

export function validateContextSnapshot(context) {
  invariant(context && typeof context === 'object' && !Array.isArray(context), 'ContextSnapshot must be an object');
  invariant(nonEmptyString(context.appId), 'ContextSnapshot.appId must be a non-empty string');
  invariant(nonEmptyString(context.surface), 'ContextSnapshot.surface must be a non-empty string');
  invariant(Array.isArray(context.entities), 'ContextSnapshot.entities must be an array');
  for (const entity of context.entities) {
    invariant(entity && typeof entity === 'object', 'ContextSnapshot entity must be an object');
    invariant(nonEmptyString(entity.type), 'ContextSnapshot entity type must be a non-empty string');
    invariant(nonEmptyString(entity.id), 'ContextSnapshot entity id must be a non-empty string');
  }
  invariant(Array.isArray(context.capabilities), 'ContextSnapshot.capabilities must be an array');
  for (const capability of context.capabilities) {
    invariant(CAPABILITY_SET.has(capability), `Unknown capability: ${String(capability)}`);
  }
  assertStringArray(context.permissions, 'ContextSnapshot.permissions');
  invariant(context.privacy && typeof context.privacy === 'object' && !Array.isArray(context.privacy), 'ContextSnapshot.privacy is required');
  invariant(Array.isArray(context.privacy.dataClasses), 'ContextSnapshot.privacy.dataClasses must be an array');
  for (const dataClass of context.privacy.dataClasses) {
    invariant(DATA_CLASS_SET.has(dataClass), `Unknown privacy data class: ${String(dataClass)}`);
  }
  invariant(typeof context.privacy.remoteProviderAllowed === 'boolean', 'ContextSnapshot.privacy.remoteProviderAllowed must be boolean');
  if (context.temporal !== undefined) {
    invariant(context.temporal && typeof context.temporal === 'object' && !Array.isArray(context.temporal), 'ContextSnapshot.temporal must be an object');
  }
  if (context.state !== undefined) invariant(typeof context.state === 'string', 'ContextSnapshot.state must be a string');
  return createDefensiveContextSnapshot(context);
}

function validateAction(action) {
  invariant(action && typeof action === 'object' && !Array.isArray(action), 'ContextualAction must be an object');
  invariant(nonEmptyString(action.id), 'ContextualAction.id must be a non-empty string');
  invariant(CAPABILITY_SET.has(action.capability), `Unknown action capability: ${String(action.capability)}`);
  invariant(nonEmptyString(action.label), 'ContextualAction.label must be a non-empty string');
  invariant(Number.isFinite(action.priority), 'ContextualAction.priority must be finite');
  invariant(RISK_SET.has(action.risk), `Unknown action risk: ${String(action.risk)}`);
  invariant(typeof action.requiresGenerativeAI === 'boolean', 'ContextualAction.requiresGenerativeAI must be boolean');
  invariant(typeof action.requiresSemanticSearch === 'boolean', 'ContextualAction.requiresSemanticSearch must be boolean');
  return action;
}

export function createActionRegistry(actions) {
  invariant(Array.isArray(actions), 'actions must be an array');
  const byId = new Map();
  for (const rawAction of actions) {
    const action = Object.freeze({ ...validateAction(rawAction) });
    invariant(!byId.has(action.id), `Duplicate action id: ${action.id}`);
    byId.set(action.id, action);
  }
  return Object.freeze({
    list() {
      return Object.freeze([...byId.values()]);
    },
    get(actionId) {
      return byId.get(actionId) ?? null;
    },
  });
}

export function createFailClosedPolicyEngine(options = {}) {
  const generativeMode = options.generativeMode ?? 'none';
  const externalWriteAllowed = options.externalWriteAllowed ?? false;
  invariant(GENERATIVE_MODES.has(generativeMode), 'generativeMode must be none, local or remote');
  invariant(typeof externalWriteAllowed === 'boolean', 'externalWriteAllowed must be boolean');

  return Object.freeze({
    async evaluate({ context, action }) {
      validateContextSnapshot(context);
      validateAction(action);

      if (!context.capabilities.includes(action.capability)) {
        return { allowed: false, reason: 'CAPABILITY_NOT_DECLARED', humanConfirmationRequired: false };
      }

      if (action.risk === 'INSTITUTIONAL_DECISION') {
        return { allowed: false, reason: 'INSTITUTIONAL_DECISION_REQUIRES_VERTICAL_AUTHORITY', humanConfirmationRequired: true };
      }

      if (action.risk === 'WRITE_EXTERNAL' && !externalWriteAllowed) {
        return { allowed: false, reason: 'EXTERNAL_WRITE_NOT_AUTHORIZED', humanConfirmationRequired: true };
      }

      if (action.requiresGenerativeAI) {
        if (generativeMode === 'none') {
          return { allowed: false, reason: 'GENERATIVE_PROVIDER_UNAVAILABLE', humanConfirmationRequired: false };
        }
        if (generativeMode === 'remote') {
          if (!context.privacy.remoteProviderAllowed) {
            return { allowed: false, reason: 'REMOTE_PROVIDER_NOT_AUTHORIZED', humanConfirmationRequired: false };
          }
          if (context.privacy.dataClasses.some((dataClass) => PROTECTED_REMOTE_CLASSES.has(dataClass))) {
            return { allowed: false, reason: 'PROTECTED_DATA_REMOTE_DENIED', humanConfirmationRequired: false };
          }
        }
      }

      return {
        allowed: true,
        reason: 'ALLOWED',
        humanConfirmationRequired: HUMAN_CONFIRMATION_RISKS.has(action.risk),
      };
    },
  });
}

function scoreMapFromRanked(ranked, allowedIds) {
  if (!Array.isArray(ranked)) return new Map();
  const scores = new Map();
  for (const item of ranked) {
    if (!item || !allowedIds.has(item.actionId) || !Number.isFinite(item.score)) continue;
    const previous = scores.get(item.actionId);
    if (previous === undefined || item.score > previous) scores.set(item.actionId, item.score);
  }
  return scores;
}

export function createContextualCopilotCore({ registry, policyEngine, semanticPort = null, generativeMode = 'none' }) {
  invariant(registry && typeof registry.list === 'function' && typeof registry.get === 'function', 'registry must implement list() and get()');
  invariant(policyEngine && typeof policyEngine.evaluate === 'function', 'policyEngine.evaluate is required');
  invariant(GENERATIVE_MODES.has(generativeMode), 'generativeMode must be none, local or remote');
  if (semanticPort !== null) {
    invariant(typeof semanticPort === 'object', 'semanticPort must be an object or null');
    invariant(SEMANTIC_MODES.has(semanticPort.mode), 'semanticPort.mode must be local or remote');
  }

  function coreRiskGuard(action) {
    if (action.risk === 'INSTITUTIONAL_DECISION') {
      return {
        allowed: false,
        reason: 'INSTITUTIONAL_DECISION_REQUIRES_VERTICAL_AUTHORITY',
        humanConfirmationRequired: true,
      };
    }
    return {
      allowed: true,
      reason: 'ALLOWED',
      humanConfirmationRequired: HUMAN_CONFIRMATION_RISKS.has(action.risk),
    };
  }

  function coreGenerativePrivacyGuard(context, action) {
    if (!action.requiresGenerativeAI) {
      return { allowed: true, reason: 'ALLOWED', humanConfirmationRequired: false };
    }
    if (generativeMode === 'none') {
      return { allowed: false, reason: 'GENERATIVE_PROVIDER_UNAVAILABLE', humanConfirmationRequired: false };
    }
    if (generativeMode === 'remote') {
      if (!context.privacy.remoteProviderAllowed) {
        return { allowed: false, reason: 'REMOTE_PROVIDER_NOT_AUTHORIZED', humanConfirmationRequired: false };
      }
      if (context.privacy.dataClasses.some((dataClass) => PROTECTED_REMOTE_CLASSES.has(dataClass))) {
        return { allowed: false, reason: 'PROTECTED_DATA_REMOTE_DENIED', humanConfirmationRequired: false };
      }
    }
    return { allowed: true, reason: 'ALLOWED', humanConfirmationRequired: false };
  }

  async function evaluate(context, action, phase) {
    const riskGuard = coreRiskGuard(action);
    if (!riskGuard.allowed) return riskGuard;
    const privacyGuard = coreGenerativePrivacyGuard(context, action);
    if (!privacyGuard.allowed) return privacyGuard;
    try {
      const decision = await policyEngine.evaluate({ context, action, phase });
      invariant(decision && typeof decision.allowed === 'boolean', 'Policy decision must include allowed');
      return {
        allowed: decision.allowed,
        reason: nonEmptyString(decision.reason) ? decision.reason : (decision.allowed ? 'ALLOWED' : 'DENIED'),
        humanConfirmationRequired: riskGuard.humanConfirmationRequired || Boolean(decision.humanConfirmationRequired),
      };
    } catch {
      return { allowed: false, reason: 'POLICY_EVALUATION_FAILED', humanConfirmationRequired: riskGuard.humanConfirmationRequired };
    }
  }

  function semanticAccess(context) {
    if (!semanticPort) return { allowed: false, reason: 'SEMANTIC_PORT_UNAVAILABLE' };
    if (semanticPort.mode === 'remote') {
      if (!context.privacy.remoteProviderAllowed) {
        return { allowed: false, reason: 'REMOTE_PROVIDER_NOT_AUTHORIZED' };
      }
      if (context.privacy.dataClasses.some((dataClass) => PROTECTED_REMOTE_CLASSES.has(dataClass))) {
        return { allowed: false, reason: 'PROTECTED_DATA_REMOTE_DENIED' };
      }
    }
    return { allowed: true, reason: 'ALLOWED' };
  }

  function deterministicOrder(actions) {
    return Object.freeze([...actions].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)));
  }

  return Object.freeze({
    async resolveActions(rawContext) {
      const context = validateContextSnapshot(rawContext);
      const candidates = registry.list().filter((action) => context.capabilities.includes(action.capability));
      const allowed = [];
      const semantic = semanticAccess(context);

      for (const action of candidates) {
        if (action.requiresSemanticSearch && (!semantic.allowed || typeof semanticPort?.search !== 'function')) continue;
        const policy = await evaluate(context, action, 'RESOLVE');
        if (policy.allowed) allowed.push(Object.freeze({ ...action, policy }));
      }

      if (!semantic.allowed || typeof semanticPort?.rank !== 'function' || allowed.length < 2) {
        return deterministicOrder(allowed);
      }

      let ranked;
      try {
        ranked = await semanticPort.rank({ context, actions: Object.freeze([...allowed]) });
      } catch {
        return deterministicOrder(allowed);
      }
      const allowedIds = new Set(allowed.map((action) => action.id));
      const scores = scoreMapFromRanked(ranked, allowedIds);

      return Object.freeze([...allowed].sort((a, b) => {
        const aRanked = scores.has(a.id);
        const bRanked = scores.has(b.id);
        if (aRanked && bRanked) return scores.get(b.id) - scores.get(a.id) || b.priority - a.priority || a.id.localeCompare(b.id);
        if (aRanked) return -1;
        if (bRanked) return 1;
        return b.priority - a.priority || a.id.localeCompare(b.id);
      }));
    },

    async dispatch({ context: rawContext, actionId, executor, humanConfirmed = false }) {
      const context = validateContextSnapshot(rawContext);
      invariant(nonEmptyString(actionId), 'actionId must be a non-empty string');
      invariant(typeof executor === 'function', 'executor must be a function');
      const action = registry.get(actionId);

      if (!action || !context.capabilities.includes(action.capability)) {
        return Object.freeze({ status: 'DENIED', reason: 'CAPABILITY_NOT_DECLARED' });
      }
      if (action.requiresSemanticSearch) {
        const semantic = semanticAccess(context);
        if (!semantic.allowed) return Object.freeze({ status: 'DENIED', reason: semantic.reason });
        if (typeof semanticPort?.search !== 'function') {
          return Object.freeze({ status: 'DENIED', reason: 'SEMANTIC_PORT_UNAVAILABLE' });
        }
      }

      const policy = await evaluate(context, action, 'DISPATCH');
      if (!policy.allowed) return Object.freeze({ status: 'DENIED', reason: policy.reason });
      if (policy.humanConfirmationRequired && !humanConfirmed) {
        return Object.freeze({ status: 'HUMAN_CONFIRMATION_REQUIRED', reason: policy.reason });
      }

      const output = await executor({ context, action });
      return Object.freeze({ status: 'EXECUTED', output });
    },
  });
}
