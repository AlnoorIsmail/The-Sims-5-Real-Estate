import type {
  ActionTargetType,
  ActionVerb,
  BehaviorState,
  CharacterAgentState,
  GoalState,
  MemoryRecordMetadata,
  SimEvent,
  SimTickState,
} from "@/lib/sim/types";
import type { HarnessToolCall } from "./llm/language-model";

export type AgentRole = "character" | "landlord" | "game_master";

export type GraphNodeName =
  | "observe"
  | "retrieve"
  | "perceive_digest"
  | "decide_action"
  | "call_tool"
  | "wait_result"
  | "record_memory"
  | "maybe_reflect";

export interface PersonaCard {
  temperament: string;
  economicPressure: string;
  socialStyle: string;
  housingPreference: string;
  flawOrStressor: string;
}

export type LlmBackend = "gemini" | "openai";

/** Per-agent LLM credentials supplied at instantiation (server-side only). */
export interface CharacterLlmConfig {
  apiKey: string;
  backend?: LlmBackend;
  model?: string;
}

export interface CharacterIdentity {
  agentId: string;
  displayName: string;
  spriteKey: string;
  gender: "male" | "female";
  persona: PersonaCard;
  modifiers?: string[];
  /** Each character agent carries its own provider credentials. */
  llm?: CharacterLlmConfig;
}

export interface EndpointCandidate {
  id: string;
  label: string;
  kind: "character" | "room" | "location" | "door";
}

export interface RelationshipSnapshot {
  otherAgentId: string;
  trust: number;
  affection: number;
  fear: number;
  resentment: number;
  notes: string[];
}

export interface RetrievedMemory {
  id: string;
  document: string;
  metadata: MemoryRecordMetadata;
  score: number;
}

export interface AgentContextBundle {
  systemRules: string;
  identity: CharacterIdentity | LandlordIdentity | GameMasterIdentity;
  visibleWorld: VisibleWorldSlice;
  relationships: RelationshipSnapshot[];
  retrievedMemories: RetrievedMemory[];
  reflections: RetrievedMemory[];
  recentLocalEvents: SimEvent[];
  availableActions: AvailableAction[];
  budgetSummary?: LandlordBudgetSummary;
}

export interface LandlordIdentity {
  agentId: string;
  role: "landlord";
}

export interface GameMasterIdentity {
  agentId: string;
  role: "game_master";
}

export interface VisibleWorldSlice {
  day: number;
  dayPhase: SimTickState["dayPhase"];
  currentLocationId: string;
  currentLocationLabel: string;
  visibleCharacters: EndpointCandidate[];
  reachableRooms: EndpointCandidate[];
  staticEndpoints: EndpointCandidate[];
  nearbyDoors: EndpointCandidate[];
  ownedUnitId?: string;
  movementSummary?: string;
  canEnterTargetRoom?: boolean;
  behavior: BehaviorState;
  goals: GoalState;
  lifecycleState: CharacterAgentState["lifecycleState"];
  rentAccountState: CharacterAgentState["rentAccountState"];
  executionState: CharacterAgentState["executionState"];
  rawPerceptionCount: number;
}

export interface AvailableAction {
  verb: ActionVerb;
  targetType: ActionTargetType;
  description: string;
}

export interface LandlordBudgetSummary {
  budgetAed: number;
  recentCapitalEvents: string[];
  relevantToRequest: boolean;
}

export interface LlmDecision {
  id: string;
  node: GraphNodeName;
  agentId: string;
  output: HarnessToolCall | string | PerceptionDigestOutput | null;
  createdAt: number;
}

export interface BareToolProposal {
  verb: ActionVerb;
  targetType: ActionTargetType;
  targetId: string;
  args: Record<string, unknown>;
}

export interface PerceptionDigestOutput {
  digests: Array<{ rawPerceptionId: string; subjectiveNote: string }>;
}

export interface ReflectionOutput {
  document: string;
  metadata: Partial<MemoryRecordMetadata>;
  goalUpdates?: Partial<GoalState>;
}

// Re-export for harness consumers
export type { HarnessToolCall } from "./llm/language-model";

export interface LandlordActionCard {
  id: string;
  requesterId: string;
  verb: ActionVerb;
  summary: string;
  urgency: "low" | "medium" | "high" | "critical";
  suggestedChoices: string[];
  createdAt: number;
  timeoutMs: number;
  status: "pending" | "answered" | "timed_out";
  userReply?: string;
}

export interface LandlordQueueItem {
  card: LandlordActionCard;
  sourceActionId: string;
  priority: number;
}

export interface GameMasterEventCard {
  id: string;
  scope: "global" | "building" | "location" | "character";
  locationId?: string;
  locationType?: string;
  tags: string[];
  publicText: string;
  privateContext: string;
  affectedMetrics: string[];
}

export interface HarnessConfig {
  mockMode: boolean;
  chromaEnabled: boolean;
  geminiEmbeddingModel: string;
  geminiModel: string;
  openaiModel: string;
  chromaHost: string;
  apiRateLimitPerMinute: number;
  landlordCardTimeoutMs: number;
  speechPatienceMs: number;
  reflectionEventThreshold: number;
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  mockMode: true,
  chromaEnabled: false,
  geminiEmbeddingModel: "gemini-embedding-001",
  geminiModel: "gemini-2.0-flash",
  openaiModel: "gpt-4o-mini",
  chromaHost: "http://localhost:8000",
  apiRateLimitPerMinute: 30,
  landlordCardTimeoutMs: 15_000,
  speechPatienceMs: 8_000,
  reflectionEventThreshold: 7,
};

export interface HarnessOptions {
  initialState?: SimTickState;
  config?: HarnessConfig;
  /** Explicit per-character LLM configs override identity.llm and env resolution. */
  characterLlmConfigs?: Record<string, CharacterLlmConfig>;
  gameMasterLlm?: CharacterLlmConfig;
}

export interface GraphRunResult {
  runId: string;
  agentId: string;
  finalNode: GraphNodeName;
  proposal?: BareToolProposal;
  executionState: CharacterAgentState["executionState"];
  limitedWait: boolean;
}
