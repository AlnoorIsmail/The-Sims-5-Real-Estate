import type { ActionVerb, CharacterAgentState } from "@/lib/sim/types";
import type { HarnessConfig } from "./types";
import { LANDLORD_FACING_VERBS, PRIORITY_LANDLORD_VERBS } from "./verbs";

export interface LimiterRequest {
  agentId: string;
  kind: "decision" | "digest" | "reflection";
  verb?: ActionVerb;
  sceneScore: number;
}

export interface LimiterDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Adaptive model-call limiter shared across character graphs.
 */
export class AdaptiveLimiter {
  private callTimestamps: number[] = [];
  private softMinimumTracker = new Map<string, boolean>();

  constructor(private config: HarnessConfig) {}

  resetDay(): void {
    this.softMinimumTracker.clear();
  }

  requestCall(req: LimiterRequest): LimiterDecision {
    this.pruneOldCalls();

    if (this.callTimestamps.length >= this.config.apiRateLimitPerMinute) {
      return { allowed: false, reason: "api_rate_limit" };
    }

    const priority = scoreRequest(req);
    const softMinNeeded = !this.softMinimumTracker.get(req.agentId);

    if (!softMinNeeded && priority < 20) {
      return { allowed: false, reason: "scene_priority" };
    }

    this.callTimestamps.push(Date.now());
    if (req.kind === "decision" || req.kind === "digest") {
      this.softMinimumTracker.set(req.agentId, true);
    }

    return { allowed: true };
  }

  private pruneOldCalls(): void {
    const cutoff = Date.now() - 60_000;
    this.callTimestamps = this.callTimestamps.filter((ts) => ts > cutoff);
  }
}

function scoreRequest(req: LimiterRequest): number {
  let score = req.sceneScore;

  if (req.verb && LANDLORD_FACING_VERBS.includes(req.verb)) score += 40;
  if (req.verb && PRIORITY_LANDLORD_VERBS.includes(req.verb)) score += 30;
  if (req.verb === "say_to") score += 25;
  if (req.verb === "altercate") score += 50;
  if (req.kind === "digest") score += 10;
  if (req.kind === "reflection") score += 5;

  return score;
}

export function sceneScoreForCharacter(character: CharacterAgentState): number {
  let score = 10;
  if (character.rentAccountState === "late" || character.rentAccountState === "delinquent") {
    score += 30;
  }
  if (character.behaviorState.stress > 70) score += 15;
  if (character.perceptionState.rawQueue.length > 0) score += 10;
  if (character.socialReplyState.pendingReplies.some((r) => r.status === "pending")) {
    score += 20;
  }
  return score;
}

export function setExecutionState(
  character: CharacterAgentState,
  state: CharacterAgentState["executionState"]
): void {
  character.executionState = state;
}
