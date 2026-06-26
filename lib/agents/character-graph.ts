import type { SimEngine } from "@/lib/sim/engine-interface";
import type { BareToolAction, CharacterAgentState } from "@/lib/sim/types";
import type { SimulationBus } from "./bus/simulation-bus";
import { assembleCharacterContext, buildRetrievalQuery } from "./context";
import { IdempotencyLedger, makeLedgerId } from "./idempotency";
import type { LanguageModel } from "./llm/language-model";
import type { MemoryStore } from "./memory";
import { idleProposal } from "./mock-proposals";
import {
  assembleDecideActionPrompt,
  assembleDigestPrompt,
  assembleReflectionPrompt,
  mapDigestTextToPerceptions,
} from "./prompts/assembler";
import { buildActionCatalog } from "./routing/action-catalog";
import { mockSelectToolCall } from "./routing/mock-tool-call";
import { routeToolCall, toolCallToProposal } from "./routing/tool-call-router";
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
  PerceptionDigestOutput,
} from "./types";
import { getVerbRule } from "./verbs";

export interface CharacterGraphDeps {
  engine: SimEngine;
  memory: MemoryStore;
  limiter: AdaptiveLimiter;
  ledger: IdempotencyLedger;
  languageModel: LanguageModel;
  bus: SimulationBus;
  config: HarnessConfig;
  identity: CharacterIdentity;
}

