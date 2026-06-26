import type { SimEngine } from "@/lib/sim/engine-interface";
import type { BareToolAction, CharacterAgentState } from "@/lib/sim/types";
import { assembleCharacterContext, buildRetrievalQuery } from "./context";
import { IdempotencyLedger, makeLedgerId } from "./idempotency";
import type { MemoryStore } from "./memory";
import { idleProposal, mockProposeAction, toBareToolAction } from "./mock-proposals";
import {
  AdaptiveLimiter,
  sceneScoreForCharacter,
  setExecutionState,
} from "./scheduler";
import type {
  AgentContextBundle,
  BareToolProposal,
  CharacterIdentity,
  GraphNodeName,
  GraphRunResult,
  HarnessConfig,
  LlmProvider,
} from "./types";
import { getVerbRule, isValidBareTool } from "./verbs";

export interface CharacterGraphDeps {
  engine: SimEngine;
  memory: MemoryStore;
  limiter: AdaptiveLimiter;
  ledger: IdempotencyLedger;
  llm: LlmProvider;
  config: HarnessConfig;
  identity: CharacterIdentity;
}

/**
 * LangGraph-style per-character node runner without requiring LangGraph at install time.
 */
export class CharacterGraph {
  constructor(
    private character: CharacterAgentState,
    private deps: CharacterGraphDeps
  ) {}

  async runOnce(tick: number): Promise<GraphRunResult> {
    const runId = makeLedgerId("graph", this.character.agentId, tick);
    if (!this.deps.ledger.has(runId)) {
      this.deps.ledger.record(runId, "graph_run", this.character.idempotencyScopeId, {
        startedAt: Date.now(),
      });
    }

    let node: GraphNodeName = "observe";
    let context: AgentContextBundle | null = null;
    let proposal: BareToolProposal | undefined;

    while (node !== "maybe_reflect") {
      const next = await this.runNode(node, tick, context, proposal);
      context = next.context ?? context;
      proposal = next.proposal ?? proposal;
      node = next.next;
      if (next.stop) break;
    }

    if (this.character.executionState === "limited_wait") {
      return {
        runId,
        agentId: this.character.agentId,
        finalNode: node,
        executionState: this.character.executionState,
        limitedWait: true,
      };
    }

    return {
      runId,
      agentId: this.character.agentId,
      finalNode: node,
      proposal,
      executionState: this.character.executionState,
      limitedWait: false,
    };
  }

