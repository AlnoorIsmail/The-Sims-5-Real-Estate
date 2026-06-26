import type { SimEngine } from "@/lib/sim/engine-interface";
import { StubSimEngine } from "@/lib/sim/engine-interface";
import type { BareToolAction, SimTickState } from "@/lib/sim/types";
import { SimulationBus } from "./bus/simulation-bus";
import { CharacterAgent } from "./CharacterAgent";
import { GameMasterAgent } from "./GameMasterAgent";
import { LandlordAgent } from "./LandlordAgent";
import { IdempotencyLedger } from "./idempotency";
import {
  createLanguageModelFromConfig,
  mergeCharacterLlmConfig,
  resolveGameMasterLlmFromEnv,
} from "./llm-provider";
import { createMemoryStore } from "./memory";
import { createDemoTickState, getDemoIdentities } from "./seed";
import { AdaptiveLimiter } from "./scheduler";
import type { HarnessConfig, HarnessOptions, LandlordActionCard } from "./types";
import { DEFAULT_HARNESS_CONFIG } from "./types";
import { getVerbRule } from "./verbs";

export interface AgentHarness {
  config: HarnessConfig;
  engine: SimEngine;
  bus: SimulationBus;
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

export function createAgentHarness(options: HarnessOptions = {}): AgentHarness {
  const config = options.config ?? DEFAULT_HARNESS_CONFIG;
  const state = options.initialState ?? createDemoTickState();
  const engine = new StubSimEngine(state);
  const memory = createMemoryStore(config);
  const ledger = new IdempotencyLedger();
  const limiter = new AdaptiveLimiter(config);
  const bus = new SimulationBus();

  const gameMasterLlmConfig =
    options.gameMasterLlm ?? resolveGameMasterLlmFromEnv();
  const gameMasterLanguageModel = createLanguageModelFromConfig(
    gameMasterLlmConfig,
    config
  );

  const landlord = new LandlordAgent(memory, config, engine.getLandlord().budgetAed);
  const gameMaster = new GameMasterAgent(
    memory,
    config,
    engine,
    bus,
    gameMasterLanguageModel
  );

  const identities = getDemoIdentities(state.landlord.runControls.seed);
  const characters = identities
    .map((identity) => {
      const characterState = engine.getCharacter(identity.agentId);
      if (!characterState) return null;

      const llmConfig = mergeCharacterLlmConfig(
        identity.agentId,
        identity.llm,
        options.characterLlmConfigs?.[identity.agentId]
      );
      const languageModel = createLanguageModelFromConfig(llmConfig, config);

      return new CharacterAgent(
        { ...identity, llm: llmConfig },
        characterState,
        memory,
        config,
        engine,
        limiter,
        ledger,
        bus,
        languageModel
      );
    })
    .filter((agent): agent is CharacterAgent => agent !== null);

  const characterById = new Map(characters.map((c) => [c.id, c]));

  bus.subscribe((message) => {
    if (message.type === "speech_published") {
      const target = characterById.get(message.targetId);
      target?.queueRawPerception(
        `${message.speakerId} said: "${message.message}"`,
        message.sourceActionId
      );
      return;
    }

    if (message.type === "tool_intent_submitted") {
      const rule = getVerbRule(message.action.verb);
      if (rule?.routesTo === "landlord") {
        const card = landlord.enqueueFromAction(message.action);
        if (card) {
          bus.publish({
            id: `landlord-queue-${card.id}`,
            type: "landlord_request_queued",
            timestamp: Date.now(),
            day: message.day,
            card,
            sourceActionId: message.action.id,
          });
        }
      } else if (rule?.routesTo === "game_master") {
        gameMaster.adjudicateProposal(message.action);
      } else if (rule?.routesTo === "engine") {
        engine.submitToolIntent(message.action);
      }
    }
  });

  const harness: AgentHarness = {
    config,
    engine,
    bus,
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
        await character.runAutonomyTick(tick);
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
