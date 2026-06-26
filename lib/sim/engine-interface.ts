/**
 * Contract between the agent harness and the deterministic sim engine (stage 03).
 * Harness proposes; engine validates and applies truth.
 */

import type {
  AccessIntent,
  ActionSource,
  ActionTargetType,
  ActionVerb,
  BareToolAction,
  BehaviorState,
  BuildingConfig,
  CapitalEvent,
  CapitalSourceType,
  CharacterAgentState,
  ExecutionState,
  GeneratedBuilding,
  GridCell,
  LandlordRequest,
  LandlordResponse,
  LandlordState,
  LocationNode,
  MovementState,
  PathRequest,
  PathResult,
  QueuedAction,
  RoomTemplateId,
  SimEvent,
  SimMetricState,
  SimTickState,
  UnitState,
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
  movementId?: string;
  requestId?: string;
  path?: PathResult;
}

export interface InitialSimConfig {
  floors?: number;
  unitsPerFloor?: number;
  seed?: string;
  initialBudgetAed?: number;
  dayLengthMs?: number;
  mockMode?: boolean;
  autonomousMode?: boolean;
  roomTemplates?: RoomTemplateId[];
}

export interface InitialCharacterSeed {
  agentId: string;
  displayName: string;
  spriteKey?: string;
  lifecycleState?: CharacterAgentState["lifecycleState"];
  rentAccountState?: CharacterAgentState["rentAccountState"];
  ownedUnitId?: string;
  locationId?: string;
  currentCell?: GridCell;
  behaviorState?: Partial<BehaviorState>;
}

export interface InitialSimScenario {
  name?: string;
  characters?: InitialCharacterSeed[];
  mockActions?: BareToolAction[];
  selectedFloorIndex?: number;
  selectedUnitId?: string;
}

export interface AdvanceSimDayOptions {
  now?: number;
  actions?: BareToolAction[];
  actionSource?: ActionSource;
  runMockScenario?: boolean;
  completeMovements?: boolean;
  publishSummary?: boolean;
  morningBrief?: string;
}

