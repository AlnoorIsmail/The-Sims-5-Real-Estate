"use client";

import { useEffect, useRef, useState } from "react";

const SCENE_WIDTH = 960;
const SCENE_HEIGHT = 600;
const HALL_HEIGHT = 34;

type RoomTemplate = "basic" | "cluttered" | "premium";
type LocationType = "room" | "hall" | "stair" | "lobby" | "exterior" | "door";
type MovementStatus =
  | "idle"
  | "started_to_move"
  | "moving"
  | "arrived"
  | "unreachable_endpoint";
type TargetType = "character" | "room" | "location" | "door";
type DebugKey =
  | "grid"
  | "path"
  | "nodes"
  | "doors"
  | "stairs"
  | "collisions"
  | "movementLogs";

type Cell = {
  x: number;
  y: number;
};

type BuildingSettings = {
  floors: number;
  unitsPerFloor: number;
  seed: string;
  initialBudgetAed: number;
};

type LocationNode = {
  id: string;
  type: LocationType;
  floorIndex?: number;
  unitId?: string;
  cell: Cell;
  label: string;
  x: number;
  y: number;
};

type UnitState = {
  id: string;
  floorIndex: number;
  columnIndex: number;
  templateId: RoomTemplate;
  qualityLevel: number;
  tenantId?: string;
  doorLocationId: string;
  roomLocationId: string;
  rentPotential: number;
  maintenancePressure: number;
  satisfactionModifier: number;
  lockedForVisitor: boolean;
};

type DoorNode = {
  id: string;
  unitId: string;
  hallLocationId: string;
  roomLocationId: string;
  cell: Cell;
};

type StairLink = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  fromCell: Cell;
  toCell: Cell;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type Edge = {
  to: string;
  cost: number;
  kind: "walk" | "door" | "stair";
};

type BuildingLayout = {
  config: Pick<BuildingSettings, "floors" | "unitsPerFloor" | "seed">;
  units: UnitState[];
  locations: Record<string, LocationNode>;
  doors: DoorNode[];
  stairs: StairLink[];
  walkableCells: Cell[];
  blockedCells: Cell[];
  edges: Record<string, Edge[]>;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
    unitWidth: number;
    floorHeight: number;
  };
};

type MovementState = {
  status: MovementStatus;
  fromLocationId: string;
  targetLocationId?: string;
  targetType?: TargetType;
  targetId?: string;
  targetCharacterId?: string;
  targetRoomId?: string;
  dynamicTarget: boolean;
  replanReason?: "target_moved" | "target_changed_location" | "stale_path";
  currentWaypointIndex: number;
  elapsedMs: number;
  durationMs: number;
  path: string[];
  pathCells: Cell[];
  lastResolvedTargetCell?: Cell;
  lastResolvedTargetLocationId?: string;
};

type AgentState = {
  id: string;
  name: string;
  spriteFolder: string;
  color: string;
  unitId?: string;
  locationId: string;
  subscriptionLocationId: string;
  visual: {
    x: number;
    y: number;
  };
  movement: MovementState;
  bubble?: {
    text: string;
    untilMs: number;
  };
  statusLabel: string;
};

type CapitalEvent = {
  id: string;
  day: number;
  timestamp: number;
  sourceType:
    | "rent_payment"
    | "skipped_rent"
    | "renovation"
    | "maintenance"
    | "move_in"
    | "move_out"
    | "gm_incident";
  amountAed: number;
  unitId?: string;
  residentId?: string;
  description: string;
  budgetBeforeAed: number;
  budgetAfterAed: number;
};

type EventLogEntry = {
  id: string;
  timestamp: number;
  type: string;
  text: string;
};

type MetricsState = {
  reputation: number;
  occupancy: number;
  satisfaction: number;
  maintenancePressure: number;
  roiProxy: number;
};

type SimulatorState = {
  settings: BuildingSettings;
  layout: BuildingLayout;
  landlord: {
    initialBudgetAed: number;
    budgetAed: number;
    selectedFloorIndex: number;
    selectedUnitId: string;
    capitalEvents: CapitalEvent[];
  };
  agents: AgentState[];
  events: EventLogEntry[];
  metrics: MetricsState;
  debug: Record<DebugKey, boolean>;
  simTimeMs: number;
  day: number;
  nextEventId: number;
  nextCapitalEventId: number;
  renderVersion: number;
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
  }
}

const DEFAULT_SETTINGS: BuildingSettings = {
  floors: 2,
  unitsPerFloor: 3,
  seed: "day-one",
  initialBudgetAed: 250000,
};

const DEBUG_LABELS: Record<DebugKey, string> = {
  grid: "Grid",
  path: "Current path",
  nodes: "Node ids",
  doors: "Doors",
  stairs: "Stairs",
  collisions: "Collision cells",
  movementLogs: "Movement logs",
};

const CAST = [
  {
    id: "amina",
    name: "Amina",
    spriteFolder: "assets/fancy_people/Vampire_Girl",
    color: "#57c7e5",
  },
  {
    id: "leila",
    name: "Leila",
    spriteFolder: "assets/fancy_people/Countess_Vampire",
    color: "#e45d9a",
  },
  {
    id: "omar",
    name: "Omar",
    spriteFolder: "assets/Gangsters_2",
    color: "#f0b45c",
  },
  {
    id: "nadia",
    name: "Nadia",
    spriteFolder: "assets/fancy_people/Vampire_Girl",
    color: "#8fd16f",
  },
  {
    id: "basim",
    name: "Basim",
    spriteFolder: "assets/Gangsters_3",
    color: "#b99cff",
  },
  {
    id: "skelly",
    name: "Skelly",
    spriteFolder: "assets/FREE_SkeletonPack_ByPhewcumber",
    color: "#e7e1d2",
  },
];

