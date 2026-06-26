import type { BareToolAction, SimEvent } from "@/lib/sim/types";
import type { LandlordActionCard } from "../types";

export type SimulationMessageType =
  | "speech_published"
  | "tool_intent_submitted"
  | "landlord_request_queued"
  | "gm_adjudication_needed"
  | "gm_narration"
  | "perception_digested"
  | "silence_observed";

interface BaseMessage {
  id: string;
  type: SimulationMessageType;
  timestamp: number;
  day: number;
}

export interface SpeechPublishedMessage extends BaseMessage {
  type: "speech_published";
  speakerId: string;
  targetId: string;
  message: string;
  sourceActionId: string;
  interrupt?: boolean;
}

export interface ToolIntentSubmittedMessage extends BaseMessage {
  type: "tool_intent_submitted";
  action: BareToolAction;
}

export interface LandlordRequestQueuedMessage extends BaseMessage {
  type: "landlord_request_queued";
  card: LandlordActionCard;
  sourceActionId: string;
}

export interface GmAdjudicationNeededMessage extends BaseMessage {
  type: "gm_adjudication_needed";
  action: BareToolAction;
  landlordCard?: LandlordActionCard;
}

export interface GmNarrationMessage extends BaseMessage {
  type: "gm_narration";
  narrationKind: "morning_brief" | "day_summary" | "adjudication";
  text: string;
  sourceEvent?: SimEvent;
}

export interface PerceptionDigestedMessage extends BaseMessage {
  type: "perception_digested";
  agentId: string;
  digests: Array<{ rawPerceptionId: string; subjectiveNote: string }>;
}

export interface SilenceObservedMessage extends BaseMessage {
  type: "silence_observed";
  speakerId: string;
  targetId: string;
  sourceSpeechEventId: string;
}

export type SimulationMessage =
  | SpeechPublishedMessage
  | ToolIntentSubmittedMessage
  | LandlordRequestQueuedMessage
  | GmAdjudicationNeededMessage
  | GmNarrationMessage
  | PerceptionDigestedMessage
  | SilenceObservedMessage;