export interface BudgetDeltaInput {
  id?: string;
  sourceEventId: string;
  sourceType: CapitalSourceType;
  amountAed: number;
  description: string;
  unitId?: string;
  residentId?: string;
  timestamp?: number;
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

const DEFAULT_ROOM_TEMPLATES: RoomTemplateId[] = ["basic", "cluttered", "premium"];

const BLOCKED_EXECUTION_STATES: ExecutionState[] = [
  "waiting_on_tool",
  "moving",
  "acting",
  "speaking",
  "digesting",
  "reflecting",
  "cooling_down",
  "limited_wait",
];

const VERB_TARGETS: Record<ActionVerb, ActionTargetType[]> = {
  move_to: ["character", "room", "location", "door"],
  say_to: ["character"],
  request_repair: ["landlord"],
  file_complaint: ["landlord"],
  pay_rent: ["landlord"],
  skip_rent: ["landlord"],
  move_in: ["lifecycle"],
  move_out: ["lifecycle"],
  altercate: ["character", "door"],
  idle: ["none"],
};

const DEFAULT_CHARACTER_SEEDS: Array<Omit<InitialCharacterSeed, "ownedUnitId">> = [
  {
    agentId: "resident-vampire-girl",
    displayName: "Luna",
    spriteKey: "assets/fancy_people/Vampire_Girl",
  },
  {
    agentId: "resident-countess",
    displayName: "Countess",
    spriteKey: "assets/fancy_people/Countess_Vampire",
  },
  {
    agentId: "resident-gangster-2",
    displayName: "Marco",
    spriteKey: "assets/Gangsters_2",
  },
  {
    agentId: "resident-gangster-3",
    displayName: "Vince",
    spriteKey: "assets/Gangsters_3",
  },
  {
    agentId: "resident-skelly",
    displayName: "Skelly",
    spriteKey: "assets/FREE_SkeletonPack_ByPhewcumber",
  },
];

export function createInitialSimState(
  config: InitialSimConfig = {},
  scenario: InitialSimScenario = {}
): SimTickState {
  const building = createGeneratedBuilding(config);
  const budgetAed = config.initialBudgetAed ?? 250_000;
  const characters = seedCharacters(building, config.seed ?? "demo", scenario);

  for (const character of Object.values(characters)) {
    const location = getLocationById(building, character.currentLocationId);
    if (location && !location.subscribers.includes(character.agentId)) {
      location.subscribers.push(character.agentId);
    }

    if (character.ownedUnitId) {
      const unit = building.units.find((candidate) => candidate.id === character.ownedUnitId);
      if (unit) unit.tenantId = character.agentId;
    }
  }

  const state: SimTickState = {
    day: 1,
    dayPhase: "morning_brief",
    elapsedMs: 0,
    building,
    landlord: {
      id: "landlord",
      initialBudgetAed: budgetAed,
      budgetAed,
      capitalEvents: [],
      selectedFloorIndex: scenario.selectedFloorIndex,
      selectedUnitId: scenario.selectedUnitId,
      runControls: {
        floors: building.config.floors,
        unitsPerFloor: building.config.unitsPerFloor,
        seed: building.config.seed,
        dayLengthMs: config.dayLengthMs ?? 45_000,
        mockMode: config.mockMode ?? true,
        autonomousMode: config.autonomousMode ?? true,
      },
    },
    characters,
    movements: {},
    actionQueue: [],
    eventLog: [],
    metrics: createInitialMetrics(building),
  };

  ensureRuntimeState(state);

  const actions =
    scenario.mockActions ??
    (scenario.name ? createDeterministicMockActions(state, scenario.name) : []);
  if (actions.length > 0) {
    state.mockScenario = {
      name: scenario.name ?? "custom",
      nextActionIndex: 0,
      actions,
    };
  }

  return state;
}

export function submitAction(
  state: SimTickState,
  action: BareToolAction,
  source: ActionSource = "character_agent"
): ToolExecutionResult {
  ensureRuntimeState(state);

  const duplicateEventId = `engine:${action.id}`;
  const ledger = requireLedger(state);
  const queue = requireActionQueue(state);
  if (ledger.toolIntentIds[action.id]) {
    return {
      eventId: duplicateEventId,
      status: "completed",
      observation: "duplicate_tool_intent_ignored",
    };
  }
  ledger.toolIntentIds[action.id] = true;

  const queuedAction: QueuedAction = {
    id: `queue:${action.id}`,
    action,
    source,
    status: "queued",
    createdAt: now(),
  };
  queue.push(queuedAction);

  const validation = validateAction(state, action);
  if (!validation.accepted) {
    const event = publishResolvedEvent(state, {
      id: `rejected:${action.id}`,
      day: state.day,
      timestamp: now(),
      scope: "local",
      actorId: action.agentId,
      verb: action.verb,
      summary: validation.observationForAgent ?? validation.reason ?? "Action rejected.",
      sourceEventId: action.id,
    });
    queuedAction.status = "rejected";
    queuedAction.eventId = event.id;
    queuedAction.reason = validation.reason;
    return {
      eventId: event.id,
      status: "rejected",
      observation: validation.observationForAgent ?? validation.reason,
    };
  }

  if (action.verb === "idle") {
    const event = publishResolvedEvent(state, {
      id: duplicateEventId,
      day: state.day,
      timestamp: now(),
      scope: "local",
      actorId: action.agentId,
      verb: action.verb,
      locationId: state.characters[action.agentId]?.currentLocationId,
      summary: `${displayName(state, action.agentId)} waits.`,
      sourceEventId: action.id,
    });
    queuedAction.status = "completed";
    queuedAction.eventId = event.id;
    return { eventId: event.id, status: "completed" };
  }

  if (action.verb === "move_to") {
    return submitMovementAction(state, action, queuedAction);
  }

  if (action.verb === "say_to") {
    return submitSpeechAction(state, action, queuedAction);
  }

  if (isLandlordFacing(action.verb) || action.verb === "altercate") {
    const request = enqueueLandlordRequest(state, action);
    const event = publishResolvedEvent(state, {
      id: duplicateEventId,
      day: state.day,
      timestamp: now(),
      scope: action.verb === "altercate" ? "global" : "local",
      actorId: action.agentId,
      targetId: action.targetId,
      verb: action.verb,
      locationId: state.characters[action.agentId]?.currentLocationId,
      summary: `${displayName(state, action.agentId)} submitted ${action.verb}.`,
      sourceEventId: action.id,
      tags: ["landlord_request"],
    });
    queuedAction.status = "completed";
    queuedAction.eventId = event.id;
    return {
      eventId: event.id,
      status: "queued",
      requestId: request?.id,
    };
  }

  const event = publishResolvedEvent(state, {
    id: duplicateEventId,
    day: state.day,
    timestamp: now(),
    scope: "local",
    actorId: action.agentId,
    verb: action.verb,
    locationId: state.characters[action.agentId]?.currentLocationId,
    summary: `${displayName(state, action.agentId)} completed ${action.verb}.`,
    sourceEventId: action.id,
  });
  queuedAction.status = "completed";
  queuedAction.eventId = event.id;
  return { eventId: event.id, status: "completed" };
}

export function advanceSimDay(
  state: SimTickState,
  opts: AdvanceSimDayOptions = {}
): SimTickState {
  ensureRuntimeState(state);
  const timestamp = opts.now ?? now();

  state.dayPhase = "morning_brief";
  publishResolvedEvent(state, {
    id: `day:${state.day}:morning`,
    day: state.day,
    timestamp,
    scope: "global",
    summary: opts.morningBrief ?? `Day ${state.day} starts in mock simulation mode.`,
    tags: ["morning_brief"],
  });

  state.dayPhase = "autonomous";
  const actions = resolveDayActions(state, opts);
  for (const action of actions) {
    const result = submitAction(state, action, opts.actionSource ?? "mock");
    if (opts.completeMovements && result.movementId) {
      const movement = findMovementById(state, result.movementId);
      const finalCell = movement?.finalCell ?? movement?.path.at(-1);
      if (finalCell) completeMovement(state, result.movementId, finalCell);
    }
  }

  replanDynamicMovements(state);
  expireLandlordRequests(state, timestamp);

  state.dayPhase = "closing";
  if (opts.publishSummary !== false) {
    publishResolvedEvent(state, {
      id: `day:${state.day}:summary`,
      day: state.day,
      timestamp,
      scope: "global",
      summary: `Day ${state.day} closes with ${state.eventLog.length} logged events.`,
      tags: ["daily_summary"],
    });
  }

  state.elapsedMs = 0;
  state.day += 1;
  state.dayPhase = "morning_brief";
  return state;
}

export function resolvePath(state: SimTickState, request: PathRequest): PathResult {
  ensureRuntimeState(state);
  const actor = state.characters[request.actorId];
  if (!actor) {
    return rejectedPath("unknown_actor");
  }

  const start = actor.currentCell ?? getLocationById(state.building, actor.currentLocationId)?.cell;
  if (!start) {
    return rejectedPath("unknown_actor_location");
  }

  const target = resolvePathTarget(state, actor, request);
  if (!target) {
    return rejectedPath("unknown_target");
  }

  const pathResult = findAStarPath(state.building, start, target.cell);
  if (pathResult.path) {
    return {
      status: "reachable",
      waypoints: pathResult.path,
      finalLocationId: target.locationId,
      finalCell: target.cell,
      targetLocationId: target.locationId,
      targetCharacterId: request.targetType === "character" ? request.targetId : undefined,
      dynamicTarget: request.targetType === "character",
    };
  }

  const fallback = nearestReachableFallback(
    state,
    pathResult.visited,
    pathResult.cameFrom,
    start,
    target.cell
  );
  if (!fallback) {
    return rejectedPath("unreachable_endpoint");
  }

  return {
    status: "nearest_reachable",
    waypoints: fallback.path,
    finalLocationId: fallback.locationId,
    finalCell: fallback.cell,
    targetLocationId: fallback.locationId,
    targetCharacterId: request.targetType === "character" ? request.targetId : undefined,
    dynamicTarget: request.targetType === "character",
    unreachableReason: "unreachable_endpoint",
  };
}

export function completeMovement(
  state: SimTickState,
  movementId: string,
  finalCell: GridCell
): ToolExecutionResult {
  ensureRuntimeState(state);
  const movement = findMovementById(state, movementId);
  if (!movement) {
    return {
      eventId: `movement-missing:${movementId}`,
      status: "rejected",
      observation: "unknown_movement",
    };
  }

  if (movement.status === "arrived" || movement.status === "unreachable_endpoint") {
    return {
      eventId: `movement-complete:${movement.id ?? movement.actorId}`,
      status: "completed",
      observation: "duplicate_movement_completion_ignored",
    };
  }

  const actor = state.characters[movement.actorId];
  if (!actor) {
    return {
      eventId: `movement-complete:${movement.id ?? movement.actorId}`,
      status: "rejected",
      observation: "unknown_actor",
    };
  }

  const previousLocationId = actor.currentLocationId;
  const finalLocationId =
    findLocationIdForCell(state.building, finalCell) ?? movement.targetLocationId;
  unsubscribe(state, previousLocationId, actor.agentId);
  subscribe(state, finalLocationId, actor.agentId);

  actor.currentLocationId = finalLocationId;
  actor.currentCell = cloneCell(finalCell);
  actor.executionState = "idle";

  movement.status =
    movement.pathStatus === "nearest_reachable" ? "unreachable_endpoint" : "arrived";
  movement.currentWaypointIndex = Math.max(0, movement.path.length - 1);
  movement.finalCell = cloneCell(finalCell);

  const event = publishResolvedEvent(state, {
    id: `movement-complete:${movement.id ?? movement.actorId}`,
    day: state.day,
    timestamp: now(),
    scope: "local",
    locationId: finalLocationId,
    locationType: getLocationById(state.building, finalLocationId)?.type,
    actorId: actor.agentId,
    verb: "move_to",
    summary:
      movement.status === "unreachable_endpoint"
        ? `${actor.displayName} reached the nearest safe point instead of the endpoint.`
        : `${actor.displayName} arrived at ${labelLocation(state, finalLocationId)}.`,
    sourceEventId: movement.sourceActionId,
    tags: ["movement_complete"],
  });

  return {
    eventId: event.id,
    status: "completed",
    movementId: movement.id,
  };
}

export function respondToLandlordRequest(
  state: SimTickState,
  requestId: string,
  response: LandlordResponse
): ToolExecutionResult {
  ensureRuntimeState(state);
  const queue = requireLandlordQueue(state);
  const request = queue.requests[requestId];
  if (!request) {
    return {
      eventId: `landlord-response-missing:${requestId}`,
      status: "rejected",
      observation: "unknown_landlord_request",
    };
  }

  if (request.status === "answered" || request.status === "timed_out") {
    return {
      eventId: `landlord-response:${requestId}`,
      status: "completed",
      observation: "duplicate_landlord_response_ignored",
      requestId,
    };
  }

  const status = response.status ?? "answered";
  request.status = status;
  request.response = response;
  if (queue.activeRequestId === requestId) {
    queue.activeRequestId = queue.pendingRequestIds.shift();
    if (queue.activeRequestId) {
      queue.requests[queue.activeRequestId].status = "active";
    }
  } else {
    queue.pendingRequestIds = queue.pendingRequestIds.filter((id) => id !== requestId);
  }

  const eventId = `landlord-response:${requestId}`;
  const capitalEvent = applyLandlordRequestBudgetEffect(state, request, response, eventId);
  const event = publishResolvedEvent(state, {
    id: eventId,
    day: state.day,
    timestamp: response.timestamp ?? now(),
    scope: "global",
    actorId: request.requesterId,
    verb: request.verb,
    summary: summarizeLandlordResponse(request, response),
    sourceEventId: request.sourceActionId,
    tags: ["landlord_response"],
    budgetDeltaAed: capitalEvent?.budgetDeltaAed,
    budgetBeforeAed: capitalEvent?.budgetBeforeAed,
    budgetAfterAed: capitalEvent?.budgetAfterAed,
    capitalEventId: capitalEvent?.id,
  });

  return {
    eventId: event.id,
    status: "completed",
    requestId,
  };
}

export function publishResolvedEvent(state: SimTickState, event: SimEvent): SimEvent {
  ensureRuntimeState(state);
  const ledger = requireLedger(state);
  if (ledger.engineEventIds[event.id]) {
    return state.eventLog.find((candidate) => candidate.id === event.id) ?? event;
  }

  ledger.engineEventIds[event.id] = true;
  const normalized = normalizeEvent(state, event);
  state.eventLog.push(normalized);
  publishPerceptions(state, normalized);
  updateMetricsFromEvent(state, normalized);
  return normalized;
}

export function applyBudgetDelta(
  state: SimTickState,
  input: BudgetDeltaInput
): CapitalEvent {
  ensureRuntimeState(state);
  const ledger = requireLedger(state);
  const capitalEventId =
    input.id ??
    `capital:${input.sourceEventId}:${input.sourceType}:${input.amountAed}`;
  const existing = state.landlord.capitalEvents.find(
    (event) => event.id === capitalEventId
  );
  if (ledger.budgetEventIds[capitalEventId] && existing) {
    return existing;
  }

  ledger.budgetEventIds[capitalEventId] = true;
  const budgetBeforeAed = state.landlord.budgetAed;
  const budgetAfterAed = budgetBeforeAed + input.amountAed;
  state.landlord.budgetAed = budgetAfterAed;

  const capitalEvent: CapitalEvent = {
    id: capitalEventId,
    capitalEventId,
    day: state.day,
    timestamp: input.timestamp ?? now(),
    sourceType: input.sourceType,
    amountAed: input.amountAed,
    budgetDeltaAed: input.amountAed,
    budgetBeforeAed,
    budgetAfterAed,
    unitId: input.unitId,
    residentId: input.residentId,
    description: input.description,
    sourceEventId: input.sourceEventId,
  };

  state.landlord.capitalEvents.push(capitalEvent);
  if (state.metrics) {
    state.metrics.roiProxy = clampMetric(state.metrics.roiProxy + input.amountAed / 10_000);
  }
  return capitalEvent;
}

/** Deterministic engine; class name kept for existing harness imports. */
export class StubSimEngine implements SimEngine {
  private state: SimTickState;

