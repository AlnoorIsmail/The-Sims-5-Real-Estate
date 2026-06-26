# State Model: Generated Building And Movement

## Inputs

- Shared generated-building rules from `icm/_config/building-navigation.md`
- Character state-machine rules from `icm/_config/character-state-machine.md`
- Action and authority rules from `icm/_config/simulation-rules.md`
- Agent ownership boundaries from `icm/_config/agent-architecture.md`

## Process

Define TypeScript-friendly shapes for the future implementation. Keep them plain
data; Phaser, LangGraph, and Chroma should consume these shapes rather than own
the source of truth. Landlord budget is authoritative engine state; agents and
LLMs do not mutate it directly.

## Entities

### BuildingConfig

- `floors: number`: UI range 2 to 4, default 2
- `unitsPerFloor: number`: UI range 2 to 5, default 3
- `seed: string`
- `roomTemplates: RoomTemplateId[]`: basic, cluttered, premium

### GeneratedBuilding

- `config: BuildingConfig`
- `units: UnitState[]`
- `locations: LocationNode[]`
- `doors: DoorNode[]`
- `stairs: StairLink[]`
- `walkableCells: GridCell[]`
- `blockedCells: GridCell[]`
- `spawnPoints: Record<string, GridCell>`

### LandlordState

- `id`
- `initialBudgetAed: number`: set before the sim run
- `budgetAed: number`: current authoritative landlord budget
- `capitalEvents: CapitalEvent[]`
- `selectedFloorIndex?: number`
- `selectedUnitId?: string`
- `runControls`: floors, unitsPerFloor, seed, day length, mock/autonomous mode

### CapitalEvent

- `id`
- `day`
- `timestamp`
- `sourceType`: rent_payment, skipped_rent, renovation, maintenance, move_in,
  move_out, deposit, fee, incentive, gm_incident
- `amountAed`: positive for money in, negative for money out or lost expected
  cashflow
- `unitId?: string`
- `residentId?: string`
- `description`
- `sourceEventId`

### UnitState

- `id`
- `floorIndex`
- `columnIndex`
- `templateId`: basic, cluttered, premium
- `qualityLevel: number`
- `tenantId?: string`
- `doorLocationId`
- `roomLocationId`
- `rentPotential`
- `maintenancePressure`
- `satisfactionModifier`

### LocationNode

- `id`
- `type`: room, hall, stair, lobby, exterior, door
- `floorIndex?: number`
- `unitId?: string`
- `cell: GridCell`
- `label`
- `subscribers: agentId[]`

### DoorNode

- `id`
- `unitId`
- `hallLocationId`
- `roomLocationId`
- `cell`
- `lockedForVisitor: boolean`

### StairLink

- `id`
- `fromLocationId`
- `toLocationId`
- `fromCell`
- `toCell`
- `direction`: up, down

### PathRequest

- `actorId`
- `targetType`: character, room, location, door
- `targetId`
- `speed`: walk, run
- `accessIntent`: normal, invited, landlord_permitted, altercate

### PathResult

- `status`: reachable, nearest_reachable, rejected
- `waypoints: GridCell[]`
- `finalLocationId`
- `unreachableReason?: string`

### MovementState

- `actorId`
- `status`: idle, started_to_move, moving, arrived, unreachable_endpoint
- `fromLocationId`
- `targetLocationId`
- `targetCharacterId?: string`
- `targetRoomId?: string`
- `lastResolvedTargetCell?: GridCell`
- `lastResolvedTargetLocationId?: string`
- `dynamicTarget: boolean`
- `replanReason?: target_moved | target_changed_location | stale_path | access_changed | layout_changed`
- `currentWaypointIndex`
- `path: GridCell[]`

### RenovationAction

- `targetType`: unit, floor
- `targetId`
- `cost`
- `qualityDelta`
- `visualTemplateChange?: RoomTemplateId`
- `metricDeltas`: rentPotential, satisfaction, maintenancePressure, roiProxy

### Budget-Affecting Events

Budget-affecting events must carry:

- `budgetDeltaAed`
- `budgetBeforeAed`
- `budgetAfterAed`
- `capitalEventId`

Use these fields for validated rent payments, skipped rent, renovations,
maintenance, move-in/out costs, deposits, incentives, fees, and
game-master-adjudicated incidents.

### CharacterAgentState

