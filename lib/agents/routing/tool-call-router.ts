import type { BareToolAction } from "@/lib/sim/types";
import type { BareToolProposal } from "../types";
import type { HarnessToolCall } from "../llm/language-model";
import type { ActionCatalog } from "./action-catalog";
import { idleProposal } from "../mock-proposals";

export function routeToolCall(
  call: HarnessToolCall,
  catalog: ActionCatalog,
  agentId: string,
  intentId: string
): BareToolAction {
  const proposal = toolCallToProposal(call, catalog);
  return {
    id: intentId,
    agentId,
    verb: proposal.verb,
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    args: proposal.args,
  };
}

export function toolCallToProposal(
  call: HarnessToolCall,
  catalog: ActionCatalog
): BareToolProposal {
  const args = call.args ?? {};

  switch (call.name) {
    case "idle":
      return idleProposal();

    case "move_to_character": {
      const characterId = String(args.characterId ?? "");
      if (!catalog.characterIds.includes(characterId)) return idleProposal();
      return {
        verb: "move_to",
        targetType: "character",
        targetId: characterId,
        args: { speed: args.speed ?? "walk" },
      };
    }

    case "move_to_room": {
      const roomId = String(args.roomId ?? "");
      if (!catalog.roomIds.includes(roomId)) return idleProposal();
      return {
        verb: "move_to",
        targetType: "room",
        targetId: roomId,
        args: { speed: args.speed ?? "walk" },
      };
    }

    case "move_to_location": {
      const locationId = String(args.locationId ?? "");
      if (!catalog.locationIds.includes(locationId)) return idleProposal();
      return {
        verb: "move_to",
        targetType: "location",
        targetId: locationId,
        args: { speed: args.speed ?? "walk" },
      };
    }

    case "move_to_door": {
      const doorId = String(args.doorId ?? "");
      if (!catalog.doorIds.includes(doorId)) return idleProposal();
      return {
        verb: "move_to",
        targetType: "door",
        targetId: doorId,
        args: { speed: args.speed ?? "walk" },
      };
    }

    case "say_to": {
      const characterId = String(args.characterId ?? "");
      if (!catalog.characterIds.includes(characterId)) return idleProposal();
      return {
        verb: "say_to",
        targetType: "character",
        targetId: characterId,
        args: {
          message: String(args.message ?? ""),
          interrupt: Boolean(args.interrupt),
        },
      };
    }

    case "request_repair":
      return {
        verb: "request_repair",
        targetType: "landlord",
        targetId: "landlord",
        args: { issue: args.issue ?? "unspecified" },
      };

    case "file_complaint":
      return {
        verb: "file_complaint",
        targetType: "landlord",
        targetId: "landlord",
        args: { summary: args.summary ?? "" },
      };

    case "pay_rent":
      return {
        verb: "pay_rent",
        targetType: "landlord",
        targetId: "landlord",
        args: {},
      };

    case "skip_rent":
      return {
        verb: "skip_rent",
        targetType: "landlord",
        targetId: "landlord",
        args: {},
      };

    case "move_in":
      return {
        verb: "move_in",
        targetType: "lifecycle",
        targetId: "landlord",
        args: {},
      };

    case "move_out":
      return {
        verb: "move_out",
        targetType: "lifecycle",
        targetId: "landlord",
        args: {},
      };

    case "altercate_character": {
      const characterId = String(args.characterId ?? "");
      if (!catalog.characterIds.includes(characterId)) return idleProposal();
      return {
        verb: "altercate",
        targetType: "character",
        targetId: characterId,
        args: {},
      };
    }

    case "altercate_door": {
      const doorId = String(args.doorId ?? "");
      if (!catalog.doorIds.includes(doorId)) return idleProposal();
      return {
        verb: "altercate",
        targetType: "door",
        targetId: doorId,
        args: {},
      };
    }

    default:
      return idleProposal();
  }
}