  constructor(initial: SimTickState = createInitialSimState()) {
    this.state = initial;
    ensureRuntimeState(this.state);
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
    return validateAction(this.state, action);
  }

  submitToolIntent(action: BareToolAction): ToolExecutionResult {
    return submitAction(this.state, action, "character_agent");
  }

  appendEvent(event: SimEvent): void {
    publishResolvedEvent(this.state, event);
  }

  canIssueTool(agentId: string): boolean {
    return canIssueTool(this.state, agentId);
  }
}

export const DeterministicSimEngine = StubSimEngine;

function createGeneratedBuilding(config: InitialSimConfig): GeneratedBuilding {
  const floors = clampInt(config.floors, 2, 4, 2);
  const unitsPerFloor = clampInt(config.unitsPerFloor, 2, 5, 3);
  const seed = config.seed ?? "demo";
  const templates = config.roomTemplates?.length
    ? config.roomTemplates
    : DEFAULT_ROOM_TEMPLATES;

  const buildingConfig: BuildingConfig = {
    floors,
    unitsPerFloor,
    seed,
    roomTemplates: templates,
  };
  const units: UnitState[] = [];
  const locations: LocationNode[] = [];
  const doors: GeneratedBuilding["doors"] = [];
  const stairs: GeneratedBuilding["stairs"] = [];
  const walkable = new Map<string, GridCell>();
  const locationCells: Record<string, GridCell[]> = {};
  const spawnPoints: Record<string, GridCell> = {};
  const maxHallX = unitsPerFloor * 4;

  const addCell = (locationId: string, cell: GridCell) => {
    const copy = cloneCell(cell);
    walkable.set(cellKey(copy), copy);
    locationCells[locationId] = locationCells[locationId] ?? [];
    if (!locationCells[locationId].some((candidate) => cellsEqual(candidate, copy))) {
      locationCells[locationId].push(copy);
    }
  };

  const addLocation = (node: LocationNode, extraCells: GridCell[] = []) => {
    locations.push(node);
    addCell(node.id, node.cell);
    for (const cell of extraCells) addCell(node.id, cell);
  };

  for (let floor = 0; floor < floors; floor += 1) {
    const hallId = `hall-f${floor}`;
    const hallCells: GridCell[] = [];
    for (let x = 0; x <= maxHallX; x += 1) {
      hallCells.push({ x, y: 2, floorIndex: floor });
    }

    if (floor === 0) {
      addLocation({
        id: "exterior",
        type: "exterior",
        floorIndex: 0,
        cell: { x: -2, y: 2, floorIndex: 0 },
        label: "Exterior",
        subscribers: [],
      });
      addLocation({
        id: "lobby",
        type: "lobby",
        floorIndex: 0,
        cell: { x: -1, y: 2, floorIndex: 0 },
        label: "Lobby",
        subscribers: [],
      });
    }

    addLocation(
      {
        id: hallId,
        type: "hall",
        floorIndex: floor,
        cell: { x: 0, y: 2, floorIndex: floor },
        label: `Floor ${floor + 1} hall`,
        subscribers: [],
      },
      hallCells
    );

    for (let col = 0; col < unitsPerFloor; col += 1) {
      const unitId = `unit-f${floor}-c${col}`;
      const roomId = `${unitId}-room`;
      const doorId = `${unitId}-door`;
      const roomX = col * 4 + 2;
      const templateHash = hashString(`${seed}:${floor}:${col}`);
      const templateId = templates[templateHash % templates.length];
      const roomEntry = { x: roomX, y: 0, floorIndex: floor };
      const roomInner = { x: roomX + 1, y: 0, floorIndex: floor };
      const doorCell = { x: roomX, y: 1, floorIndex: floor };

      units.push({
        id: unitId,
        floorIndex: floor,
        columnIndex: col,
        templateId,
        qualityLevel: 45 + (templateHash % 35),
        doorLocationId: doorId,
        roomLocationId: roomId,
        rentPotential: 7_500 + floor * 800 + col * 450,
        maintenancePressure: 20 + (templateHash % 20),
        satisfactionModifier: templateId === "premium" ? 8 : templateId === "basic" ? -2 : 2,
      });

      addLocation(
        {
          id: roomId,
          type: "room",
          floorIndex: floor,
          unitId,
          cell: roomInner,
          label: `Floor ${floor + 1} unit ${col + 1} room`,
          subscribers: [],
        },
        [roomEntry]
      );

      addLocation({
        id: doorId,
        type: "door",
        floorIndex: floor,
        unitId,
        cell: doorCell,
        label: `Floor ${floor + 1} unit ${col + 1} door`,
        subscribers: [],
      });

      doors.push({
        id: doorId,
        unitId,
        hallLocationId: hallId,
        roomLocationId: roomId,
        cell: doorCell,
        lockedForVisitor: true,
      });

      spawnPoints[unitId] = cloneCell(roomInner);
    }

    for (let shaft = 0; shaft < unitsPerFloor - 1; shaft += 1) {
      const stairId = `stair-f${floor}-s${shaft}`;
      const stairCell = { x: (shaft + 1) * 4, y: 3, floorIndex: floor };
      addLocation({
        id: stairId,
        type: "stair",
        floorIndex: floor,
        cell: stairCell,
        label: `Floor ${floor + 1} stair ${shaft + 1}`,
        subscribers: [],
      });
    }
  }

  for (let floor = 0; floor < floors - 1; floor += 1) {
    for (let shaft = 0; shaft < unitsPerFloor - 1; shaft += 1) {
      const fromLocationId = `stair-f${floor}-s${shaft}`;
      const toLocationId = `stair-f${floor + 1}-s${shaft}`;
      const fromCell = firstLocationCell(locationCells, fromLocationId);
      const toCell = firstLocationCell(locationCells, toLocationId);
      if (!fromCell || !toCell) continue;
      stairs.push({
        id: `stairs-up-f${floor}-s${shaft}`,
        fromLocationId,
        toLocationId,
        fromCell,
        toCell,
        direction: "up",
      });
      stairs.push({
        id: `stairs-down-f${floor + 1}-s${shaft}`,
        fromLocationId: toLocationId,
        toLocationId: fromLocationId,
        fromCell: toCell,
        toCell: fromCell,
        direction: "down",
      });
    }
  }

  spawnPoints.exterior = { x: -2, y: 2, floorIndex: 0 };
  spawnPoints.lobby = { x: -1, y: 2, floorIndex: 0 };

  return {
    config: buildingConfig,
    units,
    locations,
    doors,
    stairs,
    walkableCells: [...walkable.values()],
    blockedCells: [],
    spawnPoints,
    locationCells,
  };
}

function seedCharacters(
  building: GeneratedBuilding,
  seed: string,
  scenario: InitialSimScenario
): Record<string, CharacterAgentState> {
  const characters: Record<string, CharacterAgentState> = {};
  const characterSeeds = scenario.characters?.length
    ? scenario.characters
    : defaultCharacterSeeds(building);

  characterSeeds.forEach((characterSeed, index) => {
    const fallbackUnit = building.units[index % building.units.length];
    const ownedUnitId = characterSeed.ownedUnitId ?? fallbackUnit?.id;
    const ownedUnit = building.units.find((unit) => unit.id === ownedUnitId);
    const locationId =
      characterSeed.locationId ?? ownedUnit?.roomLocationId ?? "lobby";
    const location = getLocationById(building, locationId) ?? getLocationById(building, "lobby");
    const currentCell =
      characterSeed.currentCell ??
      lastLocationCell(building.locationCells, location?.id ?? "lobby") ??
      location?.cell ??
      building.spawnPoints.lobby;

    characters[characterSeed.agentId] = {
      agentId: characterSeed.agentId,
      lifecycleState: characterSeed.lifecycleState ?? "current",
      rentAccountState: characterSeed.rentAccountState ?? "paid",
      executionState: "idle",
      socialReplyState: { pendingReplies: [] },
      perceptionState: {
        rawQueue: [],
        digestQueue: [],
        pendingMemoryWrites: [],
        meaningfulEventCount: 0,
      },
      behaviorState: {
        ...defaultBehaviorState(hashString(`${seed}:${characterSeed.agentId}`)),
        ...characterSeed.behaviorState,
      },
      goalState: {
        currentGoal: "Keep life stable and avoid needless drama",
        obligations: [],
        fears: [],
        promises: [],
      },
      limiterState: { softMinimumSatisfied: false },
      idempotencyScopeId: characterSeed.agentId,
      currentLocationId: location?.id ?? "lobby",
      currentCell,
      ownedUnitId,
      spriteKey: characterSeed.spriteKey ?? "sim-character",
      displayName: characterSeed.displayName,
    };
  });

  return characters;
}

function defaultCharacterSeeds(building: GeneratedBuilding): InitialCharacterSeed[] {
  return building.units.map((unit, index) => {
    const base = DEFAULT_CHARACTER_SEEDS[index % DEFAULT_CHARACTER_SEEDS.length];
    const suffix = index < DEFAULT_CHARACTER_SEEDS.length ? "" : `-${index + 1}`;
    return {
      ...base,
      agentId: `${base.agentId}${suffix}`,
      displayName: suffix ? `${base.displayName} ${index + 1}` : base.displayName,
      ownedUnitId: unit.id,
      locationId: unit.roomLocationId,
    };
  });
}

function defaultBehaviorState(seed: number): BehaviorState {
  const base = 45 + (seed % 20);
  return {
    needs: clampMetric(base),
    mood: clampMetric(base + 5),
    stress: clampMetric(30 + (seed % 15)),
    patience: 55,
    sociability: clampMetric(40 + (seed % 30)),
    conflictTolerance: clampMetric(35 + (seed % 25)),
    landlordTrust: 50,
    rentPressure: clampMetric(25 + (seed % 20)),
    attachmentToUnit: 40,
    extraversion: clampMetric(30 + (seed % 40)),
    agreeableness: clampMetric(35 + (seed % 30)),
    conscientiousness: clampMetric(40 + (seed % 25)),
    neuroticism: clampMetric(25 + (seed % 30)),
  };
}

function createInitialMetrics(building: GeneratedBuilding): SimMetricState {
  const occupiedUnits = building.units.filter((unit) => unit.tenantId).length;
  return {
    reputation: 50,
    satisfaction: 50,
    maintenancePressure: average(
      building.units.map((unit) => unit.maintenancePressure)
    ),
    occupancyRate: building.units.length === 0 ? 0 : occupiedUnits / building.units.length,
    churnRisk: 20,
    incidentSeverity: 0,
    roiProxy: 50,
  };
}

function validateAction(
  state: SimTickState,
  action: BareToolAction
): ActionValidationResult {
  const allowedTargets = VERB_TARGETS[action.verb];
  if (!allowedTargets?.includes(action.targetType)) {
    return {
      accepted: false,
      reason: "invalid_target_type",
      observationForAgent: `${action.verb} cannot target ${action.targetType}.`,
    };
  }

  const character = state.characters[action.agentId];
  if (!character) {
    return { accepted: false, reason: "unknown_actor" };
  }

  if (BLOCKED_EXECUTION_STATES.includes(character.executionState) && action.verb !== "idle") {
    return {
      accepted: false,
      reason: "execution_blocked",
      observationForAgent: `Cannot act while ${character.executionState}.`,
    };
  }

  if (action.verb === "say_to") {
    const target = state.characters[action.targetId];
    if (!target) return { accepted: false, reason: "unknown_target" };
    if (
      BLOCKED_EXECUTION_STATES.includes(target.executionState) &&
      action.args.interrupt !== true
    ) {
      return {
        accepted: false,
        reason: "target_busy",
        observationForAgent: `${target.displayName} is busy.`,
      };
    }
    if (target.currentLocationId !== character.currentLocationId) {
      return {
        accepted: false,
        reason: "target_not_visible",
        observationForAgent: `${target.displayName} is not in the same location.`,
      };
    }
  }

  if (action.verb === "move_to") {
    const result = resolvePath(state, {
      actorId: action.agentId,
      targetType: action.targetType as PathRequest["targetType"],
      targetId: action.targetId,
      speed: action.args.speed === "run" ? "run" : "walk",
      accessIntent: parseAccessIntent(action.args.accessIntent),
    });
    if (result.status === "rejected") {
      return {
        accepted: false,
        reason: result.unreachableReason ?? "path_rejected",
        observationForAgent: result.unreachableReason ?? "No path to target.",
      };
    }
  }

  return { accepted: true };
}

function submitMovementAction(
  state: SimTickState,
  action: BareToolAction,
  queuedAction: QueuedAction
): ToolExecutionResult {
  const path = resolvePath(state, {
    actorId: action.agentId,
    targetType: action.targetType as PathRequest["targetType"],
    targetId: action.targetId,
    speed: action.args.speed === "run" ? "run" : "walk",
    accessIntent: parseAccessIntent(action.args.accessIntent),
  });
  if (path.status === "rejected") {
    queuedAction.status = "rejected";
    queuedAction.reason = path.unreachableReason;
    return {
      eventId: `rejected:${action.id}`,
      status: "rejected",
      observation: path.unreachableReason,
      path,
    };
  }

  const actor = state.characters[action.agentId];
  const movementId = `movement:${action.id}`;
  const movement: MovementState = {
    id: movementId,
    actorId: action.agentId,
    status: "started_to_move",
    fromLocationId: actor.currentLocationId,
    targetLocationId: path.finalLocationId,
    targetCharacterId: path.targetCharacterId,
    targetRoomId: action.targetType === "room" ? action.targetId : undefined,
    lastResolvedTargetCell: path.finalCell,
    lastResolvedTargetLocationId: path.finalLocationId,
    dynamicTarget: path.dynamicTarget ?? false,
    currentWaypointIndex: 0,
    path: path.waypoints,
    sourceActionId: action.id,
    finalCell: path.finalCell,
    pathStatus: path.status,
    unreachableReason: path.unreachableReason,
  };

  state.movements[action.agentId] = movement;
  actor.executionState = "moving";

  const event = publishResolvedEvent(state, {
    id: `engine:${action.id}`,
    day: state.day,
    timestamp: now(),
    scope: "local",
    locationId: actor.currentLocationId,
    locationType: getLocationById(state.building, actor.currentLocationId)?.type,
    actorId: action.agentId,
    verb: "move_to",
    summary:
      path.status === "nearest_reachable"
        ? `${actor.displayName} started moving toward the nearest reachable point.`
        : `${actor.displayName} started moving toward ${labelLocation(state, path.finalLocationId)}.`,
    sourceEventId: action.id,
    tags: ["movement_started"],
  });

  queuedAction.status = "completed";
  queuedAction.eventId = event.id;
  return {
    eventId: event.id,
    status: "queued",
    movementId,
    path,
  };
}

function submitSpeechAction(
  state: SimTickState,
  action: BareToolAction,
  queuedAction: QueuedAction
): ToolExecutionResult {
  const actor = state.characters[action.agentId];
  const target = state.characters[action.targetId];
  const message = String(action.args.message ?? action.args.text ?? "Hello.");
  const event = publishResolvedEvent(state, {
    id: `engine:${action.id}`,
    day: state.day,
    timestamp: now(),
    scope: "local",
    locationId: actor.currentLocationId,
    locationType: getLocationById(state.building, actor.currentLocationId)?.type,
    actorId: action.agentId,
    targetId: action.targetId,
    verb: "say_to",
    visibility: "public",
    participants: [action.agentId, action.targetId],
    summary: `${actor.displayName} said to ${target.displayName}: "${message}"`,
    sourceEventId: action.id,
    tags: ["speech"],
  });

  actor.socialReplyState.pendingReplies.push({
    id: `reply:${action.id}`,
    speakerId: action.agentId,
    targetId: action.targetId,
    sourceSpeechEventId: event.id,
    deadlineMs: Number(action.args.deadlineMs ?? 8_000),
    createdAt: event.timestamp,
    status: "pending",
  });

  queuedAction.status = "completed";
  queuedAction.eventId = event.id;
  return { eventId: event.id, status: "completed" };
}

function resolvePathTarget(
  state: SimTickState,
  actor: CharacterAgentState,
  request: PathRequest
): { locationId: string; cell: GridCell } | null {
  if (request.targetType === "location") {
    const location = getLocationById(state.building, request.targetId);
    return location ? { locationId: location.id, cell: cloneCell(location.cell) } : null;
  }

  if (request.targetType === "door") {
    const door = getDoorById(state.building, request.targetId);
    return door ? { locationId: door.id, cell: cloneCell(door.cell) } : null;
  }

  if (request.targetType === "room") {
    const unit = getUnitByRoomTarget(state.building, request.targetId);
    if (!unit) return null;
    const door = getDoorById(state.building, unit.doorLocationId);
    if (!door) return null;

    if (door.lockedForVisitor && !canEnterUnit(actor, unit, request.accessIntent)) {
      return { locationId: door.id, cell: cloneCell(door.cell) };
    }

    return {
      locationId: unit.roomLocationId,
      cell:
        lastLocationCell(state.building.locationCells, unit.roomLocationId) ??
        getLocationById(state.building, unit.roomLocationId)?.cell ??
        cloneCell(door.cell),
    };
  }

  const target = state.characters[request.targetId];
  if (!target) return null;
  const targetLocation = getLocationById(state.building, target.currentLocationId);
  if (!targetLocation) return null;

  const targetUnit = targetLocation.unitId
    ? state.building.units.find((unit) => unit.id === targetLocation.unitId)
    : undefined;
  if (
    targetUnit &&
    targetLocation.type === "room" &&
    !canEnterUnit(actor, targetUnit, request.accessIntent)
  ) {
    const door = getDoorById(state.building, targetUnit.doorLocationId);
    return door ? { locationId: door.id, cell: cloneCell(door.cell) } : null;
  }

  const targetCell = target.currentCell ?? targetLocation.cell;
  const actorCell = actor.currentCell ?? getLocationById(state.building, actor.currentLocationId)?.cell;
  const interactionCell = chooseInteractionCell(state, targetLocation.id, targetCell, actorCell);
  return {
    locationId:
      findLocationIdForCell(state.building, interactionCell) ?? targetLocation.id,
    cell: interactionCell,
  };
}

function chooseInteractionCell(
  state: SimTickState,
  targetLocationId: string,
  targetCell: GridCell,
  actorCell?: GridCell
): GridCell {
  const walkable = new Set(state.building.walkableCells.map(cellKey));
  const preferred = neighbors4(targetCell)
    .filter((cell) => walkable.has(cellKey(cell)))
    .filter((cell) => findLocationIdForCell(state.building, cell) === targetLocationId);
  const fallback = neighbors4(targetCell).filter((cell) => walkable.has(cellKey(cell)));
  const candidates = preferred.length > 0 ? preferred : fallback;
  if (candidates.length === 0) return cloneCell(targetCell);

  candidates.sort((a, b) => {
    if (!actorCell) return cellKey(a).localeCompare(cellKey(b));
    return manhattan(a, actorCell) - manhattan(b, actorCell);
  });
  return cloneCell(candidates[0]);
}

interface AStarResult {
  path?: GridCell[];
  visited: Set<string>;
  cameFrom: Map<string, string>;
}

function findAStarPath(
  building: GeneratedBuilding,
  start: GridCell,
  goal: GridCell
): AStarResult {
  const walkable = new Set(building.walkableCells.map(cellKey));
  const startKey = cellKey(start);
  const goalKey = cellKey(goal);
  if (!walkable.has(startKey) || !walkable.has(goalKey)) {
    return { visited: new Set(walkable.has(startKey) ? [startKey] : []), cameFrom: new Map() };
  }

  // ponytail: tiny demo grids make a linear open set simpler than a heap.
  const open = [startKey];
  const openSet = new Set(open);
  const visited = new Set<string>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, manhattan(start, goal)]]);
  const cellByKey = new Map(building.walkableCells.map((cell) => [cellKey(cell), cell]));

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
    const currentKey = open.shift();
    if (!currentKey) break;
    openSet.delete(currentKey);
    visited.add(currentKey);

    if (currentKey === goalKey) {
      return {
        path: reconstructPath(cameFrom, currentKey, cellByKey),
        visited,
        cameFrom,
      };
    }

    const current = cellByKey.get(currentKey);
    if (!current) continue;

    for (const neighbor of getPathNeighbors(building, current, walkable)) {
      const neighborKey = cellKey(neighbor);
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + manhattan(neighbor, goal));
      if (!openSet.has(neighborKey)) {
        open.push(neighborKey);
        openSet.add(neighborKey);
      }
    }
  }

  return { visited, cameFrom };
}

