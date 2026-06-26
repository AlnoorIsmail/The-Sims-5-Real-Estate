import type { SimEngine } from "@/lib/sim/engine-interface";
import type { CharacterAgentState, SimTickState } from "@/lib/sim/types";
import type {
  AgentContextBundle,
  AvailableAction,
  CharacterIdentity,
  EndpointCandidate,
} from "./types";
import { VERB_TARGET_MAP } from "./verbs";

const SYSTEM_RULES = [
  "You are a resident agent in a property-management life simulator.",
  "Propose one bare tool action at a time.",
  "Never output waypoints, pixel coordinates, or direct state mutations.",
  "Landlord-facing requests route to LandlordAgent, not the game master.",
  "The game master adjudicates consequences; you only propose intent.",
].join(" ");

export function assembleCharacterContext(
  engine: SimEngine,
  identity: CharacterIdentity,
  character: CharacterAgentState,
  includeBudget: boolean
): AgentContextBundle {
  const state = engine.getState();
  const location = state.building.locations.find(
    (node) => node.id === character.currentLocationId
  );

  const visibleCharacters = listVisibleCharacters(state, character);
  const reachableRooms = listReachableRooms(state, character);
  const staticEndpoints = listStaticEndpoints(state);
  const nearbyDoors = listNearbyDoors(state, character);
  const movement = state.movements[character.agentId];

  const availableActions: AvailableAction[] = VERB_TARGET_MAP.map((rule) => ({
    verb: rule.verb,
    targetType: rule.allowedTargetTypes[0],
    description: rule.description,
  }));

  const budgetSummary =
    includeBudget && needsBudgetContext(character)
      ? {
          budgetAed: engine.getLandlord().budgetAed,
          recentCapitalEvents: engine
            .getLandlord()
            .capitalEvents.slice(-3)
            .map((event) => event.description),
          relevantToRequest: true,
        }
      : undefined;

  return {
    systemRules: SYSTEM_RULES,
    identity,
    visibleWorld: {
      day: state.day,
      dayPhase: state.dayPhase,
      currentLocationId: character.currentLocationId,
      currentLocationLabel: location?.label ?? character.currentLocationId,
      visibleCharacters,
      reachableRooms,
      staticEndpoints,
      nearbyDoors,
      ownedUnitId: character.ownedUnitId,
      movementSummary: movement
        ? `${movement.status} toward ${movement.targetLocationId}`
        : "idle",
      canEnterTargetRoom: true,
      behavior: character.behaviorState,
      goals: character.goalState,
      lifecycleState: character.lifecycleState,
      rentAccountState: character.rentAccountState,
      executionState: character.executionState,
      rawPerceptionCount: character.perceptionState.rawQueue.length,
    },
    relationships: [],
    retrievedMemories: [],
    reflections: [],
    recentLocalEvents: state.eventLog.slice(-6),
    availableActions,
    budgetSummary,
  };
}

function needsBudgetContext(character: CharacterAgentState): boolean {
  return (
    character.rentAccountState === "due" ||
    character.rentAccountState === "late" ||
    character.rentAccountState === "delinquent" ||
    character.behaviorState.rentPressure > 60
  );
}

function listVisibleCharacters(
  state: SimTickState,
  actor: CharacterAgentState
): EndpointCandidate[] {
  const location = state.building.locations.find(
    (node) => node.id === actor.currentLocationId
  );
  if (!location) return [];

  return location.subscribers
    .filter((id) => id !== actor.agentId && state.characters[id])
    .map((id) => ({
      id,
      label: state.characters[id].displayName,
      kind: "character" as const,
    }));
}

function listReachableRooms(
  state: SimTickState,
  actor: CharacterAgentState
): EndpointCandidate[] {
  return state.building.units.map((unit) => ({
    id: unit.roomLocationId,
    label: `Unit ${unit.columnIndex + 1} room`,
    kind: "room" as const,
  }));
}

function listStaticEndpoints(state: SimTickState): EndpointCandidate[] {
  return state.building.locations
    .filter((node) => ["hall", "stair", "lobby", "exterior"].includes(node.type))
    .map((node) => ({
      id: node.id,
      label: node.label,
      kind: "location" as const,
    }));
}

function listNearbyDoors(
  state: SimTickState,
  actor: CharacterAgentState
): EndpointCandidate[] {
  const location = state.building.locations.find(
    (node) => node.id === actor.currentLocationId
  );
  if (!location?.floorIndex && location?.floorIndex !== 0) {
    return state.building.doors.map((door) => ({
      id: door.id,
      label: `Door ${door.unitId}`,
      kind: "door" as const,
    }));
  }

  return state.building.doors
    .filter((door) => {
      const hall = state.building.locations.find((n) => n.id === door.hallLocationId);
      return hall?.floorIndex === location.floorIndex;
    })
    .map((door) => ({
      id: door.id,
      label: `Door ${door.unitId}`,
      kind: "door" as const,
    }));
}

export function buildRetrievalQuery(
  character: CharacterAgentState,
  context: AgentContextBundle
): string {
  return [
    character.goalState.currentGoal,
    context.visibleWorld.currentLocationLabel,
    character.rentAccountState,
    context.recentLocalEvents.map((event) => event.summary).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}
