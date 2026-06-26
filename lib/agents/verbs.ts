import type { ActionTargetType, ActionVerb } from "@/lib/sim/types";

export interface VerbTargetRule {
  verb: ActionVerb;
  allowedTargetTypes: ActionTargetType[];
  routesTo: "engine" | "landlord" | "game_master";
  description: string;
}

/** Frozen v1 action vocabulary and routing from simulation-rules.md */
export const VERB_TARGET_MAP: VerbTargetRule[] = [
  {
    verb: "move_to",
    allowedTargetTypes: ["character", "room", "location", "door"],
    routesTo: "engine",
    description: "Move to a character, room, generated location, or door endpoint.",
  },
  {
    verb: "say_to",
    allowedTargetTypes: ["character"],
    routesTo: "engine",
    description: "Speak to a visible character; optional interrupt flag.",
  },
  {
    verb: "request_repair",
    allowedTargetTypes: ["landlord"],
    routesTo: "landlord",
    description: "Request maintenance through the landlord gateway.",
  },
  {
    verb: "file_complaint",
    allowedTargetTypes: ["landlord"],
    routesTo: "landlord",
    description: "File a complaint through the landlord gateway.",
  },
  {
    verb: "pay_rent",
    allowedTargetTypes: ["landlord"],
    routesTo: "landlord",
    description: "Pay rent through the landlord gateway.",
  },
  {
    verb: "skip_rent",
    allowedTargetTypes: ["landlord"],
    routesTo: "landlord",
    description: "Skip rent; priority landlord notification.",
  },
  {
    verb: "move_in",
    allowedTargetTypes: ["lifecycle"],
    routesTo: "landlord",
    description: "Request move-in; landlord-mediated lifecycle action.",
  },
  {
    verb: "move_out",
    allowedTargetTypes: ["lifecycle"],
    routesTo: "landlord",
    description: "Request move-out; landlord-mediated lifecycle action.",
  },
  {
    verb: "altercate",
    allowedTargetTypes: ["character", "door"],
    routesTo: "game_master",
    description: "Escalate conflict; GM adjudicates forced entry and incidents.",
  },
  {
    verb: "idle",
    allowedTargetTypes: ["none"],
    routesTo: "engine",
    description: "Explicit wait or no-op.",
  },
];

export const LANDLORD_FACING_VERBS: ActionVerb[] = [
  "request_repair",
  "file_complaint",
  "pay_rent",
  "skip_rent",
  "move_in",
  "move_out",
];

export const PRIORITY_LANDLORD_VERBS: ActionVerb[] = ["skip_rent"];

export function getVerbRule(verb: ActionVerb): VerbTargetRule | undefined {
  return VERB_TARGET_MAP.find((rule) => rule.verb === verb);
}

export function isValidBareTool(
  verb: ActionVerb,
  targetType: ActionTargetType
): boolean {
  const rule = getVerbRule(verb);
  if (!rule) return false;
  return rule.allowedTargetTypes.includes(targetType);
}

export const BARE_TOOL_OUTPUT_SCHEMA = {
  type: "object",
  required: ["verb", "targetType", "targetId", "args"],
  properties: {
    verb: { type: "string", enum: VERB_TARGET_MAP.map((r) => r.verb) },
    targetType: {
      type: "string",
      enum: ["character", "room", "location", "door", "landlord", "lifecycle", "none"],
    },
    targetId: { type: "string" },
    args: { type: "object" },
  },
  additionalProperties: false,
};
