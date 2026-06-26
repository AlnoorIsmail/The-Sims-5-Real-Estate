import type { SimEngine } from "@/lib/sim/engine-interface";
import { StubSimEngine } from "@/lib/sim/engine-interface";
import type { BareToolAction, SimTickState } from "@/lib/sim/types";
import { CharacterAgent } from "./CharacterAgent";
import { GameMasterAgent } from "./GameMasterAgent";
import { LandlordAgent } from "./LandlordAgent";
import { IdempotencyLedger } from "./idempotency";
import { createLlmProvider } from "./llm-provider";
import { createMemoryStore } from "./memory";
import { createDemoTickState, getDemoIdentities } from "./seed";
import { AdaptiveLimiter } from "./scheduler";
import type { HarnessConfig, LandlordActionCard } from "./types";
import { DEFAULT_HARNESS_CONFIG } from "./types";
import { getVerbRule } from "./verbs";

export interface AgentHarness {
  config: HarnessConfig;
  engine: SimEngine;
  landlord: LandlordAgent;
  gameMaster: GameMasterAgent;
  characters: CharacterAgent[];
  ledger: IdempotencyLedger;
  limiter: AdaptiveLimiter;
  startDay(): Promise<void>;
  runAutonomyTick(tick: number): Promise<void>;
  closeDay(): Promise<void>;
  handleLandlordTimeouts(): LandlordActionCard[];
  routeLandlordFacingAction(action: BareToolAction): LandlordActionCard | null;
}

export function createAgentHarness(
  initialState?: SimTickState,
  config: HarnessConfig = DEFAULT_HARNESS_CONFIG
): AgentHarness {
  const state = initialState ?? createDemoTickState();
  const engine = new StubSimEngine(state);
  const memory = createMemoryStore(config);
  const ledger = new IdempotencyLedger();
  const limiter = new AdaptiveLimiter(config);
  const llm = createLlmProvider(config.mockMode);

  const landlord = new LandlordAgent(memory, config, engine.getLandlord().budgetAed);
  const gameMaster = new GameMasterAgent(memory, config, engine, llm);

  const identities = getDemoIdentities(state.landlord.runControls.seed);
  const characters = identities
    .map((identity) => {
      const characterState = engine.getCharacter(identity.agentId);
      if (!characterState) return null;
      return new CharacterAgent(
        identity,
        characterState,
        memory,
        config,
        engine,
        limiter,
        ledger,
        llm
      );
    })
    .filter((agent): agent is CharacterAgent => agent !== null);

  const harness: AgentHarness = {
    config,
    engine,
    landlord,
    gameMaster,
    characters,
    ledger,
    limiter,

    async startDay() {
      const sim = engine.getState();
      sim.dayPhase = "morning_brief";
      limiter.resetDay();
      await gameMaster.publishMorningBrief(sim);
      sim.dayPhase = "autonomous";
    },

    async runAutonomyTick(tick: number) {
      for (const character of characters) {
        const result = await character.runAutonomyTick(tick);
        if (!result.proposal) continue;

        const action: BareToolAction = {
          id: `${result.runId}:action`,
          agentId: result.agentId,
          verb: result.proposal.verb,
          targetType: result.proposal.targetType,
          targetId: result.proposal.targetId,
          args: result.proposal.args,
        };

        const rule = getVerbRule(action.verb);
        if (rule?.routesTo === "landlord") {
          harness.routeLandlordFacingAction(action);
        } else if (rule?.routesTo === "game_master") {
          gameMaster.adjudicateProposal(action);
        }
      }
      harness.handleLandlordTimeouts();
    },

    async closeDay() {
      const sim = engine.getState();
      sim.dayPhase = "closing";
      sim.dayPhase = "summary";
      await gameMaster.publishDaySummary(sim);
      sim.day += 1;
      sim.elapsedMs = 0;
      sim.dayPhase = "morning_brief";
    },

    handleLandlordTimeouts() {
      return landlord.checkTimeouts();
    },

    routeLandlordFacingAction(action: BareToolAction) {
      return landlord.enqueueFromAction(action);
    },
  };

  landlord.setResponseHandler((card, reply) => {
    const action = toLandlordAction(card);
    gameMaster.adjudicateProposal(action, card);
    if (reply) {
      void landlord.writeMemory(
        `Landlord replied: ${reply}`,
        {
          memoryType: "episodic",
          day: engine.getState().day,
          locationId: "global",
          locationType: "global",
          participants: [card.requesterId],
          tags: ["landlord_reply"],
          importance: 50,
          sourceEventId: card.id,
          timestamp: Date.now(),
        },
        card.id
      );
    }
  });

  return harness;
}

function toLandlordAction(card: LandlordActionCard): BareToolAction {
  return {
    id: card.id,
    agentId: card.requesterId,
    verb: card.verb,
    targetType: "landlord",
    targetId: "landlord",
    args: card.userReply ? { reply: card.userReply } : {},
  };
}