function getPathNeighbors(
  building: GeneratedBuilding,
  cell: GridCell,
  walkable: Set<string>
): GridCell[] {
  const neighbors = neighbors4(cell).filter((candidate) => walkable.has(cellKey(candidate)));
  for (const stair of building.stairs) {
    if (cellsEqual(stair.fromCell, cell)) {
      neighbors.push(cloneCell(stair.toCell));
    }
  }
  return neighbors;
}

function nearestReachableFallback(
  state: SimTickState,
  visited: Set<string>,
  cameFrom: Map<string, string>,
  start: GridCell,
  target: GridCell
): { path: GridCell[]; cell: GridCell; locationId: string } | null {
  const cellByKey = new Map(state.building.walkableCells.map((cell) => [cellKey(cell), cell]));
  const candidates = [...visited]
    .map((key) => cellByKey.get(key))
    .filter((cell): cell is GridCell => Boolean(cell));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => manhattan(a, target) - manhattan(b, target));
  const cell = candidates[0];
  const path = cellsEqual(start, cell)
    ? [cloneCell(start)]
    : reconstructPath(cameFrom, cellKey(cell), cellByKey);
  return {
    path,
    cell: cloneCell(cell),
    locationId: findLocationIdForCell(state.building, cell) ?? "lobby",
  };
}

