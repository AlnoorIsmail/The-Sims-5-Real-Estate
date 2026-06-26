import type { SimEngine } from "@/lib/sim/engine-interface";
import type { BareToolAction, SimEvent, SimTickState } from "@/lib/sim/types";
import { Agent } from "./Agent";
import { makeLedgerId } from "./idempotency";
import type { MemoryStore } from "./memory";
import type {
  GameMasterEventCard,
  HarnessConfig,
  LandlordActionCard,
  LlmProvider,
} from "./types";

export const GM_EVENT_DECK: GameMasterEventCard[] = [
  {
    id: "gm-finance-rates",
    scope: "global",
    tags: ["finance", "market"],
    publicText: "Rumor of rising interest rates stirs investor caution.",
    privateContext: "Slight reputation pressure on aggressive rent hikes.",
    affectedMetrics: ["reputation", "roiProxy"],
  },
  {
    id: "gm-health-wave",
    scope: "global",
    tags: ["health", "anxiety"],
    publicText: "A seasonal illness wave raises resident anxiety.",
    privateContext: "Remote-work demand rises; hall chatter increases.",
    affectedMetrics: ["satisfaction", "occupancy"],
  },
  {
    id: "gm-amenity-cafe",
    scope: "building",
    tags: ["amenities"],
    publicText: "A new cafe opens nearby.",
    privateContext: "Small satisfaction bump for social residents.",
    affectedMetrics: ["satisfaction"],
  },
  {
    id: "gm-data-center",
    scope: "global",
    tags: ["jobs", "noise"],
    publicText: "A proposed data center promises jobs but worries residents about traffic.",
    privateContext: "Split mood effects by personality.",
    affectedMetrics: ["satisfaction", "reputation"],
  },
  {
    id: "gm-factory-noise",
    scope: "building",
    tags: ["noise", "comfort"],
    publicText: "Nearby industrial activity adds background noise.",
    privateContext: "Complaint risk rises in premium units.",
    affectedMetrics: ["satisfaction", "maintenancePressure"],
  },
  {
    id: "gm-maintenance-strain",
    scope: "building",
    tags: ["maintenance"],
    publicText: "Elevator maintenance is delayed across the district.",
    privateContext: "Repair requests become more likely.",
    affectedMetrics: ["maintenancePressure", "reputation"],
  },
  {
    id: "gm-jobs-surge",
    scope: "global",
    tags: ["jobs", "rent"],
    publicText: "Local hiring surge improves rent reliability for some households.",
    privateContext: "Rent payment probability improves for employed archetypes.",
    affectedMetrics: ["rentReliability", "occupancy"],
  },
  {
    id: "gm-regulation",
    scope: "global",
    tags: ["regulation"],
    publicText: "New rental inspection rules increase compliance overhead.",
    privateContext: "Landlord risk metric ticks up.",
    affectedMetrics: ["reputation", "roiProxy"],
  },
  {
    id: "gm-market-shift",
    scope: "global",
    tags: ["market", "rent"],
    publicText: "Comparable rents shift in the district.",
    privateContext: "Prospects compare units more aggressively.",
    affectedMetrics: ["roiProxy", "occupancy"],
  },
  {
    id: "gm-neighbor-conflict",
    scope: "building",
    tags: ["conflict", "noise"],
    publicText: "Neighbor tension over guests and shared spaces escalates.",
    privateContext: "Altercation probability rises.",
    affectedMetrics: ["satisfaction", "incidentSeverity"],
  },
  {
    id: "gm-service-disruption",
    scope: "global",
    tags: ["utility", "mood"],
    publicText: "Roadwork and transit delays frustrate commuters.",
    privateContext: "Stress rises for conscientious residents.",
    affectedMetrics: ["satisfaction"],
  },
  {
    id: "gm-move-in-pressure",
    scope: "building",
    tags: ["occupancy", "prospect"],
    publicText: "A prospect wants a unit under imperfect conditions.",
    privateContext: "Landlord decision card likely if vacancy exists.",
    affectedMetrics: ["occupancy", "reputation"],
  },
];

export class GameMasterAgent extends Agent {
  constructor(
    memory: MemoryStore,
    config: HarnessConfig,
    private engine: SimEngine,
    private llm: LlmProvider
  ) {
    super("game_master", "game_master", memory, config);
  }

  pickDailyEventCard(day: number): GameMasterEventCard {
    return GM_EVENT_DECK[day % GM_EVENT_DECK.length];
  }

  async publishMorningBrief(state: SimTickState): Promise<SimEvent> {
    const card = this.pickDailyEventCard(state.day);
    const text = this.config.mockMode
      ? `Morning brief: ${card.publicText}`
      : await this.llm.generateMorningBrief(state, card);

    const event: SimEvent = {
      id: makeLedgerId("gm-brief", state.day),
      day: state.day,
      timestamp: Date.now(),
      scope: "global",
      summary: text,
      sourceEventId: card.id,
    };

    this.engine.appendEvent(event);
    await this.writeMemory(text, {
      memoryType: "summary",
      day: state.day,
      locationId: "global",
      locationType: "global",
      participants: [],
      tags: card.tags,
      importance: 70,
      sourceEventId: event.id,
      timestamp: event.timestamp,
    }, event.id);

    return event;
  }

  async publishDaySummary(state: SimTickState): Promise<SimEvent> {
    const text = this.config.mockMode
      ? `Day ${state.day} closes with ${state.eventLog.length} logged events.`
      : await this.llm.generateDaySummary(state, state.eventLog);

    const event: SimEvent = {
      id: makeLedgerId("gm-summary", state.day),
      day: state.day,
      timestamp: Date.now(),
      scope: "global",
      summary: text,
    };

    this.engine.appendEvent(event);
    await this.writeMemory(text, {
      memoryType: "summary",
      day: state.day,
      locationId: "global",
      locationType: "global",
      participants: [],
      tags: ["daily_summary"],
      importance: 60,
      sourceEventId: event.id,
      timestamp: event.timestamp,
    }, event.id);

    return event;
  }

  adjudicateProposal(
    action: BareToolAction,
    landlordCard?: LandlordActionCard
  ): SimEvent {
    const summary = landlordCard?.userReply
      ? `GM adjudicated ${action.verb} with landlord reply: ${landlordCard.userReply}`
      : landlordCard?.status === "timed_out"
        ? `GM adjudicated ${action.verb} after landlord timeout (no action taken).`
        : `GM adjudicated ${action.verb}.`;

    const event: SimEvent = {
      id: makeLedgerId("gm-adjudication", action.id),
      day: this.engine.getState().day,
      timestamp: Date.now(),
      scope: action.verb === "altercate" ? "global" : "local",
      actorId: action.agentId,
      verb: action.verb,
      summary,
      sourceEventId: action.id,
    };

    this.engine.appendEvent(event);
    return event;
  }
}
