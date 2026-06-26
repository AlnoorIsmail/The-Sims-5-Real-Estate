import type { SimTickState } from "@/lib/sim/types";
import type {
  AgentContextBundle,
  BareToolProposal,
  GameMasterEventCard,
  LlmProvider,
  PerceptionDigestOutput,
  ReflectionOutput,
} from "./types";

/** Throws if called while mock mode is off and no real provider is wired. */
export class UnconfiguredLlmProvider implements LlmProvider {
  async proposeAction(_context: AgentContextBundle): Promise<BareToolProposal> {
    throw new Error("LLM provider not configured. Enable mockMode for demo.");
  }
  async digestPerceptions(
    _context: AgentContextBundle,
    _rawTexts: string[]
  ): Promise<PerceptionDigestOutput> {
    throw new Error("LLM provider not configured. Enable mockMode for demo.");
  }
  async reflect(_context: AgentContextBundle): Promise<ReflectionOutput> {
    throw new Error("LLM provider not configured. Enable mockMode for demo.");
  }
  async generateMorningBrief(
    _state: SimTickState,
    card: GameMasterEventCard
  ): Promise<string> {
    return `Morning brief: ${card.publicText}`;
  }
  async generateDaySummary(
    _state: SimTickState,
    events: SimTickState["eventLog"]
  ): Promise<string> {
    return `Day summary: ${events.length} events recorded.`;
  }
}

export function createLlmProvider(mockMode: boolean): LlmProvider {
  if (mockMode) {
    return new UnconfiguredLlmProvider();
  }
  return new UnconfiguredLlmProvider();
}
