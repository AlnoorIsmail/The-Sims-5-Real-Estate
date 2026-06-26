import type {
  BehaviorState,
  CharacterAgentState,
  GeneratedBuilding,
  LandlordState,
  SimTickState,
  UnitState,
} from "@/lib/sim/types";
import { DEMO_SPRITE_CAST, buildCharacterIdentity } from "./personas";
import type { CharacterIdentity } from "./types";

export function defaultBehaviorState(seed: number): BehaviorState {
  const base = 45 + (seed % 20);
  return {
    needs: base,
    mood: base + 5,
    stress: 30 + (seed % 15),
    patience: 55,
    sociability: 40 + (seed % 30),
    conflictTolerance: 35 + (seed % 25),
    landlordTrust: 50,
    rentPressure: 25 + (seed % 20),
    attachmentToUnit: 40,
    extraversion: 30 + (seed % 40),
    agreeableness: 35 + (seed % 30),
    conscientiousness: 40 + (seed % 25),
    neuroticism: 25 + (seed % 30),
  };
}

export function createDemoBuilding(seed = "demo"): GeneratedBuilding {
  const floors = 2;
  const unitsPerFloor = 3;
  const units: UnitState[] = [];
  const locations: GeneratedBuilding["locations"] = [];
  const doors: GeneratedBuilding["doors"] = [];

  for (let floor = 0; floor < floors; floor += 1) {
    const hallId = `hall-f${floor}`;
    locations.push({
      id: hallId,
      type: "hall",
      floorIndex: floor,
      cell: { x: 0, y: floor * 10, floorIndex: floor },
      label: `Floor ${floor + 1} hall`,
      subscribers: [],
    });

    for (let col = 0; col < unitsPerFloor; col += 1) {
      const unitId = `unit-f${floor}-c${col}`;
      const roomId = `${unitId}-room`;
      const doorId = `${unitId}-door`;
      units.push({
        id: unitId,
        floorIndex: floor,
        columnIndex: col,
        templateId: col === 2 ? "premium" : col === 1 ? "cluttered" : "basic",
        qualityLevel: 50 + col * 10,
        doorLocationId: doorId,
        roomLocationId: roomId,
        rentPotential: 8000 + col * 500,
        maintenancePressure: 20 + col * 5,
        satisfactionModifier: 0,
      });

      locations.push({
        id: roomId,
        type: "room",
        floorIndex: floor,
        unitId,
        cell: { x: col + 1, y: floor * 10, floorIndex: floor },
        label: `Unit ${col + 1} room`,
        subscribers: [],
      });

      locations.push({
        id: doorId,
        type: "door",
        floorIndex: floor,
        unitId,
        cell: { x: col + 1, y: floor * 10 + 1, floorIndex: floor },
        label: `Unit ${col + 1} door`,
        subscribers: [],
      });

      doors.push({
        id: doorId,
        unitId,
        hallLocationId: hallId,
        roomLocationId: roomId,
        cell: { x: col + 1, y: floor * 10 + 1, floorIndex: floor },
        lockedForVisitor: true,
      });
    }
  }

  return {
    config: {
      floors,
      unitsPerFloor,
      seed,
      roomTemplates: ["basic", "cluttered", "premium"],
    },
    units,
    locations,
    doors,
    stairs: [],
    walkableCells: [],
    blockedCells: [],
    spawnPoints: {},
  };
}

export function createCharacterState(
  identity: CharacterIdentity,
  locationId: string,
  lifecycle: CharacterAgentState["lifecycleState"] = "current",
  ownedUnitId?: string
): CharacterAgentState {
  const hash = identity.agentId.length * 7;
  return {
    agentId: identity.agentId,
    lifecycleState: lifecycle,
    rentAccountState: lifecycle === "prospect" ? "due" : "paid",
    executionState: "idle",
    socialReplyState: { pendingReplies: [] },
    perceptionState: {
      rawQueue: [],
      digestQueue: [],
      pendingMemoryWrites: [],
      meaningfulEventCount: 0,
    },
    behaviorState: defaultBehaviorState(hash),
    goalState: {
      currentGoal: "Get through the day without drama",
      obligations: [],
      fears: [],
      promises: [],
    },
    limiterState: { softMinimumSatisfied: false },
    idempotencyScopeId: identity.agentId,
    currentLocationId: locationId,
    ownedUnitId,
    spriteKey: identity.spriteKey,
    displayName: identity.displayName,
  };
}

export function createDemoTickState(seed = "demo", budgetAed = 250_000): SimTickState {
  const building = createDemoBuilding(seed);
  const characters: Record<string, CharacterAgentState> = {};
  const identities: CharacterIdentity[] = [];

  DEMO_SPRITE_CAST.forEach((castMember, index) => {
    const identity = buildCharacterIdentity(castMember, seed);
    identities.push(identity);
    const unit = building.units[index];
    const lifecycle = castMember.agentId === "resident-skelly" ? "prospect" : "current";
    const locationId = unit ? unit.roomLocationId : building.locations[0].id;
    const ownedUnitId = lifecycle === "current" ? unit?.id : undefined;
    characters[identity.agentId] = createCharacterState(
      identity,
      locationId,
      lifecycle,
      ownedUnitId
    );
    const location = building.locations.find((node) => node.id === locationId);
    if (location) location.subscribers.push(identity.agentId);
    if (unit && lifecycle === "current") unit.tenantId = identity.agentId;
  });

  const landlord: LandlordState = {
    id: "landlord",
    initialBudgetAed: budgetAed,
    budgetAed,
    capitalEvents: [],
    runControls: {
      floors: building.config.floors,
      unitsPerFloor: building.config.unitsPerFloor,
      seed,
      dayLengthMs: 45_000,
      mockMode: true,
      autonomousMode: true,
    },
  };

  return {
    day: 1,
    dayPhase: "morning_brief",
    elapsedMs: 0,
    building,
    landlord,
    characters,
    movements: {},
    eventLog: [],
  };
}

export function getDemoIdentities(seed = "demo"): CharacterIdentity[] {
  return DEMO_SPRITE_CAST.map((castMember) => buildCharacterIdentity(castMember, seed));
}