function reconstructPath(
  cameFrom: Map<string, string>,
  currentKey: string,
  cellByKey: Map<string, GridCell>
): GridCell[] {
  const keys = [currentKey];
  let current = currentKey;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current) as string;
    keys.push(current);
  }
  keys.reverse();
  return keys
    .map((key) => cellByKey.get(key))
    .filter((cell): cell is GridCell => Boolean(cell))
    .map(cloneCell);
}

function replanDynamicMovements(state: SimTickState): void {
  for (const movement of Object.values(state.movements)) {
    if (!movement.dynamicTarget || !movement.targetCharacterId) continue;
    if (movement.status !== "started_to_move" && movement.status !== "moving") continue;

    const path = resolvePath(state, {
      actorId: movement.actorId,
      targetType: "character",
      targetId: movement.targetCharacterId,
      speed: "walk",
      accessIntent: "normal",
    });
    if (path.status === "rejected" || !path.finalCell) continue;

    const targetMoved =
      !movement.lastResolvedTargetCell ||
      !cellsEqual(movement.lastResolvedTargetCell, path.finalCell) ||
      movement.lastResolvedTargetLocationId !== path.finalLocationId;
    if (!targetMoved) continue;

    const reason =
      movement.lastResolvedTargetLocationId &&
      movement.lastResolvedTargetLocationId !== path.finalLocationId
        ? "target_changed_location"
        : "target_moved";
    movement.path = path.waypoints;
    movement.finalCell = path.finalCell;
    movement.targetLocationId = path.finalLocationId;
    movement.lastResolvedTargetCell = path.finalCell;
    movement.lastResolvedTargetLocationId = path.finalLocationId;
    movement.replanReason = reason;
    movement.pathStatus = path.status;
    movement.unreachableReason = path.unreachableReason;
  }
}