const TEMPLATES: RoomTemplate[] = ["basic", "cluttered", "premium"];

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hashString(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededChoice<T>(items: T[], seed: string, index: number) {
  return items[(hashString(`${seed}:${index}`) + index) % items.length];
}

function colorToNumber(hex: string) {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function formatAed(value: number) {
  return `${Math.round(value).toLocaleString()} AED`;
}

function createDebugState(): Record<DebugKey, boolean> {
  return {
    grid: false,
    path: true,
    nodes: false,
    doors: true,
    stairs: true,
    collisions: false,
    movementLogs: false,
  };
}

function addEdge(
  edges: Record<string, Edge[]>,
  from: string,
  to: string,
  cost: number,
  kind: Edge["kind"],
) {
  edges[from] = [...(edges[from] ?? []), { to, cost, kind }];
  edges[to] = [...(edges[to] ?? []), { to: from, cost, kind }];
}

function generateBuilding(settings: BuildingSettings): BuildingLayout {
  const floors = clampInt(settings.floors, 2, 4);
  const unitsPerFloor = clampInt(settings.unitsPerFloor, 2, 5);
  const unitWidth = Math.min(210, Math.floor((SCENE_WIDTH - 120) / unitsPerFloor));
  const floorHeight = Math.min(190, Math.floor((SCENE_HEIGHT - 100) / floors));
  const width = unitWidth * unitsPerFloor;
  const height = floorHeight * floors;
  const left = Math.round((SCENE_WIDTH - width) / 2);
  const top = SCENE_HEIGHT - 48 - height;
  const locations: Record<string, LocationNode> = {};
  const doors: DoorNode[] = [];
  const stairs: StairLink[] = [];
  const units: UnitState[] = [];
  const edges: Record<string, Edge[]> = {};
  const walkableCells: Cell[] = [];
  const blockedCells: Cell[] = [];

  function addLocation(node: LocationNode) {
    locations[node.id] = node;
    walkableCells.push(node.cell);
  }

  for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
    const floorBottom = top + height - floorIndex * floorHeight;
    const floorTop = floorBottom - floorHeight;
    const hallY = floorBottom - HALL_HEIGHT / 2;
    const roomY = floorTop + (floorHeight - HALL_HEIGHT) / 2;

    for (let columnIndex = 0; columnIndex < unitsPerFloor; columnIndex += 1) {
      const unitId = `unit-f${floorIndex + 1}-u${columnIndex + 1}`;
      const roomLocationId = `room-${unitId}`;
      const doorLocationId = `door-${unitId}`;
      const hallLocationId = `hall-f${floorIndex}-c${columnIndex}`;
      const centerX = left + columnIndex * unitWidth + unitWidth / 2;
      const roomTemplate = seededChoice(
        TEMPLATES,
        settings.seed,
        floorIndex * unitsPerFloor + columnIndex,
      );
      const quality = roomTemplate === "premium" ? 3 : roomTemplate === "cluttered" ? 1 : 2;

      addLocation({
        id: hallLocationId,
        type: "hall",
        floorIndex,
        cell: { x: columnIndex * 2 + 1, y: floorIndex * 3 },
        label: `F${floorIndex + 1} hall ${columnIndex + 1}`,
        x: centerX,
        y: hallY,
      });
      addLocation({
        id: doorLocationId,
        type: "door",
        floorIndex,
        unitId,
        cell: { x: columnIndex * 2 + 1, y: floorIndex * 3 + 1 },
        label: `Door ${floorIndex + 1}-${columnIndex + 1}`,
        x: centerX,
        y: floorBottom - HALL_HEIGHT - 5,
      });
      addLocation({
        id: roomLocationId,
        type: "room",
        floorIndex,
        unitId,
        cell: { x: columnIndex * 2 + 1, y: floorIndex * 3 + 2 },
        label: `Unit ${floorIndex + 1}-${columnIndex + 1}`,
        x: centerX,
        y: roomY,
      });

      units.push({
        id: unitId,
        floorIndex,
        columnIndex,
        templateId: roomTemplate,
        qualityLevel: quality,
        doorLocationId,
        roomLocationId,
        tenantId: undefined,
        rentPotential: 7600 + floorIndex * 450 + columnIndex * 275 + quality * 300,
        maintenancePressure: roomTemplate === "cluttered" ? 68 : roomTemplate === "basic" ? 48 : 32,
        satisfactionModifier: quality * 4,
        lockedForVisitor: true,
      });

      doors.push({
        id: `door-node-${unitId}`,
        unitId,
        hallLocationId,
        roomLocationId,
        cell: { x: columnIndex * 2 + 1, y: floorIndex * 3 + 1 },
      });

      addEdge(edges, hallLocationId, doorLocationId, 1, "door");
      addEdge(edges, doorLocationId, roomLocationId, 1, "door");

      if (columnIndex > 0) {
        addEdge(edges, `hall-f${floorIndex}-c${columnIndex - 1}`, hallLocationId, 1, "walk");
      }
    }
  }

  const floorZeroHall = locations["hall-f0-c0"];
  addLocation({
    id: "lobby",
    type: "lobby",
    floorIndex: 0,
    cell: { x: -1, y: 0 },
    label: "Lobby",
    x: left - 34,
    y: floorZeroHall.y,
  });
  addLocation({
    id: "exterior",
    type: "exterior",
    floorIndex: 0,
    cell: { x: -2, y: 0 },
    label: "Exterior",
    x: left - 78,
    y: floorZeroHall.y + 12,
  });
  addEdge(edges, "exterior", "lobby", 1, "walk");
  addEdge(edges, "lobby", "hall-f0-c0", 1, "walk");

  for (let floorIndex = 0; floorIndex < floors - 1; floorIndex += 1) {
    for (let shaftIndex = 0; shaftIndex < unitsPerFloor - 1; shaftIndex += 1) {
      const fromColumn = (floorIndex + shaftIndex) % 2 === 0 ? shaftIndex : shaftIndex + 1;
      const toColumn = fromColumn === shaftIndex ? shaftIndex + 1 : shaftIndex;
      const fromLocationId = `hall-f${floorIndex}-c${fromColumn}`;
      const toLocationId = `hall-f${floorIndex + 1}-c${toColumn}`;
      const from = locations[fromLocationId];
      const to = locations[toLocationId];
      const stairId = `stair-f${floorIndex}-s${shaftIndex}`;

      stairs.push({
        id: stairId,
        fromLocationId,
        toLocationId,
        fromCell: from.cell,
        toCell: to.cell,
        fromX: from.x,
        fromY: from.y - 8,
        toX: to.x,
        toY: to.y + 8,
      });
      addEdge(edges, fromLocationId, toLocationId, 1.8, "stair");
    }
  }

  for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
    blockedCells.push({ x: -3, y: floorIndex * 3 + 1 });
    blockedCells.push({ x: unitsPerFloor * 2 + 1, y: floorIndex * 3 + 1 });
  }

  return {
    config: { floors, unitsPerFloor, seed: settings.seed },
    units,
    locations,
    doors,
    stairs,
    walkableCells,
    blockedCells,
    edges,
    bounds: { left, top, width, height, unitWidth, floorHeight },
  };
}

