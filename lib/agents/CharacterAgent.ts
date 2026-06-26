import type { SimEngine } from "@/lib/sim/engine-interface";
import type { CharacterAgentState } from "@/lib/sim/types";
import { Agent } from "./Agent";
import { CharacterGraph } from "./character-graph";
import type { IdempotencyLedger } from "./idempotency";
import type { MemoryStore } from "./memory";
import type { AdaptiveLimiter } from "./scheduler";
import type {
  CharacterIdentity,
  GraphRunResult,
  HarnessConfig,
  LlmProvider,
} from "./types";

export class CharacterAgent extends Agent {
  constructor(
    public readonly identity: CharacterIdentity,
    public readonly state: CharacterAgentState,
    memory: MemoryStore,
    config: HarnessConfig,
    private engine: SimEngine,
    private limiter: AdaptiveLimiter,
    private ledger: IdempotencyLedger,
    private llm: LlmProvider
  ) {
    super(identity.agentId, "character", memory, config);
  }

  createGraph(): CharacterGraph {
    return new CharacterGraph(this.state, {
      engine: this.engine,
      memory: this.memory,
      limiter: this.limiter,
      ledger: this.ledger,
      llm: this.llm,
      config: this.config,
      identity: this.identity,
    });
  }

  async runAutonomyTick(tick: number): Promise<GraphRunResult> {
    return this.createGraph().runOnce(tick);
  }

  queueRawPerception(text: string, sourceEventId?: string): void {
    this.state.perceptionState.rawQueue.push({
      id: `${this.id}-perception-${Date.now()}`,
      day: this.engine.getState().day,
      timestamp: Date.now(),
      locationId: this.state.currentLocationId,
      locationType: "room",
      text,
      sourceEventId,
    });
  }

  addPendingReply(
    speakerId: string,
    targetId: string,
    sourceSpeechEventId: string,
    deadlineMs: number
  ): void {
    this.state.socialReplyState.pendingReplies.push({
      id: `${speakerId}-reply-${sourceSpeechEventId}`,
      speakerId,
      targetId,
      sourceSpeechEventId,
      deadlineMs,
      createdAt: Date.now(),
      status: "pending",
    });
  }
}