function enqueueLandlordRequest(
  state: SimTickState,
  action: BareToolAction
): LandlordRequest | null {
  ensureRuntimeState(state);
  const queue = requireLandlordQueue(state);
  const id = `landlord-request:${action.id}`;
  const existing = queue.requests[id];
  if (existing) return existing;

  const priority = priorityForLandlordVerb(action.verb);
  const timestamp = now();
  const request: LandlordRequest = {
    id,
    sourceActionId: action.id,
    requesterId: action.agentId,
    verb: action.verb,
    targetId: action.targetId,
    args: action.args,
    summary: summarizeLandlordRequest(action),
    urgency: priority >= 100 ? "critical" : "medium",
    priority,
    suggestedChoices: suggestedChoicesFor(action.verb),
    defaultChoice: "No landlord action taken",
    createdAt: timestamp,
    timeoutAt: timestamp + 15_000,
    status: queue.activeRequestId ? "pending" : "active",
  };
  queue.requests[id] = request;

  if (!queue.activeRequestId) {
    queue.activeRequestId = id;
    return request;
  }

  queue.pendingRequestIds.push(id);
  queue.pendingRequestIds.sort((a, b) => {
    const left = queue.requests[a];
    const right = queue.requests[b];
    return right.priority - left.priority || left.createdAt - right.createdAt;
  });
  return request;
}

function respondToActiveTimeout(state: SimTickState, requestId: string, timestamp: number): void {
  respondToLandlordRequest(state, requestId, {
    status: "timed_out",
    choice: "No landlord action taken",
    timestamp,
  });
}

function expireLandlordRequests(state: SimTickState, timestamp: number): void {
  const activeId = state.landlord.requestQueue?.activeRequestId;
  if (!activeId) return;
  const active = state.landlord.requestQueue?.requests[activeId];
  if (active && active.status === "active" && active.timeoutAt <= timestamp) {
    respondToActiveTimeout(state, activeId, timestamp);
  }
}

function applyLandlordRequestBudgetEffect(
  state: SimTickState,
  request: LandlordRequest,
  response: LandlordResponse,
  sourceEventId: string
): CapitalEvent | undefined {
  const actor = state.characters[request.requesterId];
  const unit = actor?.ownedUnitId
    ? state.building.units.find((candidate) => candidate.id === actor.ownedUnitId)
    : undefined;
  const rentAmount = Number(request.args?.amountAed ?? unit?.rentPotential ?? 8_000);
  const approved = response.status !== "timed_out" && response.approved !== false;

  if (request.verb === "pay_rent" && approved) {
    if (actor) actor.rentAccountState = "paid";
    return applyBudgetDelta(state, {
      id: `capital:${request.id}:rent`,
      sourceEventId,
      sourceType: "rent_payment",
      amountAed: Math.abs(rentAmount),
      residentId: request.requesterId,
      unitId: unit?.id,
      description: `${displayName(state, request.requesterId)} paid rent.`,
      timestamp: response.timestamp,
    });
  }

  if (request.verb === "skip_rent") {
    if (actor) actor.rentAccountState = "skipped";
    return applyBudgetDelta(state, {
      id: `capital:${request.id}:skipped-rent`,
      sourceEventId,
      sourceType: "skipped_rent",
      amountAed: -Math.abs(rentAmount),
      residentId: request.requesterId,
      unitId: unit?.id,
      description: `${displayName(state, request.requesterId)} skipped expected rent.`,
      timestamp: response.timestamp,
    });
  }

  if (request.verb === "request_repair" && approved) {
    const cost = Math.abs(Number(response.budgetDeltaAed ?? request.args?.costAed ?? 1_500));
    if (unit) unit.maintenancePressure = clampMetric(unit.maintenancePressure - 12);
    return applyBudgetDelta(state, {
      id: `capital:${request.id}:repair`,
      sourceEventId,
      sourceType: "maintenance",
      amountAed: -cost,
      residentId: request.requesterId,
      unitId: unit?.id,
      description: `Maintenance approved for ${displayName(state, request.requesterId)}.`,
      timestamp: response.timestamp,
    });
  }

  if (request.verb === "move_in" && approved) {
    return applyBudgetDelta(state, {
      id: `capital:${request.id}:move-in`,
      sourceEventId,
      sourceType: "move_in",
      amountAed: Math.abs(Number(response.budgetDeltaAed ?? 2_000)),
      residentId: request.requesterId,
      unitId: unit?.id,
      description: `${displayName(state, request.requesterId)} move-in fees recorded.`,
      timestamp: response.timestamp,
    });
  }

  if (request.verb === "move_out" && approved) {
    return applyBudgetDelta(state, {
      id: `capital:${request.id}:move-out`,
      sourceEventId,
      sourceType: "move_out",
      amountAed: -Math.abs(Number(response.budgetDeltaAed ?? 1_000)),
      residentId: request.requesterId,
      unitId: unit?.id,
      description: `${displayName(state, request.requesterId)} move-out cost recorded.`,
      timestamp: response.timestamp,
    });
  }

  return undefined;
}