function emptyMovement(locationId: string): MovementState {
  return {
    status: "idle",
    fromLocationId: locationId,
    dynamicTarget: false,
    currentWaypointIndex: 0,
    elapsedMs: 0,
    durationMs: 0,
    path: [],
    pathCells: [],
  };
}

function createSimulation(settings: BuildingSettings): SimulatorState {
  const normalizedSettings = {
    floors: clampInt(settings.floors, 2, 4),
    unitsPerFloor: clampInt(settings.unitsPerFloor, 2, 5),
    seed: settings.seed.trim() || DEFAULT_SETTINGS.seed,
    initialBudgetAed: Math.max(0, Math.round(settings.initialBudgetAed)),
  };
  const layout = generateBuilding(normalizedSettings);
  const agents = CAST.map((castMember, index) => {
    const unit = layout.units[index];
    const locationId = unit ? unit.roomLocationId : "exterior";
    const location = layout.locations[locationId];
    if (unit) {
      unit.tenantId = castMember.id;
    }

    return {
      ...castMember,
      unitId: unit?.id,
      locationId,
      subscriptionLocationId: locationId,
      visual: { x: location.x, y: location.y },
      movement: emptyMovement(locationId),
      statusLabel: castMember.id === "skelly" ? "move-in pending" : "idle",
    };
  });

  const occupied = layout.units.filter((unit) => unit.tenantId).length;
  const state: SimulatorState = {
    settings: normalizedSettings,
    layout,
    landlord: {
      initialBudgetAed: normalizedSettings.initialBudgetAed,
      budgetAed: normalizedSettings.initialBudgetAed,
      selectedFloorIndex: 0,
      selectedUnitId: layout.units[0]?.id ?? "",
      capitalEvents: [],
    },
    agents,
    events: [],
    metrics: {
      reputation: 72,
      occupancy: Math.round((occupied / layout.units.length) * 100),
      satisfaction: 67,
      maintenancePressure: 44,
      roiProxy: 58,
    },
    debug: createDebugState(),
    simTimeMs: 0,
    day: 1,
    nextEventId: 1,
    nextCapitalEventId: 1,
    renderVersion: 1,
  };

  addEvent(state, "setup", `Generated ${layout.config.floors}x${layout.config.unitsPerFloor} building from seed "${layout.config.seed}".`);
  say(state, "amina", "leila", "Please keep the hallway clear.");
  startMovement(state, "basim", "character", "leila", "walk");
  return state;
}

function addEvent(state: SimulatorState, type: string, text: string) {
  state.events.push({
    id: `evt-${state.nextEventId}`,
    timestamp: state.simTimeMs,
    type,
    text,
  });
  state.nextEventId += 1;
  state.events = state.events.slice(-32);
}

function addCapitalEvent(
  state: SimulatorState,
  sourceType: CapitalEvent["sourceType"],
  amountAed: number,
  description: string,
  unitId?: string,
  residentId?: string,
) {
  const budgetBeforeAed = state.landlord.budgetAed;
  const budgetAfterAed = budgetBeforeAed + amountAed;
  state.landlord.budgetAed = budgetAfterAed;
  state.landlord.capitalEvents.push({
    id: `cap-${state.nextCapitalEventId}`,
    day: state.day,
    timestamp: state.simTimeMs,
    sourceType,
    amountAed,
    unitId,
    residentId,
    description,
    budgetBeforeAed,
    budgetAfterAed,
  });
  state.nextCapitalEventId += 1;
  state.landlord.capitalEvents = state.landlord.capitalEvents.slice(-18);
  addEvent(state, "capital", `${description} (${amountAed >= 0 ? "+" : ""}${formatAed(amountAed)})`);
}

function say(state: SimulatorState, speakerId: string, targetId: string, text: string) {
  const speaker = state.agents.find((agent) => agent.id === speakerId);
  const target = state.agents.find((agent) => agent.id === targetId);
  if (!speaker) {
    return;
  }
  speaker.bubble = { text, untilMs: state.simTimeMs + 8000 };
  speaker.statusLabel = "speaking";
  addEvent(
    state,
    "speech",
    `${speaker.name}${target ? ` to ${target.name}` : ""}: "${text}"`,
  );
}

function heuristic(a: Cell, b: Cell) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findPath(layout: BuildingLayout, startId: string, targetId: string) {
  if (startId === targetId) {
    return [startId];
  }
  if (!layout.locations[startId] || !layout.locations[targetId]) {
    return [];
  }

  const open = new Set([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);
  const fScore = new Map<string, number>([
    [startId, heuristic(layout.locations[startId].cell, layout.locations[targetId].cell)],
  ]);

  while (open.size > 0) {
    const current = [...open].sort(
      (a, b) => (fScore.get(a) ?? Number.POSITIVE_INFINITY) - (fScore.get(b) ?? Number.POSITIVE_INFINITY),
    )[0];
    if (current === targetId) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor) as string;
        path.unshift(cursor);
      }
      return path;
    }

    open.delete(current);
    for (const edge of layout.edges[current] ?? []) {
      const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.cost;
      if (tentative >= (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }
      cameFrom.set(edge.to, current);
      gScore.set(edge.to, tentative);
      fScore.set(edge.to, tentative + heuristic(layout.locations[edge.to].cell, layout.locations[targetId].cell));
      open.add(edge.to);
    }
  }

  return [startId];
}

function resolveTargetLocation(
  state: SimulatorState,
  actor: AgentState,
  targetType: TargetType,
  targetId: string,
  accessIntent: "normal" | "invited" | "landlord_permitted" = "normal",
) {
  if (targetType === "character") {
    const target = state.agents.find((agent) => agent.id === targetId);
    return target?.locationId;
  }

  if (targetType === "location") {
    return state.layout.locations[targetId]?.id;
  }

  if (targetType === "door") {
    const byDoor = state.layout.doors.find((door) => door.id === targetId || door.unitId === targetId);
    return byDoor?.hallLocationId ?? state.layout.locations[targetId]?.id;
  }

  const unit = state.layout.units.find(
    (candidate) => candidate.id === targetId || candidate.roomLocationId === targetId,
  );
  if (!unit) {
    return undefined;
  }
  const hasAccess =
    actor.unitId === unit.id ||
    accessIntent === "invited" ||
    accessIntent === "landlord_permitted";
  return unit.lockedForVisitor && !hasAccess ? unit.doorLocationId : unit.roomLocationId;
}

function pathLength(layout: BuildingLayout, path: string[]) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const previous = layout.locations[path[i - 1]];
    const current = layout.locations[path[i]];
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}

