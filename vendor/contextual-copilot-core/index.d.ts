export const CAPABILITIES: readonly CapabilityId[];
export const ACTION_RISKS: readonly ActionRisk[];
export const DATA_CLASSES: readonly DataClass[];

export type CapabilityId =
  | 'ASK' | 'SEARCH' | 'OPEN' | 'CREATE' | 'ANNOTATE' | 'SUMMARIZE'
  | 'PREPARE' | 'CONTINUE' | 'REMIND' | 'LINK' | 'IMPORT' | 'REVIEW' | 'EXPLAIN';

export type ActionRisk =
  | 'READ_ONLY' | 'PROPOSE' | 'WRITE_REVERSIBLE' | 'WRITE_EXTERNAL' | 'INSTITUTIONAL_DECISION';

export type DataClass =
  | 'PUBLIC_APP' | 'TEACHER_PROFESSIONAL' | 'CURRICOLO'
  | 'STUDENT_PERSONAL' | 'STUDENT_SENSITIVE' | 'INSTITUTIONAL';

export interface ContextEntity {
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface PrivacyContext {
  dataClasses: readonly DataClass[];
  remoteProviderAllowed: boolean;
  [key: string]: unknown;
}

export interface TemporalContext {
  [key: string]: unknown;
}

export interface ContextSnapshot {
  appId: string;
  surface: string;
  entities: readonly ContextEntity[];
  capabilities: readonly CapabilityId[];
  permissions: readonly string[];
  privacy: PrivacyContext;
  temporal?: TemporalContext;
  state?: string;
}

export interface ContextualAction {
  id: string;
  capability: CapabilityId;
  label: string;
  priority: number;
  risk: ActionRisk;
  requiresGenerativeAI: boolean;
  requiresSemanticSearch: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  humanConfirmationRequired: boolean;
}

export interface PolicyEngine {
  evaluate(input: {
    context: ContextSnapshot;
    action: ContextualAction;
    phase?: 'RESOLVE' | 'DISPATCH';
  }): PolicyDecision | Promise<PolicyDecision>;
}

export interface SemanticRank {
  actionId: string;
  score: number;
}

export interface SemanticPort {
  mode: 'local' | 'remote';
  search?(request: unknown): Promise<unknown>;
  rank?(input: { context: ContextSnapshot; actions: readonly ResolvedAction[] }): Promise<SemanticRank[]>;
}

export interface ResolvedAction extends ContextualAction {
  policy: PolicyDecision;
}

export interface ActionRegistry {
  list(): readonly ContextualAction[];
  get(actionId: string): ContextualAction | null;
}

export interface ContextualCopilotCore {
  resolveActions(context: ContextSnapshot): Promise<readonly ResolvedAction[]>;
  dispatch<TOutput>(input: {
    context: ContextSnapshot;
    actionId: string;
    humanConfirmed?: boolean;
    executor: (input: { context: ContextSnapshot; action: ContextualAction }) => TOutput | Promise<TOutput>;
  }): Promise<
    | { status: 'DENIED'; reason: string }
    | { status: 'HUMAN_CONFIRMATION_REQUIRED'; reason: string }
    | { status: 'EXECUTED'; output: TOutput }
  >;
}

export function validateContextSnapshot(context: ContextSnapshot): ContextSnapshot;
export function createActionRegistry(actions: ContextualAction[]): ActionRegistry;
export function createFailClosedPolicyEngine(options?: {
  generativeMode?: 'none' | 'local' | 'remote';
  externalWriteAllowed?: boolean;
}): PolicyEngine;
export function createContextualCopilotCore(input: {
  registry: ActionRegistry;
  policyEngine: PolicyEngine;
  semanticPort?: SemanticPort | null;
  generativeMode?: 'none' | 'local' | 'remote';
}): ContextualCopilotCore;
