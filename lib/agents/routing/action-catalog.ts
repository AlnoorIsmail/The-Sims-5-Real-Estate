import type { AgentContextBundle } from "../types";
import type { HarnessToolDefinition } from "../llm/language-model";

export interface ActionCatalog {
  tools: HarnessToolDefinition[];
  characterIds: string[];
  roomIds: string[];
  locationIds: string[];
  doorIds: string[];
}

const SPEED_ENUM = ["walk", "run"] as const;

export function buildActionCatalog(context: AgentContextBundle): ActionCatalog {
  const { visibleWorld } = context;
  const characterIds = visibleWorld.visibleCharacters.map((c) => c.id);
  const roomIds = visibleWorld.reachableRooms.map((r) => r.id);
  const locationIds = visibleWorld.staticEndpoints.map((e) => e.id);
  const doorIds = visibleWorld.nearbyDoors.map((d) => d.id);

  const tools: HarnessToolDefinition[] = [
    {
      name: "idle",
      description: "Wait or do nothing this turn.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  ];

  if (characterIds.length > 0) {
    tools.push({
      name: "move_to_character",
      description: "Walk or run toward another visible character.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string", enum: characterIds },
          speed: { type: "string", enum: [...SPEED_ENUM] },
        },
        required: ["characterId", "speed"],
      },
    });
    tools.push({
      name: "say_to",
      description: "Speak to a visible character. Provide your spoken message.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string", enum: characterIds },
          message: { type: "string", description: "What you say aloud." },
          interrupt: { type: "boolean", description: "Rude interrupt if true." },
        },
        required: ["characterId", "message"],
      },
    });
    tools.push({
      name: "altercate_character",
      description: "Escalate conflict with a visible character.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string", enum: characterIds },
        },
        required: ["characterId"],
      },
    });
  }

  if (roomIds.length > 0) {
    tools.push({
      name: "move_to_room",
      description: "Move into a unit room.",
      parameters: {
        type: "object",
        properties: {
          roomId: { type: "string", enum: roomIds },
          speed: { type: "string", enum: [...SPEED_ENUM] },
        },
        required: ["roomId", "speed"],
      },
    });
  }

  if (locationIds.length > 0) {
    tools.push({
      name: "move_to_location",
      description: "Move to a hall, stair, lobby, or exterior endpoint.",
      parameters: {
        type: "object",
        properties: {
          locationId: { type: "string", enum: locationIds },
          speed: { type: "string", enum: [...SPEED_ENUM] },
        },
        required: ["locationId", "speed"],
      },
    });
  }

  if (doorIds.length > 0) {
    tools.push({
      name: "move_to_door",
      description: "Move to a unit door.",
      parameters: {
        type: "object",
        properties: {
          doorId: { type: "string", enum: doorIds },
          speed: { type: "string", enum: [...SPEED_ENUM] },
        },
        required: ["doorId", "speed"],
      },
    });
    tools.push({
      name: "altercate_door",
      description: "Escalate at a door (forced entry is adjudicated).",
      parameters: {
        type: "object",
        properties: {
          doorId: { type: "string", enum: doorIds },
        },
        required: ["doorId"],
      },
    });
  }

  tools.push(
    {
      name: "request_repair",
      description: "Ask the landlord for maintenance.",
      parameters: {
        type: "object",
        properties: {
          issue: { type: "string", description: "Brief issue description." },
        },
        required: [],
      },
    },
    {
      name: "file_complaint",
      description: "File a complaint with the landlord.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Complaint summary." },
        },
        required: [],
      },
    },
    {
      name: "pay_rent",
      description: "Pay rent to the landlord.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "skip_rent",
      description: "Skip rent this cycle (high urgency).",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "move_in",
      description: "Request to move into a unit.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "move_out",
      description: "Request to move out.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  );

  return { tools, characterIds, roomIds, locationIds, doorIds };
}
