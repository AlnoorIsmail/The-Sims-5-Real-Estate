import type { ActionVerb, BareToolAction } from "@/lib/sim/types";
import { Agent } from "./Agent";
import { makeLedgerId } from "./idempotency";
import type { MemoryStore } from "./memory";
import type {
  HarnessConfig,
  LandlordActionCard,
  LandlordQueueItem,
} from "./types";
import { LANDLORD_FACING_VERBS, PRIORITY_LANDLORD_VERBS } from "./verbs";

export type LandlordResponseHandler = (
  card: LandlordActionCard,
  reply?: string
) => void;

export class LandlordAgent extends Agent {
  private queue: LandlordQueueItem[] = [];
  private activeCard: LandlordActionCard | null = null;
  private onResponse?: LandlordResponseHandler;

  constructor(
    memory: MemoryStore,
    config: HarnessConfig,
    public budgetAed: number
  ) {
    super("landlord", "landlord", memory, config);
  }

  setResponseHandler(handler: LandlordResponseHandler): void {
    this.onResponse = handler;
  }

  enqueueFromAction(action: BareToolAction): LandlordActionCard | null {
    if (!LANDLORD_FACING_VERBS.includes(action.verb)) return null;

    const card: LandlordActionCard = {
      id: makeLedgerId("landlord-card", action.id),
      requesterId: action.agentId,
      verb: action.verb,
      summary: summarizeRequest(action),
      urgency: PRIORITY_LANDLORD_VERBS.includes(action.verb) ? "critical" : "medium",
      suggestedChoices: suggestedChoicesFor(action.verb),
      createdAt: Date.now(),
      timeoutMs: this.config.landlordCardTimeoutMs,
      status: "pending",
    };

    const priority = PRIORITY_LANDLORD_VERBS.includes(action.verb) ? 100 : 10;
    this.queue.push({ card, sourceActionId: action.id, priority });
    this.queue.sort((a, b) => b.priority - a.priority);

    if (!this.activeCard) {
      this.activeCard = this.queue.shift()?.card ?? null;
    }

    return card;
  }

  submitReply(cardId: string, reply: string): void {
    if (!this.activeCard || this.activeCard.id !== cardId) return;
    this.activeCard.status = "answered";
    this.activeCard.userReply = reply;
    this.onResponse?.(this.activeCard, reply);
    this.activeCard = this.queue.shift()?.card ?? null;
  }

  checkTimeouts(now = Date.now()): LandlordActionCard[] {
    const timedOut: LandlordActionCard[] = [];

    if (this.activeCard && this.activeCard.status === "pending") {
      if (now - this.activeCard.createdAt >= this.activeCard.timeoutMs) {
        this.activeCard.status = "timed_out";
        timedOut.push(this.activeCard);
        this.onResponse?.(this.activeCard);
        this.activeCard = this.queue.shift()?.card ?? null;
      }
    }

    return timedOut;
  }

  getActiveCard(): LandlordActionCard | null {
    return this.activeCard;
  }

  getQueueDepth(): number {
    return this.queue.length + (this.activeCard ? 1 : 0);
  }
}

function summarizeRequest(action: BareToolAction): string {
  switch (action.verb) {
    case "request_repair":
      return `${action.agentId} requests repair: ${String(action.args.issue ?? "unspecified issue")}`;
    case "file_complaint":
      return `${action.agentId} filed a complaint.`;
    case "pay_rent":
      return `${action.agentId} wants to pay rent.`;
    case "skip_rent":
      return `${action.agentId} may skip rent this cycle.`;
    case "move_in":
      return `${action.agentId} requests move-in.`;
    case "move_out":
      return `${action.agentId} requests move-out.`;
    default:
      return `${action.agentId}: ${action.verb}`;
  }
}

function suggestedChoicesFor(verb: ActionVerb): string[] {
  switch (verb) {
    case "request_repair":
      return ["Approve maintenance", "Defer", "Deny"];
    case "file_complaint":
      return ["Investigate", "Mediate", "Dismiss"];
    case "pay_rent":
      return ["Acknowledge payment"];
    case "skip_rent":
      return ["Send reminder", "Negotiate", "Start notice process"];
    case "move_in":
      return ["Approve", "Counter-offer", "Reject"];
    case "move_out":
      return ["Approve", "Negotiate retention", "Reject"];
    default:
      return ["Acknowledge"];
  }
}
