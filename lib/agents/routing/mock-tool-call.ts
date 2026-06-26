import type { CharacterAgentState } from "@/lib/sim/types";
import type { AgentContextBundle } from "../types";
import type { HarnessToolCall } from "../llm/language-model";
import { mockProposeAction } from "../mock-proposals";

/** Deterministic mock tool selection using the same catalog path as live LLM. */
export function mockSelectToolCall(
  character: CharacterAgentState,
  context: AgentContextBundle,
  tick: number
): HarnessToolCall {
  const proposal = mockProposeAction(character, context, tick);

  switch (proposal.verb) {
    case "move_to":
      if (proposal.targetType === "character") {
        return {
          name: "move_to_character",
          args: {
            characterId: proposal.targetId,
            speed: proposal.args.speed ?? "walk",
          },
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
          args: {
            locationId: proposal.targetId,
            speed: proposal.args.speed ?? "walk",
          },
        };
      }
      if (proposal.targetType === "door") {
        return {
          name: "move_to_door",
          args: { doorId: proposal.targetId, speed: proposal.args.speed ?? "walk" },
        };
      }
      break;

    case "say_to":
      return {
        name: "say_to",
        args: {
          characterId: proposal.targetId,
          message: proposal.args.message ?? "",
          interrupt: proposal.args.interrupt ?? false,
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
      break;
  }

  return { name: "idle", args: {} };
}