function startMovement(
  state: SimulatorState,
  actorId: string,
  targetType: TargetType,
  targetId: string,
  speed: "walk" | "run",
  accessIntent: "normal" | "invited" | "landlord_permitted" = "normal",
) {
  const actor = state.agents.find((agent) => agent.id === actorId);
  if (!actor || actor.movement.status === "moving") {
    return;
  }

  const targetLocationId = resolveTargetLocation(state, actor, targetType, targetId, accessIntent);
  if (!targetLocationId) {
    actor.movement = { ...emptyMovement(actor.locationId), status: "unreachable_endpoint" };
    addEvent(state, "movement", `${actor.name} could not resolve ${targetType}:${targetId}.`);
    return;
  }

  const path = findPath(state.layout, actor.locationId, targetLocationId);
  if (path.length < 1) {
    actor.movement = { ...emptyMovement(actor.locationId), status: "unreachable_endpoint" };
    addEvent(state, "movement", `${actor.name} found no route to ${targetLocationId}.`);
    return;
  }

  const length = pathLength(state.layout, path);
  const pixelsPerMs = speed === "run" ? 0.14 : 0.085;
  const durationMs = Math.max(500, Math.round(length / pixelsPerMs));
  const targetLocation = state.layout.locations[targetLocationId];
  actor.movement = {
    status: path.length === 1 ? "arrived" : "moving",
    fromLocationId: actor.locationId,
    targetLocationId,
    targetType,
    targetId,
    targetCharacterId: targetType === "character" ? targetId : undefined,
    targetRoomId: targetType === "room" ? targetId : undefined,
    dynamicTarget: targetType === "character",
    currentWaypointIndex: 0,
    elapsedMs: 0,
    durationMs,
    path,
    pathCells: path.map((locationId) => state.layout.locations[locationId].cell),
    lastResolvedTargetCell: targetLocation.cell,
    lastResolvedTargetLocationId: targetLocationId,
  };
  actor.statusLabel = "moving";
  addEvent(
    state,
    "movement",
    `${actor.name} started moving to ${targetLocation.label}; subscription remains ${state.layout.locations[actor.subscriptionLocationId].label} until arrival.`,
  );
}

function pointAlongPath(layout: BuildingLayout, path: string[], elapsedMs: number, durationMs: number) {
  if (path.length === 0) {
    return undefined;
  }
  if (path.length === 1 || durationMs <= 0) {
    const location = layout.locations[path[path.length - 1]];
    return { x: location.x, y: location.y, waypointIndex: path.length - 1 };
  }

  const total = pathLength(layout, path);
  const distance = total * Math.min(1, Math.max(0, elapsedMs / durationMs));
  let walked = 0;

  for (let index = 1; index < path.length; index += 1) {
    const previous = layout.locations[path[index - 1]];
    const current = layout.locations[path[index]];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (walked + segment >= distance) {
      const local = segment === 0 ? 1 : (distance - walked) / segment;
      return {
        x: previous.x + (current.x - previous.x) * local,
        y: previous.y + (current.y - previous.y) * local,
        waypointIndex: index - 1,
      };
    }
    walked += segment;
  }

  const finalLocation = layout.locations[path[path.length - 1]];
  return { x: finalLocation.x, y: finalLocation.y, waypointIndex: path.length - 1 };
}

function maybeReplanDynamicTarget(state: SimulatorState, actor: AgentState) {
  const movement = actor.movement;
  if (!movement.dynamicTarget || !movement.targetCharacterId || movement.status !== "moving") {
    return;
  }
  const target = state.agents.find((agent) => agent.id === movement.targetCharacterId);
  if (!target || target.locationId === movement.lastResolvedTargetLocationId) {
    return;
  }

  const currentPathNode = movement.path[Math.min(movement.currentWaypointIndex, movement.path.length - 1)] ?? actor.locationId;
  const path = findPath(state.layout, currentPathNode, target.locationId);
  actor.movement = {
    ...movement,
    replanReason: "target_changed_location",
    targetLocationId: target.locationId,
    elapsedMs: 0,
    durationMs: Math.max(500, Math.round(pathLength(state.layout, path) / 0.085)),
    path,
    pathCells: path.map((locationId) => state.layout.locations[locationId].cell),
    lastResolvedTargetCell: state.layout.locations[target.locationId].cell,
    lastResolvedTargetLocationId: target.locationId,
  };
  addEvent(state, "movement", `${actor.name} replanned because ${target.name} changed location.`);
}

function advanceSimulation(state: SimulatorState, ms: number) {
  const boundedMs = Math.max(0, Math.min(60 * 60 * 1000, Math.round(ms)));
  state.simTimeMs += boundedMs;
  state.day = 1 + Math.floor(state.simTimeMs / (24 * 60 * 60 * 1000));

  for (const actor of state.agents) {
    if (actor.bubble && actor.bubble.untilMs <= state.simTimeMs) {
      actor.bubble = undefined;
      if (actor.statusLabel === "speaking") {
        actor.statusLabel = "idle";
      }
    }

    maybeReplanDynamicTarget(state, actor);
    const movement = actor.movement;
    if (movement.status !== "moving") {
      continue;
    }

    movement.elapsedMs += boundedMs;
    const point = pointAlongPath(state.layout, movement.path, movement.elapsedMs, movement.durationMs);
    if (point) {
      actor.visual = { x: point.x, y: point.y };
      movement.currentWaypointIndex = point.waypointIndex;
    }

    if (movement.elapsedMs >= movement.durationMs && movement.targetLocationId) {
      const arrivedLocation = state.layout.locations[movement.targetLocationId];
      actor.locationId = arrivedLocation.id;
      actor.subscriptionLocationId = arrivedLocation.id;
      actor.visual = { x: arrivedLocation.x, y: arrivedLocation.y };
      actor.movement = {
        ...movement,
        status: "arrived",
        currentWaypointIndex: movement.path.length - 1,
      };
      actor.statusLabel = "arrived";
      addEvent(
        state,
        "movement",
        `${actor.name} arrived at ${arrivedLocation.label}; location subscription updated now.`,
      );
    }
  }

  state.renderVersion += 1;
}

function selectedUnit(state: SimulatorState) {
  return state.layout.units.find((unit) => unit.id === state.landlord.selectedUnitId) ?? state.layout.units[0];
}

function selectedTenant(state: SimulatorState) {
  const unit = selectedUnit(state);
  return unit?.tenantId ? state.agents.find((agent) => agent.id === unit.tenantId) : undefined;
}

