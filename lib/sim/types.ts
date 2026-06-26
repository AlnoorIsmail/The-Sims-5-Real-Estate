/** Plain data shapes from icm/stages/02_data_state_model/output/state-model.md */

export type RoomTemplateId = "basic" | "cluttered" | "premium";

export type LocationType =
  | "room"
  | "hall"
  | "stair"
  | "lobby"
  | "exterior"
  | "door"
  | "global";

export type LifecycleState =
  | "prospect"
  | "applicant"
  | "approved"
  | "rejected"
  | "moving_in"
  | "current"
  | "notice_given"
  | "moving_out"
  | "evicted"
  | "former"
  | "inactive";

export type RentAccountState =
  | "paid"
  | "due"
  | "late"
  | "delinquent"
  | "skipped"
  | "defaulted";

export type ExecutionState =
  | "idle"
  | "observing"
  | "retrieving"
  | "deciding"
  | "waiting_on_tool"
  | "moving"
  | "acting"
  | "speaking"
  | "digesting"
  | "reflecting"
  | "cooling_down"
  | "limited_wait";

export type MovementStatus =
  | "idle"
  | "started_to_move"
  | "moving"
  | "arrived"
  | "unreachable_endpoint";

export type ActionVerb =
  | "move_to"
  | "say_to"
  | "request_repair"
  | "file_complaint"
  | "pay_rent"
  | "skip_rent"
  | "move_in"
  | "move_out"
  | "altercate"
  | "idle";

export type ActionTargetType =
  | "character"
  | "room"
  | "location"
  | "door"
  | "landlord"
  | "lifecycle"
  | "none";

export type MoveSpeed = "walk" | "run";

export type AccessIntent =
  | "normal"
  | "invited"
  | "landlord_permitted"
  | "altercate";

export type ReplanReason =
  | "target_moved"
  | "target_changed_location"
  | "stale_path"
  | "access_changed"
  | "layout_changed";

export type CapitalSourceType =
  | "rent_payment"
  | "skipped_rent"
  | "renovation"
  | "maintenance"
  | "move_in"
  | "move_out"
  | "deposit"
  | "fee"
  | "incentive"
  | "gm_incident";

export type ActionSource =
  | "character_agent"
  | "landlord"
  | "game_master"
  | "mock"
  | "system";

export type MemoryType =
  | "episodic"
  | "semantic"
  | "relationship"
  | "reflection"
  | "news"
  | "summary";

export type PendingReplyStatus = "pending" | "answered" | "expired";

export interface GridCell {
  x: number;
  y: number;
  floorIndex: number;
}

export interface BuildingConfig {
  floors: number;
  unitsPerFloor: number;
  seed: string;
  roomTemplates: RoomTemplateId[];
}

export interface UnitState {
  id: string;
  floorIndex: number;
  columnIndex: number;
  templateId: RoomTemplateId;
  qualityLevel: number;
  tenantId?: string;
  doorLocationId: string;
  roomLocationId: string;
  rentPotential: number;
  maintenancePressure: number;
  satisfactionModifier: number;
}

export interface LocationNode {
  id: string;
  type: LocationType;
  floorIndex?: number;
  unitId?: string;
  cell: GridCell;
  label: string;
  subscribers: string[];
}

export interface DoorNode {
  id: string;
  unitId: string;
  hallLocationId: string;
  roomLocationId: string;
  cell: GridCell;
  lockedForVisitor: boolean;
}

export interface StairLink {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  fromCell: GridCell;
  toCell: GridCell;
  direction: "up" | "down";
}

export interface GeneratedBuilding {
  config: BuildingConfig;
  units: UnitState[];
  locations: LocationNode[];
  doors: DoorNode[];
  stairs: StairLink[];
  walkableCells: GridCell[];
  blockedCells: GridCell[];
  spawnPoints: Record<string, GridCell>;
  locationCells?: Record<string, GridCell[]>;
}

export interface CapitalEvent {
  id: string;
  day: number;
  timestamp: number;
  sourceType: CapitalSourceType;
  amountAed: number;
  budgetDeltaAed: number;
  budgetBeforeAed: number;
  budgetAfterAed: number;
  capitalEventId: string;
  unitId?: string;
  residentId?: string;
  description: string;
  sourceEventId: string;
}

export interface RunControls {
  floors: number;
  unitsPerFloor: number;
  seed: string;
  dayLengthMs: number;
  mockMode: boolean;
  autonomousMode: boolean;
}

export interface LandlordState {
  id: string;
  initialBudgetAed: number;
  budgetAed: number;
  capitalEvents: CapitalEvent[];
  requestQueue?: LandlordRequestQueueState;
  selectedFloorIndex?: number;
  selectedUnitId?: string;
  runControls: RunControls;
}

export interface PathRequest {
  actorId: string;
  targetType: "character" | "room" | "location" | "door";
  targetId: string;
  speed: MoveSpeed;
  accessIntent: AccessIntent;
}

export interface PathResult {
  status: "reachable" | "nearest_reachable" | "rejected";
  waypoints: GridCell[];
  finalLocationId: string;
  finalCell?: GridCell;
  targetLocationId?: string;
  targetCharacterId?: string;
  dynamicTarget?: boolean;
  unreachableReason?: string;
}

export interface MovementState {
  id?: string;
  actorId: string;
  status: MovementStatus;
  fromLocationId: string;
  targetLocationId: string;
  targetCharacterId?: string;
  targetRoomId?: string;
  lastResolvedTargetCell?: GridCell;
  lastResolvedTargetLocationId?: string;
  dynamicTarget: boolean;
  replanReason?: ReplanReason;
  currentWaypointIndex: number;
  path: GridCell[];
  sourceActionId?: string;
  finalCell?: GridCell;
  pathStatus?: PathResult["status"];
  unreachableReason?: string;
}