/**
 * LangGraph-style per-character node runner. Harness owns IDs and routing;
 * the language model only produces text or native tool calls.
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
        const rawQueue = [...this.character.perceptionState.rawQueue];
        const decisionId = makeLedgerId("digest", this.character.agentId, tick);
        const digest = await this.deps.ledger.getOrRecordLlmDecision(
          decisionId,
          this.character.idempotencyScopeId,
          "perceive_digest",
          async () => {
            let output: PerceptionDigestOutput;
            if (this.deps.config.mockMode) {
              output = {
                digests: rawQueue.map((p) => ({
                  rawPerceptionId: p.id,
                  subjectiveNote: `I noticed: ${p.text}`,
                })),
              };
            } else {
              const prompt = assembleDigestPrompt(context, rawQueue);
              const prose = await this.deps.languageModel.completeText(prompt);
              output = mapDigestTextToPerceptions(prose, rawQueue);
            }
            return {
              id: decisionId,
              node: "perceive_digest",
              agentId: this.character.agentId,
              output,
              createdAt: Date.now(),
            };
          }
        );

        if (digest.output && typeof digest.output === "object" && "digests" in digest.output) {
          const digests = digest.output as PerceptionDigestOutput;
          this.character.perceptionState.rawQueue = [];
          this.character.limiterState.lastDigestAt = Date.now();
          this.deps.bus.publish({
            id: makeLedgerId("digest-msg", decisionId),
            type: "perception_digested",
            timestamp: Date.now(),
            day: this.deps.engine.getState().day,
            agentId: this.character.agentId,
            digests: digests.digests,
          });
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
        const catalog = buildActionCatalog(context);
        const decisionId = makeLedgerId("decide", this.character.agentId, tick);
        const cached = await this.deps.ledger.getOrRecordLlmDecision(
          decisionId,
          this.character.idempotencyScopeId,
          "decide_action",
          async () => {
            const toolCall = this.deps.config.mockMode
              ? mockSelectToolCall(this.character, context, tick)
              : (await this.deps.languageModel.completeWithTools(
                  assembleDecideActionPrompt(context, catalog.tools),
                  catalog.tools
                )) ?? { name: "idle", args: {} };

            return {
              id: decisionId,
              node: "decide_action",
              agentId: this.character.agentId,
              output: toolCall,
              createdAt: Date.now(),
            };
          }
        );

        const toolCall =
          cached.output && typeof cached.output === "object" && "name" in cached.output
            ? cached.output
            : { name: "idle", args: {} };

        const nextProposal = toolCallToProposal(toolCall, catalog);
        if (nextProposal.verb === "idle" && toolCall.name !== "idle") {
          return { next: "maybe_reflect", proposal: idleProposal(), context };
        }

        this.character.limiterState.lastDecisionAt = Date.now();
        this.character.limiterState.softMinimumSatisfied = true;
        return { next: "call_tool", proposal: nextProposal, context };
      }

      case "call_tool": {
        if (!proposal || !context) return { next: "maybe_reflect", stop: true };
        setExecutionState(this.character, "waiting_on_tool");
        const catalog = buildActionCatalog(context);
        const intentId = makeLedgerId("tool", this.character.agentId, tick, proposal.verb);
        if (!this.deps.ledger.markApplied(intentId, "tool_intent", this.character.idempotencyScopeId)) {
          return { next: "wait_result", proposal };
        }

        const action = routeToolCall(
          toolCallFromProposal(proposal),
          catalog,
          this.character.agentId,
          intentId
        );

        this.publishToolIntent(action, proposal);
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
              const document = this.deps.config.mockMode
                ? "I should keep an eye on hall tensions."
                : await this.deps.languageModel.completeText(
                    assembleReflectionPrompt(context)
                  );
              this.deps.ledger.record(decisionId, "llm_decision", this.character.idempotencyScopeId, document);
              void this.deps.memory.write(
                this.character.agentId,
                document,
                {
                  memoryType: "reflection",
                  day: this.deps.engine.getState().day,
                  locationId: this.character.currentLocationId,
                  locationType: "room",
                  participants: [this.character.agentId],
                  tags: ["reflection"],
                  importance: 55,
                  sourceEventId: decisionId,
                  timestamp: Date.now(),
                },
                decisionId
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

  private publishToolIntent(action: BareToolAction, proposal: BareToolProposal): void {
    const day = this.deps.engine.getState().day;
    const rule = getVerbRule(proposal.verb);

    if (proposal.verb === "move_to") {
      setExecutionState(this.character, "moving");
    } else if (proposal.verb === "say_to") {
      setExecutionState(this.character, "speaking");
      this.deps.bus.publish({
        id: makeLedgerId("speech", action.id),
        type: "speech_published",
        timestamp: Date.now(),
        day,
        speakerId: this.character.agentId,
        targetId: proposal.targetId,
        message: String(proposal.args.message ?? ""),
        sourceActionId: action.id,
        interrupt: Boolean(proposal.args.interrupt),
      });
    } else if (rule?.routesTo !== "engine") {
      setExecutionState(this.character, "acting");
    }

    this.deps.bus.publish({
      id: makeLedgerId("tool-msg", action.id),
      type: "tool_intent_submitted",
      timestamp: Date.now(),
      day,
      action,
    });
  }

  private expirePendingReplies(): void {
    const now = Date.now();
    const day = this.deps.engine.getState().day;
    for (const reply of this.character.socialReplyState.pendingReplies) {
      if (reply.status !== "pending") continue;
      if (now >= reply.createdAt + reply.deadlineMs) {
        reply.status = "expired";
        this.character.perceptionState.rawQueue.push({
          id: makeLedgerId("silence", reply.id),
          day,
          timestamp: now,
          locationId: this.character.currentLocationId,
          locationType: "room",
          text: `${reply.targetId} stayed silent.`,
          sourceEventId: reply.sourceSpeechEventId,
        });
        this.deps.bus.publish({
          id: makeLedgerId("silence-msg", reply.id),
          type: "silence_observed",
          timestamp: now,
          day,
          speakerId: reply.speakerId,
          targetId: reply.targetId,
          sourceSpeechEventId: reply.sourceSpeechEventId,
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

function toolCallFromProposal(proposal: BareToolProposal) {
  switch (proposal.verb) {
    case "move_to":
      if (proposal.targetType === "character") {
        return {
          name: "move_to_character",
          args: { characterId: proposal.targetId, speed: proposal.args.speed ?? "walk" },
        };
      }
      if (proposal.targetType === "room") {
        return {
          name: "move_to_room",
          args: { roomId: proposal.targetId, speed: proposal.args.speed ?? "walk" },
        };
      }
      if (proposal.targetType === "location") {
        return {
          name: "move_to_location",
          args: { locationId: proposal.targetId, speed: proposal.args.speed ?? "walk" },
        };
      }
      return {
        name: "move_to_door",
        args: { doorId: proposal.targetId, speed: proposal.args.speed ?? "walk" },
      };
    case "say_to":
      return {
        name: "say_to",
        args: {
          characterId: proposal.targetId,
          message: proposal.args.message,
          interrupt: proposal.args.interrupt,
        },
      };
    case "request_repair":
      return { name: "request_repair", args: { issue: proposal.args.issue } };
    case "file_complaint":
      return { name: "file_complaint", args: { summary: proposal.args.summary } };
    case "pay_rent":
      return { name: "pay_rent", args: {} };
    case "skip_rent":
      return { name: "skip_rent", args: {} };
    case "move_in":
      return { name: "move_in", args: {} };
    case "move_out":
      return { name: "move_out", args: {} };
    case "altercate":
      if (proposal.targetType === "door") {
        return { name: "altercate_door", args: { doorId: proposal.targetId } };
      }
      return { name: "altercate_character", args: { characterId: proposal.targetId } };
    default:
      return { name: "idle", args: {} };
  }
}
