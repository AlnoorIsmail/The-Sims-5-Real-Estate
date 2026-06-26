/**
 * Contract between the agent harness and the deterministic sim engine (stage 03).
 * Harness proposes; engine validates and applies truth.
 */

import type {
  BareToolAction,
  CharacterAgentState,
  LandlordState,
  SimEvent,
  SimTickState,
} from "./types";

export interface ActionValidationResult {
  accepted: boolean;
  reason?: string;
  observationForAgent?: string;
}

export interface ToolExecutionResult {
  eventId: string;
  status: "queued" | "completed" | "rejected";
  observation?: string;
}

export interface SimEngine {
  getState(): SimTickState;
  getCharacter(agentId: string): CharacterAgentState | undefined;
  getLandlord(): LandlordState;
  validateProposal(action: BareToolAction): ActionValidationResult;
  submitToolIntent(action: BareToolAction): ToolExecutionResult;
  appendEvent(event: SimEvent): void;
  canIssueTool(agentId: string): boolean;
}

/** Minimal in-memory stub until stage 03 engine is wired. */
export class StubSimEngine implements SimEngine {
  private state: SimTickState;

  constructor(initial: SimTickState) {
    this.state = initial;
  }

  getState(): SimTickState {
    return this.state;
  }

  getCharacter(agentId: string): CharacterAgentState | undefined {
    return this.state.characters[agentId];
  }

  getLandlord(): LandlordState {
    return this.state.landlord;
  }

  validateProposal(action: BareToolAction): ActionValidationResult {
    const character = this.state.characters[action.agentId];
    if (!character) {
      return { accepted: false, reason: "unknown_actor" };
    }

    const blocked: CharacterAgentState["executionState"][] = [
      "waiting_on_tool",
      "moving",
      "acting",
      "speaking",
      "digesting",
      "reflecting",
      "cooling_down",
      "limited_wait",
    ];

    if (blocked.includes(character.executionState) && action.verb !== "idle") {
      return {
        accepted: false,
        reason: "execution_blocked",
        observationForAgent: `Cannot act while ${character.executionState}.`,
      };
    }

    return { accepted: true };
  }

  submitToolIntent(action: BareToolAction): ToolExecutionResult {
    const validation = this.validateProposal(action);
    if (!validation.accepted) {
      return {
        eventId: `rejected-${action.id}`,
        status: "rejected",
        observation: validation.observationForAgent ?? validation.reason,
      };
    }

    const eventId = `engine-${action.id}`;
    this.appendEvent({
      id: eventId,
      day: this.state.day,
      timestamp: Date.now(),
      scope: action.verb === "idle" ? "local" : "local",
      actorId: action.agentId,
      verb: action.verb,
      summary: `${action.agentId} proposed ${action.verb}`,
      sourceEventId: action.id,
    });

    return { eventId, status: "queued" };
  }

  appendEvent(event: SimEvent): void {
    this.state.eventLog.push(event);
  }

  canIssueTool(agentId: string): boolean {
    const character = this.state.characters[agentId];
    if (!character) return false;
    const blocked: CharacterAgentState["executionState"][] = [
      "waiting_on_tool",
      "moving",
      "acting",
      "speaking",
      "digesting",
      "reflecting",
      "cooling_down",
      "limited_wait",
    ];
    return !blocked.includes(character.executionState);
  }
}