function renovateSelectedUnit(state: SimulatorState) {
  const unit = selectedUnit(state);
  if (!unit) {
    return;
  }
  const cost = 18000 + unit.qualityLevel * 2500;
  if (state.landlord.budgetAed < cost) {
    addEvent(state, "renovation", `Insufficient budget to renovate ${unit.id}.`);
    return;
  }
  unit.qualityLevel = Math.min(5, unit.qualityLevel + 1);
  unit.templateId = unit.qualityLevel >= 4 ? "premium" : unit.templateId;
  unit.rentPotential += 850;
  unit.satisfactionModifier += 3;
  unit.maintenancePressure = Math.max(12, unit.maintenancePressure - 9);
  state.metrics.satisfaction = Math.min(100, state.metrics.satisfaction + 2);
  state.metrics.maintenancePressure = Math.max(0, state.metrics.maintenancePressure - 3);
  state.metrics.roiProxy = Math.min(100, state.metrics.roiProxy + 2);
  addCapitalEvent(state, "renovation", -cost, `Renovated ${unit.id}`, unit.id, unit.tenantId);
}

function renovateSelectedFloor(state: SimulatorState) {
  const floorIndex = state.landlord.selectedFloorIndex;
  const units = state.layout.units.filter((unit) => unit.floorIndex === floorIndex);
  const cost = units.length * 12000;
  if (state.landlord.budgetAed < cost) {
    addEvent(state, "renovation", `Insufficient budget to renovate floor ${floorIndex + 1}.`);
    return;
  }
  for (const unit of units) {
    unit.qualityLevel = Math.min(5, unit.qualityLevel + 1);
    unit.rentPotential += 500;
    unit.maintenancePressure = Math.max(10, unit.maintenancePressure - 5);
  }
  state.metrics.satisfaction = Math.min(100, state.metrics.satisfaction + 4);
  state.metrics.maintenancePressure = Math.max(0, state.metrics.maintenancePressure - 5);
  state.metrics.roiProxy = Math.min(100, state.metrics.roiProxy + 3);
  addCapitalEvent(state, "renovation", -cost, `Renovated floor ${floorIndex + 1}`);
}

function applyActionCard(state: SimulatorState, action: "repair" | "complaint" | "rent" | "skip" | "mediate") {
  const unit = selectedUnit(state);
  const tenant = selectedTenant(state);
  if (!unit) {
    return;
  }

  if (action === "repair") {
    addCapitalEvent(state, "maintenance", -4500, `Repair dispatched to ${unit.id}`, unit.id, tenant?.id);
    state.metrics.maintenancePressure = Math.max(0, state.metrics.maintenancePressure - 4);
    startMovement(state, "omar", "room", unit.id, "walk", "landlord_permitted");
    say(state, tenant?.id ?? "amina", "omar", "The leak is near the kitchen wall.");
    return;
  }

  if (action === "complaint") {
    state.metrics.reputation = Math.max(0, state.metrics.reputation - 2);
    state.metrics.satisfaction = Math.max(0, state.metrics.satisfaction - 3);
    addEvent(state, "complaint", `${tenant?.name ?? "A resident"} filed a hallway noise complaint.`);
    say(state, tenant?.id ?? "leila", "basim", "This hallway is not a nightclub.");
    startMovement(state, "basim", "character", tenant?.id ?? "leila", "walk");
    return;
  }

  if (action === "rent") {
    const amount = unit.rentPotential;
    state.metrics.reputation = Math.min(100, state.metrics.reputation + 1);
    addCapitalEvent(state, "rent_payment", amount, `${tenant?.name ?? "Tenant"} paid rent`, unit.id, tenant?.id);
    say(state, tenant?.id ?? "amina", "landlord", "Rent paid. Please note the receipt.");
    return;
  }

  if (action === "skip") {
    const amount = -Math.round(unit.rentPotential * 0.8);
    state.metrics.roiProxy = Math.max(0, state.metrics.roiProxy - 4);
    state.metrics.satisfaction = Math.max(0, state.metrics.satisfaction - 1);
    addCapitalEvent(state, "skipped_rent", amount, `${tenant?.name ?? "Tenant"} skipped rent`, unit.id, tenant?.id);
    say(state, tenant?.id ?? "skelly", "landlord", "My rent plan has briefly lost structural integrity.");
    return;
  }

  state.metrics.reputation = Math.min(100, state.metrics.reputation + 2);
  state.metrics.satisfaction = Math.min(100, state.metrics.satisfaction + 2);
  addEvent(state, "mediation", "Landlord queued a mediated move-in/out decision.");
  startMovement(state, "skelly", "location", "lobby", "walk");
  say(state, "skelly", "landlord", "I can move in after day one. Bone-dry paperwork ready.");
}

function renderGameToText(state: SimulatorState) {
  const dynamic = state.agents
    .filter((agent) => agent.movement.dynamicTarget)
    .map((agent) => ({
      actorId: agent.id,
      targetCharacterId: agent.movement.targetCharacterId,
      targetLocationId: agent.movement.targetLocationId,
      lastResolvedTargetCell: agent.movement.lastResolvedTargetCell,
      replanReason: agent.movement.replanReason ?? null,
    }));

  return JSON.stringify({
    coordinateSystem:
      "logical cells use x left-to-right and y floor-up; pixels use canvas top-left origin",
    building: {
      floors: state.layout.config.floors,
      unitsPerFloor: state.layout.config.unitsPerFloor,
      widthPx: Math.round(state.layout.bounds.width),
      heightPx: Math.round(state.layout.bounds.height),
      fixedCamera: true,
    },
    selected: {
      floorIndex: state.landlord.selectedFloorIndex,
      unitId: state.landlord.selectedUnitId,
    },
    agents: state.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      locationId: agent.locationId,
      subscriptionLocationId: agent.subscriptionLocationId,
      cell: state.layout.locations[agent.locationId]?.cell,
      visualPx: { x: Math.round(agent.visual.x), y: Math.round(agent.visual.y) },
      movement: {
        status: agent.movement.status,
        targetLocationId: agent.movement.targetLocationId ?? null,
        dynamicTarget: agent.movement.dynamicTarget,
        currentWaypointIndex: agent.movement.currentWaypointIndex,
        path: agent.movement.pathCells,
      },
    })),
    dynamicTargetState: dynamic.length > 0 ? dynamic : null,
    budgetAed: Math.round(state.landlord.budgetAed),
    recentCapitalEvents: state.landlord.capitalEvents.slice(-5),
    recentEvents: state.events.slice(-8).map((event) => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      text: event.text,
    })),
  });
}