function publishPerceptions(state: SimTickState, event: SimEvent): void {
  const recipients = new Set<string>();
  const participants = event.participants ?? [];

  if (event.scope === "global") {
    for (const id of Object.keys(state.characters)) recipients.add(id);
  }

  if (event.locationId) {
    const location = getLocationById(state.building, event.locationId);
    for (const id of location?.subscribers ?? []) recipients.add(id);
  }

  if (event.actorId) recipients.add(event.actorId);
  if (event.targetId) recipients.add(event.targetId);
  for (const id of participants) recipients.add(id);

  for (const agentId of recipients) {
    addRawPerception(state, agentId, event, event.summary, false);
  }

  if (
    event.verb === "say_to" &&
    event.visibility !== "private" &&
    event.locationId &&
    getLocationById(state.building, event.locationId)?.type === "room"
  ) {
    const hallId = state.building.doors.find(
      (door) => door.roomLocationId === event.locationId
    )?.hallLocationId;
    const hall = hallId ? getLocationById(state.building, hallId) : undefined;
    for (const agentId of hall?.subscribers ?? []) {
      if (!recipients.has(agentId)) {
        addRawPerception(state, agentId, event, muffle(event.summary), true);
      }
    }
  }
}

function addRawPerception(
  state: SimTickState,
  agentId: string,
  event: SimEvent,
  text: string,
  muffled: boolean
): void {
  const character = state.characters[agentId];
  if (!character) return;

  const rawId = `raw:${event.id}:${agentId}${muffled ? ":muffled" : ""}`;
  if (character.perceptionState.rawQueue.some((raw) => raw.id === rawId)) return;

  character.perceptionState.rawQueue.push({
    id: rawId,
    day: event.day,
    timestamp: event.timestamp,
    locationId: event.locationId ?? "global",
    locationType: event.locationType ?? "global",
    text,
    sourceEventId: event.id,
    muffled,
  });
  character.perceptionState.meaningfulEventCount += 1;

  if (character.executionState === "moving" || character.executionState === "limited_wait") {
    return;
  }

  const memoryId = `memory:${rawId}`;
  const ledger = requireLedger(state);
  if (ledger.memoryWriteIds[memoryId]) return;
  ledger.memoryWriteIds[memoryId] = true;
  character.perceptionState.pendingMemoryWrites.push({
    id: memoryId,
    agentId,
    document: text,
    metadata: {
      memoryType: "episodic",
      day: event.day,
      locationId: event.locationId ?? "global",
      locationType: event.locationType ?? "global",
      participants: event.participants ?? [event.actorId, event.targetId].filter(isString),
      tags: event.tags ?? [],
      importance: event.scope === "global" ? 70 : 50,
      sourceEventId: event.id,
      timestamp: event.timestamp,
    },
  });
}

function updateMetricsFromEvent(state: SimTickState, event: SimEvent): void {
  if (!state.metrics) return;
  if (event.verb === "file_complaint") {
    state.metrics.reputation = clampMetric(state.metrics.reputation - 2);
    state.metrics.satisfaction = clampMetric(state.metrics.satisfaction - 2);
  }
  if (event.verb === "request_repair") {
    state.metrics.maintenancePressure = clampMetric(state.metrics.maintenancePressure + 1);
  }
  if (event.verb === "altercate") {
    state.metrics.incidentSeverity = clampMetric(state.metrics.incidentSeverity + 10);
    state.metrics.reputation = clampMetric(state.metrics.reputation - 4);
  }
  if (typeof event.budgetDeltaAed === "number") {
    state.metrics.roiProxy = clampMetric(state.metrics.roiProxy + event.budgetDeltaAed / 10_000);
  }
}

function normalizeEvent(state: SimTickState, event: SimEvent): SimEvent {
  const location = event.locationId
    ? getLocationById(state.building, event.locationId)
    : undefined;
  return {
    visibility: "public",
    ...event,
    locationType: event.locationType ?? location?.type,
  };
}

function resolveDayActions(
  state: SimTickState,
  opts: AdvanceSimDayOptions
): BareToolAction[] {
  if (opts.actions) return opts.actions;
  if (!opts.runMockScenario || !state.mockScenario) return [];

  const actions = state.mockScenario.actions.slice(state.mockScenario.nextActionIndex);
  state.mockScenario.nextActionIndex = state.mockScenario.actions.length;
  return actions;
}

function createDeterministicMockActions(
  state: SimTickState,
  name: string
): BareToolAction[] {
  const ids = Object.keys(state.characters);
  const first = ids[0];
  const second = ids[1];
  if (!first || !second) return [];

  const firstUnit = state.building.units.find(
    (unit) => unit.tenantId === first || unit.id === state.characters[first].ownedUnitId
  );

  return [
    {
      id: `${name}:move:${first}:hall`,
      agentId: first,
      verb: "move_to",
      targetType: "location",
      targetId: "hall-f0",
      args: { speed: "walk" },
    },
    {
      id: `${name}:move:${second}:hall`,
      agentId: second,
      verb: "move_to",
      targetType: "location",
      targetId: "hall-f0",
      args: { speed: "walk" },
    },
    {
      id: `${name}:say:${first}:${second}`,
      agentId: first,
      verb: "say_to",
      targetType: "character",
      targetId: second,
      args: { message: "Could we get the AC checked today?" },
    },
    {
      id: `${name}:repair:${first}`,
      agentId: first,
      verb: "request_repair",
      targetType: "landlord",
      targetId: "landlord",
      args: { issue: "AC is struggling", costAed: 1500 },
    },
    {
      id: `${name}:rent:${second}`,
      agentId: second,
      verb: "pay_rent",
      targetType: "landlord",
      targetId: "landlord",
      args: { amountAed: firstUnit?.rentPotential ?? 8000 },
    },
  ];
}

function canIssueTool(state: SimTickState, agentId: string): boolean {
  const character = state.characters[agentId];
  if (!character) return false;
  return !BLOCKED_EXECUTION_STATES.includes(character.executionState);
}