  private async runNode(
    node: GraphNodeName,
    tick: number,
    context: AgentContextBundle | null,
    proposal?: BareToolProposal
  ): Promise<{
    next: GraphNodeName;
    context?: AgentContextBundle;
    proposal?: BareToolProposal;
    stop?: boolean;
  }> {
    switch (node) {
      case "observe":
        setExecutionState(this.character, "observing");
        this.expirePendingReplies();
        return { next: "retrieve" };

      case "retrieve": {
        setExecutionState(this.character, "retrieving");
        const includeBudget =
          this.character.rentAccountState !== "paid" ||
          this.character.behaviorState.rentPressure > 50;
        const bundle = assembleCharacterContext(
          this.deps.engine,
          this.deps.identity,
          this.character,
          includeBudget
        );
        const query = buildRetrievalQuery(this.character, bundle);
        bundle.retrievedMemories = await this.deps.memory.query(
          this.character.agentId,
          query,
          { day: this.deps.engine.getState().day },
          8
        );
        bundle.reflections = await this.deps.memory.query(
          this.character.agentId,
          "reflection beliefs lessons",
          { memoryType: "reflection" },
          3
        );
        return {
          next:
            this.character.perceptionState.rawQueue.length > 0
              ? "perceive_digest"
              : "decide_action",
          context: bundle,
        };
      }

      case "perceive_digest": {
        if (!context) return { next: "decide_action" };
        const digestDecision = this.deps.limiter.requestCall({
          agentId: this.character.agentId,
          kind: "digest",
          sceneScore: sceneScoreForCharacter(this.character),
        });
        if (!digestDecision.allowed) {
          setExecutionState(this.character, "limited_wait");
          this.character.limiterState.limitedWaitReason = digestDecision.reason;
          return { next: "maybe_reflect", stop: true };
        }

        setExecutionState(this.character, "digesting");
        const rawTexts = this.character.perceptionState.rawQueue.map((p) => p.text);
        const decisionId = makeLedgerId("digest", this.character.agentId, tick);
        const digest = await this.deps.ledger.getOrRecordLlmDecision(
          decisionId,
          this.character.idempotencyScopeId,
          "perceive_digest",
          async () => ({
            id: decisionId,
            node: "perceive_digest",
            agentId: this.character.agentId,
            output: this.deps.config.mockMode
              ? {
                  digests: this.character.perceptionState.rawQueue.map((p) => ({
                    rawPerceptionId: p.id,
                    subjectiveNote: `I noticed: ${p.text}`,
                  })),
                }
              : await this.deps.llm.digestPerceptions(context, rawTexts),
            createdAt: Date.now(),
          })
        );

        if (digest.output && "digests" in digest.output) {
          this.character.perceptionState.rawQueue = [];
          this.character.limiterState.lastDigestAt = Date.now();
        }
        return { next: "decide_action", context };
      }

      case "decide_action": {
        if (!context) return { next: "maybe_reflect", stop: true };
        if (!this.deps.engine.canIssueTool(this.character.agentId)) {
          return { next: "maybe_reflect", stop: true };
        }

        const limiterDecision = this.deps.limiter.requestCall({
          agentId: this.character.agentId,
          kind: "decision",
          sceneScore: sceneScoreForCharacter(this.character),
        });

        if (!limiterDecision.allowed) {
          setExecutionState(this.character, "limited_wait");
          this.character.limiterState.limitedWaitReason = limiterDecision.reason;
          return { next: "maybe_reflect", stop: true };
        }

        setExecutionState(this.character, "deciding");
        const decisionId = makeLedgerId("decide", this.character.agentId, tick);
        const cached = await this.deps.ledger.getOrRecordLlmDecision(
          decisionId,
          this.character.idempotencyScopeId,
          "decide_action",
          async () => {
            const output = this.deps.config.mockMode
              ? mockProposeAction(this.character, context, tick)
              : await this.deps.llm.proposeAction(context);
            return {
              id: decisionId,
              node: "decide_action",
              agentId: this.character.agentId,
              output,
              createdAt: Date.now(),
            };
          }
        );

        const nextProposal = cached.output as BareToolProposal | null;
        if (!nextProposal || !isValidBareTool(nextProposal.verb, nextProposal.targetType)) {
          return { next: "maybe_reflect", proposal: idleProposal(), context };
        }

        this.character.limiterState.lastDecisionAt = Date.now();
        this.character.limiterState.softMinimumSatisfied = true;
        return { next: "call_tool", proposal: nextProposal, context };
      }

      case "call_tool": {
        if (!proposal) return { next: "maybe_reflect", stop: true };
        setExecutionState(this.character, "waiting_on_tool");
        const intentId = makeLedgerId("tool", this.character.agentId, tick, proposal.verb);
        if (!this.deps.ledger.markApplied(intentId, "tool_intent", this.character.idempotencyScopeId)) {
          return { next: "wait_result", proposal };
        }

        const action = toBareToolAction(this.character.agentId, proposal, intentId);
        this.routeTool(action, proposal);
        return { next: "wait_result", proposal };
      }

      case "wait_result": {
        setExecutionState(this.character, "idle");
        return { next: "record_memory", proposal };
      }

      case "record_memory": {
        if (proposal && proposal.verb === "say_to") {
          this.enqueueSpeechMemory(proposal);
        }
        return { next: "maybe_reflect", proposal };
      }

      case "maybe_reflect": {
        const threshold = this.deps.config.reflectionEventThreshold;
        if (
          this.character.perceptionState.meaningfulEventCount >= threshold &&
          context
        ) {
          const reflectionDecision = this.deps.limiter.requestCall({
            agentId: this.character.agentId,
            kind: "reflection",
            sceneScore: sceneScoreForCharacter(this.character),
          });
          if (reflectionDecision.allowed) {
            setExecutionState(this.character, "reflecting");
            const decisionId = makeLedgerId("reflect", this.character.agentId, tick);
            if (!this.deps.ledger.has(decisionId)) {
              const reflection = this.deps.config.mockMode
                ? {
                    document: "I should keep an eye on hall tensions.",
                    metadata: { memoryType: "reflection" as const },
                  }
                : await this.deps.llm.reflect(context);
              this.deps.ledger.record(
                decisionId,
                "llm_decision",
                this.character.idempotencyScopeId,
                reflection
              );
              this.character.perceptionState.meaningfulEventCount = 0;
              this.character.perceptionState.lastReflectionAt = Date.now();
            }
          }
        }
        setExecutionState(this.character, "idle");
        return { next: "maybe_reflect", stop: true };
      }

      default:
        return { next: "maybe_reflect", stop: true };
    }
  }

  private routeTool(action: BareToolAction, proposal: BareToolProposal): void {
    const rule = getVerbRule(proposal.verb);
    if (!rule) return;

    if (rule.routesTo === "engine") {
      if (proposal.verb === "move_to") {
        setExecutionState(this.character, "moving");
      } else if (proposal.verb === "say_to") {
        setExecutionState(this.character, "speaking");
      }
      this.deps.engine.submitToolIntent(action);
      return;
    }

    // Landlord and GM routes are handled by harness coordinators; engine still logs intent.
    this.deps.engine.submitToolIntent(action);
    setExecutionState(this.character, "acting");
  }

  private expirePendingReplies(): void {
    const now = Date.now();
    for (const reply of this.character.socialReplyState.pendingReplies) {
      if (reply.status !== "pending") continue;
      if (now >= reply.createdAt + reply.deadlineMs) {
        reply.status = "expired";
        this.character.perceptionState.rawQueue.push({
          id: makeLedgerId("silence", reply.id),
          day: this.deps.engine.getState().day,
          timestamp: now,
          locationId: this.character.currentLocationId,
          locationType: "room",
          text: `${reply.targetId} stayed silent.`,
          sourceEventId: reply.sourceSpeechEventId,
        });
      }
    }
  }

  private enqueueSpeechMemory(proposal: BareToolProposal): void {
    const message = String(proposal.args.message ?? "");
    this.character.perceptionState.pendingMemoryWrites.push({
      id: makeLedgerId("mem-pending", this.character.agentId, Date.now()),
      agentId: this.character.agentId,
      document: `I said: ${message}`,
      metadata: {
        memoryType: "episodic",
        day: this.deps.engine.getState().day,
        locationId: this.character.currentLocationId,
        locationType: "room",
        participants: [proposal.targetId],
        tags: ["speech"],
        importance: 40,
        timestamp: Date.now(),
      },
    });
  }
}