function drawSimulatorScene(scene: import("phaser").Scene, state: SimulatorState) {
  const existing = scene.data.get("labels") as Array<{ destroy: () => void }> | undefined;
  existing?.forEach((label) => label.destroy());
  const labels: Array<{ destroy: () => void }> = [];
  scene.data.set("labels", labels);

  let graphics = scene.data.get("graphics") as import("phaser").GameObjects.Graphics | undefined;
  if (!graphics) {
    graphics = scene.add.graphics();
    scene.data.set("graphics", graphics);
  }
  const g = graphics;
  g.clear();
  g.fillStyle(0x10151b, 1);
  g.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  g.fillStyle(0x17232c, 1);
  g.fillRect(0, SCENE_HEIGHT - 44, SCENE_WIDTH, 44);
  g.lineStyle(1, 0x41515f, 0.7);
  g.strokeRect(18, 18, SCENE_WIDTH - 36, SCENE_HEIGHT - 36);

  const { bounds } = state.layout;
  g.fillStyle(0x0d1117, 1);
  g.fillRect(bounds.left - 12, bounds.top - 14, bounds.width + 24, bounds.height + 18);

  for (const unit of state.layout.units) {
    const x = bounds.left + unit.columnIndex * bounds.unitWidth;
    const y = bounds.top + (state.layout.config.floors - unit.floorIndex - 1) * bounds.floorHeight;
    const selected = unit.id === state.landlord.selectedUnitId;
    const palette =
      unit.templateId === "premium"
        ? 0x294a43
        : unit.templateId === "cluttered"
          ? 0x493b2e
          : 0x243442;
    g.fillStyle(palette, 1);
    g.fillRect(x + 2, y + 2, bounds.unitWidth - 4, bounds.floorHeight - HALL_HEIGHT - 2);
    g.fillStyle(0x202832, 1);
    g.fillRect(x + 2, y + bounds.floorHeight - HALL_HEIGHT, bounds.unitWidth - 4, HALL_HEIGHT - 2);
    g.lineStyle(selected ? 3 : 1, selected ? 0xf4d35e : 0x55606b, selected ? 1 : 0.7);
    g.strokeRect(x + 2, y + 2, bounds.unitWidth - 4, bounds.floorHeight - 4);

    const qualityWidth = Math.max(12, unit.qualityLevel * 13);
    g.fillStyle(0xf4d35e, 0.85);
    g.fillRect(x + 9, y + 10, qualityWidth, 5);
  }

  g.lineStyle(2, 0x6a7480, 0.8);
  for (let floorIndex = 1; floorIndex < state.layout.config.floors; floorIndex += 1) {
    const y = bounds.top + floorIndex * bounds.floorHeight;
    g.lineBetween(bounds.left, y, bounds.left + bounds.width, y);
  }

  if (state.debug.stairs) {
    g.lineStyle(4, 0xd6a045, 0.75);
    for (const stair of state.layout.stairs) {
      g.lineBetween(stair.fromX, stair.fromY, stair.toX, stair.toY);
    }
  }

  if (state.debug.doors) {
    g.fillStyle(0xe7d7a3, 1);
    for (const door of state.layout.doors) {
      const location = state.layout.locations[door.roomLocationId];
      g.fillRect(location.x - 12, location.y + bounds.floorHeight / 2 - 38, 24, 8);
    }
  }

  if (state.debug.grid) {
    g.lineStyle(1, 0x6f8292, 0.18);
    for (const location of Object.values(state.layout.locations)) {
      g.strokeCircle(location.x, location.y, 12);
    }
  }

  if (state.debug.collisions) {
    g.fillStyle(0xe05252, 0.45);
    for (const cell of state.layout.blockedCells) {
      g.fillRect(bounds.left + cell.x * 18, SCENE_HEIGHT - 58 - cell.y * 18, 12, 12);
    }
  }

  if (state.debug.path) {
    for (const agent of state.agents) {
      const path = agent.movement.path;
      if (path.length < 2 || agent.movement.status !== "moving") {
        continue;
      }
      g.lineStyle(3, colorToNumber(agent.color), 0.8);
      for (let i = 1; i < path.length; i += 1) {
        const previous = state.layout.locations[path[i - 1]];
        const current = state.layout.locations[path[i]];
        g.lineBetween(previous.x, previous.y, current.x, current.y);
      }
    }
  }

  function addLabel(x: number, y: number, text: string, size = 12, color = "#edf2f7") {
    const label = scene.add.text(x, y, text, {
      color,
      fontFamily: "Arial",
      fontSize: `${size}px`,
      align: "center",
    });
    label.setOrigin(0.5);
    labels.push(label);
  }

  for (const unit of state.layout.units) {
    const room = state.layout.locations[unit.roomLocationId];
    addLabel(room.x, room.y - 34, unit.id.replace("unit-", "").toUpperCase(), 11, "#cbd5df");
    if (state.debug.nodes) {
      addLabel(room.x, room.y + 28, room.id, 9, "#9fb0bf");
    }
  }

  addLabel(72, 32, "Decision simulator: fixed camera side cutaway", 14, "#edf2f7");
  addLabel(76, SCENE_HEIGHT - 23, "Exterior", 11, "#aeb9c5");
  addLabel(state.layout.locations.lobby.x, state.layout.locations.lobby.y - 24, "Lobby", 11, "#aeb9c5");

  for (const agent of state.agents) {
    const x = agent.visual.x;
    const y = agent.visual.y;
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(x + 4, y + 16, 32, 8);
    g.fillStyle(colorToNumber(agent.color), 1);
    g.fillCircle(x, y, 13);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeCircle(x, y, 13);
    addLabel(x, y + 1, agent.name.slice(0, 1), 12, "#10151b");
    addLabel(x, y + 28, `${agent.name} - ${agent.statusLabel}`, 10, "#edf2f7");

    if (agent.bubble) {
      const bubbleText = agent.bubble.text.length > 42 ? `${agent.bubble.text.slice(0, 39)}...` : agent.bubble.text;
      const width = Math.min(250, Math.max(92, bubbleText.length * 6 + 18));
      const bx = Math.max(50, Math.min(SCENE_WIDTH - width - 20, x - width / 2));
      const by = Math.max(38, y - 78);
      g.fillStyle(0xfaf8f3, 0.96);
      g.fillRoundedRect(bx, by, width, 32, 8);
      g.fillStyle(0xfaf8f3, 0.96);
      g.fillTriangle(x - 6, by + 30, x + 6, by + 30, x, by + 42);
      addLabel(bx + width / 2, by + 16, bubbleText, 10, "#10151b");
    }
  }

  if (state.debug.movementLogs) {
    const moving = state.agents.filter((agent) => agent.movement.status === "moving");
    const text = moving.length
      ? moving.map((agent) => `${agent.name}: ${agent.movement.path.join(" > ")}`).join("\n")
      : "No active movement";
    const label = scene.add.text(22, 52, text, {
      color: "#edf2f7",
      fontFamily: "monospace",
      fontSize: "10px",
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: { x: 6, y: 5 },
    });
    labels.push(label);
  }
}