function ensureRuntimeState(state: SimTickState): void {
  state.actionQueue = state.actionQueue ?? [];
  state.idempotencyLedger = state.idempotencyLedger ?? {
    toolIntentIds: {},
    engineEventIds: {},
    memoryWriteIds: {},
    budgetEventIds: {},
  };
  state.landlord.requestQueue = state.landlord.requestQueue ?? {
    pendingRequestIds: [],
    requests: {},
  };
  state.metrics = state.metrics ?? createInitialMetrics(state.building);

  if (!state.building.locationCells) {
    state.building.locationCells = Object.fromEntries(
      state.building.locations.map((location) => [location.id, [location.cell]])
    );
  }

  for (const character of Object.values(state.characters)) {
    if (!character.currentCell) {
      character.currentCell =
        lastLocationCell(state.building.locationCells, character.currentLocationId) ??
        getLocationById(state.building, character.currentLocationId)?.cell;
    }
  }
}

function requireLedger(
  state: SimTickState
): NonNullable<SimTickState["idempotencyLedger"]> {
  ensureRuntimeState(state);
  return state.idempotencyLedger as NonNullable<SimTickState["idempotencyLedger"]>;
}

function requireActionQueue(state: SimTickState): QueuedAction[] {
  ensureRuntimeState(state);
  return state.actionQueue as QueuedAction[];
}

function requireLandlordQueue(
  state: SimTickState
): NonNullable<LandlordState["requestQueue"]> {
  ensureRuntimeState(state);
  return state.landlord.requestQueue as NonNullable<LandlordState["requestQueue"]>;
}

function rejectedPath(reason: string): PathResult {
  return {
    status: "rejected",
    waypoints: [],
    finalLocationId: "",
    unreachableReason: reason,
  };
}

function canEnterUnit(
  actor: CharacterAgentState,
  unit: UnitState,
  accessIntent: AccessIntent
): boolean {
  return (
    actor.ownedUnitId === unit.id ||
    unit.tenantId === actor.agentId ||
    accessIntent === "invited" ||
    accessIntent === "landlord_permitted"
  );
}

function parseAccessIntent(value: unknown): AccessIntent {
  return value === "invited" ||
    value === "landlord_permitted" ||
    value === "altercate"
    ? value
    : "normal";
}

function isLandlordFacing(verb: ActionVerb): boolean {
  return (
    verb === "request_repair" ||
    verb === "file_complaint" ||
    verb === "pay_rent" ||
    verb === "skip_rent" ||
    verb === "move_in" ||
    verb === "move_out"
  );
}

function priorityForLandlordVerb(verb: ActionVerb): number {
  return verb === "skip_rent" || verb === "altercate" ? 100 : 10;
}

function suggestedChoicesFor(verb: ActionVerb): string[] {
  switch (verb) {
    case "request_repair":
      return ["Approve maintenance", "Defer", "Deny"];
    case "file_complaint":
      return ["Investigate", "Mediate", "Dismiss"];
    case "pay_rent":
      return ["Acknowledge payment"];
    case "skip_rent":
      return ["Send reminder", "Negotiate", "Start notice process"];
    case "move_in":
      return ["Approve", "Counter-offer", "Reject"];
    case "move_out":
      return ["Approve", "Negotiate retention", "Reject"];
    case "altercate":
      return ["Intervene", "Warn", "Call GM"];
    default:
      return ["Acknowledge"];
  }
}

function summarizeLandlordRequest(action: BareToolAction): string {
  switch (action.verb) {
    case "request_repair":
      return `${action.agentId} requests repair: ${String(action.args.issue ?? "unspecified issue")}`;
    case "file_complaint":
      return `${action.agentId} filed a complaint.`;
    case "pay_rent":
      return `${action.agentId} wants to pay rent.`;
    case "skip_rent":
      return `${action.agentId} may skip rent this cycle.`;
    case "move_in":
      return `${action.agentId} requests move-in.`;
    case "move_out":
      return `${action.agentId} requests move-out.`;
    case "altercate":
      return `${action.agentId} escalated an altercation.`;
    default:
      return `${action.agentId}: ${action.verb}`;
  }
}

function summarizeLandlordResponse(
  request: LandlordRequest,
  response: LandlordResponse
): string {
  if (response.status === "timed_out") {
    return `Landlord request ${request.verb} timed out: no landlord action taken.`;
  }
  const choice = response.choice ?? (response.approved === false ? "Denied" : "Approved");
  return `Landlord responded to ${request.verb}: ${choice}.`;
}

function getLocationById(
  building: GeneratedBuilding,
  locationId: string
): LocationNode | undefined {
  return building.locations.find((location) => location.id === locationId);
}

function getDoorById(
  building: GeneratedBuilding,
  doorId: string
): GeneratedBuilding["doors"][number] | undefined {
  return building.doors.find((door) => door.id === doorId);
}

function getUnitByRoomTarget(
  building: GeneratedBuilding,
  targetId: string
): UnitState | undefined {
  return building.units.find(
    (unit) => unit.id === targetId || unit.roomLocationId === targetId
  );
}

function findLocationIdForCell(
  building: GeneratedBuilding,
  cell: GridCell
): string | undefined {
  const locationCells = building.locationCells;
  if (locationCells) {
    for (const [locationId, cells] of Object.entries(locationCells)) {
      if (cells.some((candidate) => cellsEqual(candidate, cell))) return locationId;
    }
  }
  return building.locations.find((location) => cellsEqual(location.cell, cell))?.id;
}

function findMovementById(
  state: SimTickState,
  movementId: string
): MovementState | undefined {
  return (
    state.movements[movementId] ??
    Object.values(state.movements).find((movement) => movement.id === movementId)
  );
}

function subscribe(state: SimTickState, locationId: string, agentId: string): void {
  const location = getLocationById(state.building, locationId);
  if (location && !location.subscribers.includes(agentId)) {
    location.subscribers.push(agentId);
  }
}

function unsubscribe(state: SimTickState, locationId: string, agentId: string): void {
  const location = getLocationById(state.building, locationId);
  if (!location) return;
  location.subscribers = location.subscribers.filter((id) => id !== agentId);
}

function labelLocation(state: SimTickState, locationId: string): string {
  return getLocationById(state.building, locationId)?.label ?? locationId;
}

function displayName(state: SimTickState, agentId: string): string {
  return state.characters[agentId]?.displayName ?? agentId;
}

function firstLocationCell(
  locationCells: Record<string, GridCell[]>,
  locationId: string
): GridCell | undefined {
  const cell = locationCells[locationId]?.[0];
  return cell ? cloneCell(cell) : undefined;
}

function lastLocationCell(
  locationCells: Record<string, GridCell[]> | undefined,
  locationId: string
): GridCell | undefined {
  const cells = locationCells?.[locationId];
  const cell = cells?.[cells.length - 1];
  return cell ? cloneCell(cell) : undefined;
}

function neighbors4(cell: GridCell): GridCell[] {
  return [
    { x: cell.x + 1, y: cell.y, floorIndex: cell.floorIndex },
    { x: cell.x - 1, y: cell.y, floorIndex: cell.floorIndex },
    { x: cell.x, y: cell.y + 1, floorIndex: cell.floorIndex },
    { x: cell.x, y: cell.y - 1, floorIndex: cell.floorIndex },
  ];
}

function cellsEqual(left: GridCell, right: GridCell): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.floorIndex === right.floorIndex
  );
}

function cloneCell(cell: GridCell): GridCell {
  return { x: cell.x, y: cell.y, floorIndex: cell.floorIndex };
}

function cellKey(cell: GridCell): string {
  return `${cell.floorIndex}:${cell.x}:${cell.y}`;
}

function manhattan(left: GridCell, right: GridCell): number {
  return (
    Math.abs(left.x - right.x) +
    Math.abs(left.y - right.y) +
    Math.abs(left.floorIndex - right.floorIndex) * 10
  );
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampMetric(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function muffle(text: string): string {
  return `Muffled nearby: ${text
    .split(" ")
    .map((word, index) => (index % 5 === 3 ? "..." : word))
    .join(" ")}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function now(): number {
  return Date.now();
}