- `agentId`
- `lifecycleState`: prospect, applicant, approved, rejected, moving_in,
  current, notice_given, moving_out, evicted, former, inactive
- `rentAccountState`: paid, due, late, delinquent, skipped, defaulted
- `executionState`: idle, observing, retrieving, deciding, waiting_on_tool,
  moving, acting, speaking, digesting, reflecting, cooling_down, limited_wait
- `socialReplyState: SocialReplyState`
- `perceptionState: PerceptionState`
- `behaviorState: BehaviorState`
- `goalState: GoalState`
- `limiterState: AgentLimiterState`
- `idempotencyScopeId`

Lifecycle and rent account transitions are engine/game-master authority. The
LLM can propose actions that may lead to transitions, but cannot set these
states directly.

### BehaviorState

Use 0-100 integers:

- `needs`
- `mood`
- `stress`
- `patience`
- `sociability`
- `conflictTolerance`
- `landlordTrust`
- `rentPressure`
- `attachmentToUnit`

Stable Big Five-derived traits:

- `extraversion`
- `agreeableness`
- `conscientiousness`
- `neuroticism`

The engine updates and clamps mutable numbers. Traits stay stable; beliefs and
relationships evolve through memory.

### GoalState

- `currentGoal`
- `obligations: string[]`
- `fears: string[]`
- `promises: string[]`

The graph may carry a goal across turns, but it emits only one bare tool action
at a time.

### SocialReplyState

- `pendingReplies: PendingReply[]`

`PendingReply` fields:

- `id`
- `speakerId`
- `targetId`
- `sourceSpeechEventId`
- `deadlineMs`
- `createdAt`
- `status`: pending, answered, expired

Pending replies do not block normal autonomy. Expired replies become in-world
silence observations.

### PerceptionState

- `rawQueue: RawPerception[]`
- `digestQueue: PerceptionDigestRequest[]`
- `pendingMemoryWrites: MemoryWriteRequest[]`
- `meaningfulEventCount`
- `lastReflectionAt`

Raw perceptions gathered during movement stay queued until a digest model call
is allowed.

### BareToolAction

- `id`
- `agentId`
- `verb`
- `targetType`
- `targetId`
- `args`

For `say_to`, `args` includes the message. Do not include freeform action
metadata, internal monologue, waypoints, pixel coordinates, or state mutations.

### AdaptiveLimiterState

- `runRateLimit`
- `scenePriorityQueue`
- `softMinimumTracker`
- `apiLimitSnapshot`
- `deniedCallEvents`

Scene priority favors landlord-facing actions, direct speech, altercations,
safety events, rent crises, visible demo beats, and high ROI/reputation/
occupancy/budget impact.

### AgentLimiterState

- `lastDecisionAt`
- `lastDigestAt`
- `lastReflectionAt`
- `softMinimumSatisfied`
- `limitedWaitReason?: string`

If a call is denied, the agent enters `limited_wait`, keeps visible idle or
occupied animation, and does not invent a fallback tool action.

### IdempotencyLedger

V1 uses an in-memory run ledger with deterministic ids for:

- graph runs
- node attempts
- LLM decisions
- tool intents
- engine events
- memory writes
- budget and capital events

Retried nodes replay cached LLM decisions instead of calling the model again.
Side effects are applied at most once.

## Outputs

Future implementation should expose enough state for:

- generated 2x3 default and 2-4 by 2-5 configured buildings
- one tenant per unit
- room targets entering by default unless locked or denied access resolves to a
  door
- Phaser movement completion to update `LocationNode.subscribers`
- floor/unit renovation to deduct landlord `budgetAed` and update ROI
  placeholders
- landlord budget setup, current budget display, and recent capital events
- layered CharacterAgent state
- adaptive limiter and idempotency ledger state
- raw plus interpreted perception memory flow

## Verify

- Every `move_to` endpoint can resolve to a location, door, or character.
- `move_to(roomId)` defaults to room entry unless access resolves it to a door.
- `move_to(characterId)` has enough state to replan toward a moving target.
- Every visible unit has a room, door, hall connection, and owner/ vacancy state.
- Stair links are explicit graph edges, not guessed by the agent.
- Budget-affecting events can explain each `budgetAed` change.
- CharacterAgent state separates lifecycle, rent account, execution, social
  reply, perception, memory, limiter, and idempotency concerns.
- Bare tool actions cannot mutate authoritative state directly.
- No state shape requires an LLM to be present.