function statusDeltaText() {
  return [
    "Stage 05 Phaser UI: Not started -> Partial runtime.",
    "App shell: Divergent starter land demo -> Partial runtime decision simulator shell.",
    "Verification needed: keep build/browser checks noted until parent integrator updates icm/STATUS.md.",
  ];
}

export default function DecisionSimulatorShell() {
  const stateRef = useRef<SimulatorState | null>(null);
  const phaserParentRef = useRef<HTMLDivElement | null>(null);
  const [viewVersion, setViewVersion] = useState(0);
  const [phaserError, setPhaserError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [landlordText, setLandlordText] = useState("Offer a quiet-hours compromise and track ROI impact.");

  if (stateRef.current === null) {
    stateRef.current = createSimulation(DEFAULT_SETTINGS);
  }

  const sim = stateRef.current;
  const unit = selectedUnit(sim);
  const tenant = selectedTenant(sim);

  function bump() {
    if (stateRef.current) {
      stateRef.current.renderVersion += 1;
    }
    setViewVersion((current) => current + 1);
  }

  function resetSimulation() {
    stateRef.current = createSimulation(settingsDraft);
    bump();
  }

  function mutate(mutator: (state: SimulatorState) => void) {
    if (!stateRef.current) {
      return;
    }
    mutator(stateRef.current);
    advanceSimulation(stateRef.current, 0);
    bump();
  }

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current as SimulatorState);
    window.advanceTime = (ms: number) => {
      advanceSimulation(stateRef.current as SimulatorState, ms);
      setViewVersion((current) => current + 1);
      return renderGameToText(stateRef.current as SimulatorState);
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, []);

  useEffect(() => {
    let destroyed = false;
    let game: import("phaser").Game | null = null;

    async function bootPhaser() {
      try {
        const Phaser = await import("phaser");
        if (destroyed || !phaserParentRef.current) {
          return;
        }

        class SimulatorScene extends Phaser.Scene {
          private lastVersion = -1;

          constructor() {
            super("decision-simulator");
          }

          create() {
            this.cameras.main.setBounds(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
            this.cameras.main.setScroll(0, 0);
            drawSimulatorScene(this, stateRef.current as SimulatorState);
            this.lastVersion = (stateRef.current as SimulatorState).renderVersion;
          }

          update() {
            const current = stateRef.current as SimulatorState;
            if (current.renderVersion !== this.lastVersion) {
              drawSimulatorScene(this, current);
              this.lastVersion = current.renderVersion;
            }
          }
        }

        game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: phaserParentRef.current,
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          backgroundColor: "#10151b",
          scene: SimulatorScene,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
        });
      } catch (error) {
        setPhaserError(error instanceof Error ? error.message : String(error));
      }
    }

    bootPhaser();
    return () => {
      destroyed = true;
      game?.destroy(true);
    };
  }, []);

  const recentEvents = sim.events.slice(-10).reverse();
  const recentCapital = sim.landlord.capitalEvents.slice(-5).reverse();

  return (
    <main className="min-h-screen bg-[#0f1419] px-4 py-5 text-sand-50 sm:px-6">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ed1c6]">
              Abu Dhabi AI PropTech Challenge - Decision Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Real Estate Life Simulator
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sand-50/68">
              Deterministic Stage 05 shell with a generated building, resident movement,
              budget effects, and local browser hooks for recording.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-sand-50/70">
            <span className="rounded-md border border-white/12 px-3 py-2">Mock mode</span>
            <span className="rounded-md border border-white/12 px-3 py-2">Fixed camera</span>
            <span className="rounded-md border border-white/12 px-3 py-2">
              render_game_to_text
            </span>
          </div>
        </header>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div
              ref={phaserParentRef}
              data-version={viewVersion}
              className="h-[min(64vh,640px)] min-h-[420px] w-full overflow-hidden rounded-lg border border-white/12 bg-[#10151b]"
            />
            {phaserError ? (
              <p className="mt-2 rounded-md border border-red-300/30 bg-red-950/30 px-3 py-2 text-sm text-red-100">
                Phaser failed to start: {phaserError}
              </p>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
                  Budget
                </h2>
                <span className="text-lg font-semibold tabular-nums">
                  {formatAed(sim.landlord.budgetAed)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Metric label="Reputation" value={sim.metrics.reputation} />
                <Metric label="Occupancy" value={sim.metrics.occupancy} suffix="%" />
                <Metric label="Satisfaction" value={sim.metrics.satisfaction} />
                <Metric label="Maint." value={sim.metrics.maintenancePressure} />
                <Metric label="ROI proxy" value={sim.metrics.roiProxy} />
                <Metric label="Day" value={sim.day} />
              </div>
            </section>

            <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
                Selected unit
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-sand-50/65">
                  Floor
                  <select
                    value={sim.landlord.selectedFloorIndex}
                    onChange={(event) =>
                      mutate((state) => {
                        const floorIndex = Number(event.target.value);
                        const nextUnit =
                          state.layout.units.find((candidate) => candidate.floorIndex === floorIndex) ??
                          state.layout.units[0];
                        state.landlord.selectedFloorIndex = floorIndex;
                        state.landlord.selectedUnitId = nextUnit.id;
                      })
                    }
                    className="mt-1 w-full rounded-md border border-white/12 bg-[#0f1419] px-2 py-2 text-sm text-sand-50"
                  >
                    {Array.from({ length: sim.layout.config.floors }).map((_, floorIndex) => (
                      <option key={floorIndex} value={floorIndex}>
                        Floor {floorIndex + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-sand-50/65">
                  Unit
                  <select
                    value={sim.landlord.selectedUnitId}
                    onChange={(event) =>
                      mutate((state) => {
                        const nextUnit = state.layout.units.find((candidate) => candidate.id === event.target.value);
                        if (nextUnit) {
                          state.landlord.selectedUnitId = nextUnit.id;
                          state.landlord.selectedFloorIndex = nextUnit.floorIndex;
                        }
                      })
                    }
                    className="mt-1 w-full rounded-md border border-white/12 bg-[#0f1419] px-2 py-2 text-sm text-sand-50"
                  >
                    {sim.layout.units.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        F{candidate.floorIndex + 1} U{candidate.columnIndex + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-sand-50/72">
                <dt>Tenant</dt>
                <dd className="text-right text-sand-50">{tenant?.name ?? "Vacant"}</dd>
                <dt>Template</dt>
                <dd className="text-right capitalize text-sand-50">{unit?.templateId}</dd>
                <dt>Quality</dt>
                <dd className="text-right text-sand-50">{unit?.qualityLevel}/5</dd>
                <dt>Rent</dt>
                <dd className="text-right text-sand-50">{formatAed(unit?.rentPotential ?? 0)}</dd>
              </dl>
            </section>

            <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
                Recent capital
              </h2>
              <div className="mt-3 space-y-2 text-sm">
                {recentCapital.length === 0 ? (
                  <p className="text-sand-50/55">No budget changes yet.</p>
                ) : (
                  recentCapital.map((event) => (
                    <div key={event.id} className="flex justify-between gap-3 border-b border-white/8 pb-2">
                      <span className="text-sand-50/72">{event.description}</span>
                      <span className={event.amountAed >= 0 ? "text-[#8ed1c6]" : "text-[#f2a177]"}>
                        {event.amountAed >= 0 ? "+" : ""}
                        {formatAed(event.amountAed)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr_360px]">
          <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
              Scenario setup
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField
                label="Floors"
                min={2}
                max={4}
                value={settingsDraft.floors}
                onChange={(floors) => setSettingsDraft((current) => ({ ...current, floors }))}
              />
              <NumberField
                label="Units/floor"
                min={2}
                max={5}
                value={settingsDraft.unitsPerFloor}
                onChange={(unitsPerFloor) => setSettingsDraft((current) => ({ ...current, unitsPerFloor }))}
              />
              <label className="col-span-2 text-xs text-sand-50/65">
                Seed
                <input
                  value={settingsDraft.seed}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, seed: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-white/12 bg-[#0f1419] px-2 py-2 text-sm text-sand-50"
                />
              </label>
              <NumberField
                label="Start budget"
                min={0}
                max={1000000}
                value={settingsDraft.initialBudgetAed}
                onChange={(initialBudgetAed) =>
                  setSettingsDraft((current) => ({ ...current, initialBudgetAed }))
                }
              />
              <button
                onClick={resetSimulation}
                className="self-end rounded-md bg-[#8ed1c6] px-3 py-2 text-sm font-semibold text-[#0f1419] transition hover:bg-[#a8ded6]"
              >
                Apply setup
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
              Landlord controls
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ActionButton label="Repair" detail="-4,500 AED" onClick={() => mutate((state) => applyActionCard(state, "repair"))} />
              <ActionButton label="Complaint" detail="Reputation risk" onClick={() => mutate((state) => applyActionCard(state, "complaint"))} />
              <ActionButton label="Rent paid" detail="Cash in" onClick={() => mutate((state) => applyActionCard(state, "rent"))} />
              <ActionButton label="Skipped rent" detail="Lost cashflow" onClick={() => mutate((state) => applyActionCard(state, "skip"))} />
              <ActionButton label="Mediate" detail="Move-in/out" onClick={() => mutate((state) => applyActionCard(state, "mediate"))} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={landlordText}
                onChange={(event) => setLandlordText(event.target.value)}
                className="rounded-md border border-white/12 bg-[#0f1419] px-3 py-2 text-sm text-sand-50"
              />
              <button
                onClick={() =>
                  mutate((state) => {
                    addEvent(state, "landlord_note", `Landlord note: ${landlordText.trim() || "No text"}`);
                    state.metrics.reputation = Math.min(100, state.metrics.reputation + 1);
                  })
                }
                className="rounded-md border border-white/18 px-3 py-2 text-sm font-semibold text-sand-50 transition hover:border-white/35"
              >
                Send note
              </button>
              <button
                onClick={() => window.advanceTime?.(2400)}
                className="rounded-md border border-white/18 px-3 py-2 text-sm font-semibold text-sand-50 transition hover:border-white/35"
              >
                Advance
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => mutate(renovateSelectedUnit)}
                className="rounded-md bg-[#f4d35e] px-3 py-2 text-sm font-semibold text-[#17140a] transition hover:bg-[#f7de83]"
              >
                Renovate unit
              </button>
              <button
                onClick={() => mutate(renovateSelectedFloor)}
                className="rounded-md border border-[#f4d35e]/60 px-3 py-2 text-sm font-semibold text-[#f4d35e] transition hover:border-[#f4d35e]"
              >
                Renovate floor
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-white/12 bg-[#151b22] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
              Dev overlay
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {(Object.keys(DEBUG_LABELS) as DebugKey[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sand-50/75">
                  <input
                    type="checkbox"
                    checked={sim.debug[key]}
                    onChange={() =>
                      mutate((state) => {
                        state.debug[key] = !state.debug[key];
                      })
                    }
                    className="h-4 w-4 accent-[#8ed1c6]"
                  />
                  {DEBUG_LABELS[key]}
                </label>
              ))}
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(renderGameToText(sim));
              }}
              className="mt-4 w-full rounded-md border border-white/18 px-3 py-2 text-sm font-semibold text-sand-50 transition hover:border-white/35"
            >
              Copy text state
            </button>
          </section>
        </section>

        <section className="mt-4 rounded-lg border border-white/12 bg-[#151b22] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sand-50/70">
              Event log
            </h2>
            <span className="text-xs text-sand-50/50">Status deltas ready for parent integrator</span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-white/8 bg-[#10151b] px-3 py-2 text-sm">
                <span className="mr-2 text-xs uppercase tracking-wide text-[#8ed1c6]">{event.type}</span>
                <span className="text-sand-50/78">{event.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden" aria-hidden="true">
            {statusDeltaText().join(" ")}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-[#10151b] px-3 py-2">
      <div className="text-xs text-sand-50/55">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {value}
        {suffix}
      </div>
    </div>
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-sand-50/65">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-md border border-white/12 bg-[#0f1419] px-2 py-2 text-sm text-sand-50"
      />
    </label>
  );
}

function ActionButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-white/12 bg-[#10151b] px-3 py-3 text-left transition hover:border-[#8ed1c6]/70 hover:bg-[#121e24]"
    >
      <span className="block text-sm font-semibold text-sand-50">{label}</span>
      <span className="mt-1 block text-xs text-sand-50/58">{detail}</span>
    </button>
  );
}
