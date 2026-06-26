import type {
  ActionTargetType,
  ActionVerb,
  CharacterAgentState,
  MoveSpeed,
} from "@/lib/sim/types";
import type { AgentContextBundle, BareToolProposal } from "./types";

/**
 * Deterministic proposals for mock/demo mode without LLM, LangGraph, Chroma, or Gemini.
 */
export function mockProposeAction(
  character: CharacterAgentState,
  context: AgentContextBundle,
  tick: number
): BareToolProposal {
  const { visibleWorld } = context;

  if (character.rentAccountState === "due" || character.rentAccountState === "late") {
    return {
      verb: "pay_rent",
      targetType: "landlord",
      targetId: "landlord",
      args: { amountAed: 5000 },
    };
  }

  if (visibleWorld.rawPerceptionCount > 0 && tick % 3 === 0) {
    const peer = visibleWorld.visibleCharacters[0];
    if (peer) {
      return {
        verb: "say_to",
        targetType: "character",
        targetId: peer.id,
        args: { message: `Hey ${peer.label}, did you hear that?` },
      };
    }
  }

  const lockedDoor = visibleWorld.nearbyDoors[0];
  const ownedRoom = character.ownedUnitId
    ? visibleWorld.reachableRooms.find(
        (room) => room.id === `${character.ownedUnitId}-room`
      )
    : undefined;

  if (tick % 5 === 0 && lockedDoor && !ownedRoom) {
    return {
      verb: "move_to",
      targetType: "door",
      targetId: lockedDoor.id,
      args: { speed: "walk" satisfies MoveSpeed },
    };
  }

  if (ownedRoom) {
    return {
      verb: "move_to",
      targetType: "room",
      targetId: ownedRoom.id,
      args: { speed: "walk" satisfies MoveSpeed },
    };
  }

  const followTarget = visibleWorld.visibleCharacters[tick % Math.max(visibleWorld.visibleCharacters.length, 1)];
  if (followTarget) {
    return {
      verb: "move_to",
      targetType: "character",
      targetId: followTarget.id,
      args: { speed: "walk" satisfies MoveSpeed },
    };
  }

  const hall = visibleWorld.staticEndpoints.find((endpoint) => endpoint.kind === "location");
  if (hall) {
    return {
      verb: "move_to",
      targetType: "location",
      targetId: hall.id,
      args: { speed: "walk" satisfies MoveSpeed },
    };
  }

  return idleProposal();
}

export function idleProposal(): BareToolProposal {
  return {
    verb: "idle",
    targetType: "none",
    targetId: "",
    args: {},
  };
}

export function toBareToolAction(
  agentId: string,
  proposal: BareToolProposal,
  intentId: string
) {
  return {
    id: intentId,
    agentId,
    verb: proposal.verb as ActionVerb,
    targetType: proposal.targetType as ActionTargetType,
    targetId: proposal.targetId,
    args: proposal.args,
  };
}