export interface PendingReply {
  id: string;
  speakerId: string;
  targetId: string;
  sourceSpeechEventId: string;
  deadlineMs: number;
  createdAt: number;
  status: PendingReplyStatus;
}

export interface SocialReplyState {
  pendingReplies: PendingReply[];
}

export interface RawPerception {
  id: string;
  day: number;
  timestamp: number;
  locationId: string;
  locationType: LocationType;
  text: string;
  sourceEventId?: string;
  muffled?: boolean;
}

export interface PerceptionDigestRequest {
  id: string;
  rawPerceptionIds: string[];
  requestedAt: number;
}

export interface MemoryWriteRequest {
  id: string;
  agentId: string;
  document: string;
  metadata: MemoryRecordMetadata;
}

export interface MemoryRecordMetadata {
  memoryType: MemoryType;
  day: number;
  locationId: string;
  locationType: LocationType;
  participants: string[];
  tags: string[];
  importance: number;
  sourceEventId?: string;
  timestamp: number;
}

export interface PerceptionState {
  rawQueue: RawPerception[];
  digestQueue: PerceptionDigestRequest[];
  pendingMemoryWrites: MemoryWriteRequest[];
  meaningfulEventCount: number;
  lastReflectionAt?: number;
}

export interface BehaviorState {
  needs: number;
  mood: number;
  stress: number;
  patience: number;
  sociability: number;
  conflictTolerance: number;
  landlordTrust: number;
  rentPressure: number;
  attachmentToUnit: number;
  extraversion: number;
  agreeableness: number;
  conscientiousness: number;
  neuroticism: number;
}

export interface GoalState {
  currentGoal: string;
  obligations: string[];
  fears: string[];
  promises: string[];
}

export interface AgentLimiterState {
  lastDecisionAt?: number;
  lastDigestAt?: number;
  lastReflectionAt?: number;
  softMinimumSatisfied: boolean;
  limitedWaitReason?: string;
}

export interface CharacterAgentState {
  agentId: string;
  lifecycleState: LifecycleState;
  rentAccountState: RentAccountState;
  executionState: ExecutionState;
  socialReplyState: SocialReplyState;
  perceptionState: PerceptionState;
  behaviorState: BehaviorState;
  goalState: GoalState;
  limiterState: AgentLimiterState;
  idempotencyScopeId: string;
  currentLocationId: string;
  currentCell?: GridCell;
  ownedUnitId?: string;
  spriteKey: string;
  displayName: string;
}

export interface BareToolAction {
  id: string;
  agentId: string;
  verb: ActionVerb;
  targetType: ActionTargetType;
  targetId: string;
  args: Record<string, unknown>;
}

export interface SimEvent {
  id: string;
  day: number;
  timestamp: number;
  scope: "local" | "global";
  locationId?: string;
  locationType?: LocationType;
  actorId?: string;
  targetId?: string;
  verb?: ActionVerb;
  visibility?: "public" | "private";
  participants?: string[];
  tags?: string[];
  summary: string;
  sourceEventId?: string;
  budgetDeltaAed?: number;
  budgetBeforeAed?: number;
  budgetAfterAed?: number;
  capitalEventId?: string;
}

export interface LandlordResponse {
  choice?: string;
  freeText?: string;
  approved?: boolean;
  status?: "answered" | "timed_out";
  timestamp?: number;
  budgetDeltaAed?: number;
}

export type LandlordRequestStatus =
  | "pending"
  | "active"
  | "answered"
  | "timed_out";

export type LandlordRequestUrgency = "low" | "medium" | "high" | "critical";

export interface LandlordRequest {
  id: string;
  sourceActionId: string;
  requesterId: string;
  verb: ActionVerb;
  targetId: string;
  args?: Record<string, unknown>;
  summary: string;
  urgency: LandlordRequestUrgency;
  priority: number;
  suggestedChoices: string[];
  defaultChoice: string;
  createdAt: number;
  timeoutAt: number;
  status: LandlordRequestStatus;
  response?: LandlordResponse;
}

export interface LandlordRequestQueueState {
  activeRequestId?: string;
  pendingRequestIds: string[];
  requests: Record<string, LandlordRequest>;
}

export interface QueuedAction {
  id: string;
  action: BareToolAction;
  source: ActionSource;
  status: "queued" | "completed" | "rejected";
  createdAt: number;
  eventId?: string;
  reason?: string;
}

export interface IdempotencyLedgerState {
  toolIntentIds: Record<string, true>;
  engineEventIds: Record<string, true>;
  memoryWriteIds: Record<string, true>;
  budgetEventIds: Record<string, true>;
}

export interface SimMetricState {
  reputation: number;
  satisfaction: number;
  maintenancePressure: number;
  occupancyRate: number;
  churnRisk: number;
  incidentSeverity: number;
  roiProxy: number;
}

export interface MockScenarioState {
  name: string;
  nextActionIndex: number;
  actions: BareToolAction[];
}

export interface SimTickState {
  day: number;
  dayPhase: "morning_brief" | "autonomous" | "closing" | "summary";
  elapsedMs: number;
  building: GeneratedBuilding;
  landlord: LandlordState;
  characters: Record<string, CharacterAgentState>;
  movements: Record<string, MovementState>;
  actionQueue?: QueuedAction[];
  eventLog: SimEvent[];
  idempotencyLedger?: IdempotencyLedgerState;
  metrics?: SimMetricState;
  mockScenario?: MockScenarioState;
}
