# Building And Navigation

This file freezes the v1 generated-building and pathfinding direction. It is a
planning contract only; it does not implement Phaser code.

## View Model

Use a fixed-camera side cutaway. The whole generated building fits in the game
panel; do not pan or scroll the camera in v1.

The rendered building is generated from:

- `floors`: default 2, UI range 2 to 4
- `unitsPerFloor`: default 3, UI range 2 to 5
- `seed`
- room template mix

The default demo is 2 floors by 3 units, exactly six tenant units.

## Unit Model

Use one tenant per unit. Total resident capacity is:

`floors * unitsPerFloor`

V1 room templates are same-size studios:

- basic
- cluttered
- premium

Furniture is decorative only. It does not block movement. Walls, doors, floor
edges, and stair connectors define movement constraints.

## Generated Topology

Each floor has:

- one hallway route
- `unitsPerFloor` studio rooms
- one door node per studio
- stair shafts between room columns

For `m` room columns, generate `m - 1` internal stair shafts. Stairs connect
floors in a zigzag vertical pattern: an agent enters a stair endpoint, traverses
the stair link, then exits into the hallway on the destination floor before
moving left or right to a unit door.

Outer edges become building walls. Edge connectors should close cleanly so
generated layouts do not expose gaps.

## Location Types

Use generated locations for movement, perception, and memory routing:

- `room`
- `hall`
- `stair`
- `lobby`
- `exterior`
- `door`

Every visible position maps to exactly one current location subscription.

## Move Targets

`move_to` is an endpoint command. Agents never provide waypoints.

Supported target families:

- `character`: move toward the target character's current reachable interaction
  cell
- `room`: move into the room by default
- `location` or `door`: move to a static generated endpoint

For `move_to(roomId)`, the default behavior is to enter the room. If the door is
locked and the actor is not the owner, invited, landlord-permitted, or
game-master-permitted, the target resolves to the room's door instead.

For `move_to(characterId)`, arrival means reaching the nearest valid interaction
cell for that character. Agents should not occupy the same grid cell.

## Room Access

Residents can path inside their own unit.

Visitors can enter another resident's room only when invited, explicitly
permitted by the landlord/game master, or adjudicated through an escalation.
Otherwise, room-target movement resolves to the door.

`altercate` may target a door as a serious escalation, such as trying to force
entry. It must be adjudicated by the game master before the path target changes
from the door to the room interior.

## A* Pathfinding

Implement a small custom TypeScript A* pathfinder in the future Phaser slice.

Rules:

- pathfinding runs on logical grid cells, not raw pixels
- normal movement is 4-way only
- stair traversal uses explicit stair-link edges
- endpoints are character, room, location, or door targets
- the agent never supplies waypoints or pixel paths
- static location, room, and door targets compute once unless the layout or door
  access state changes
- character targets are dynamic and replan when the target changes cell,
  changes location, reaches a new room/hall, or the current path becomes stale
- unreachable endpoints return the nearest safe reachable node plus a logged
  unreachable-target event

The `CharacterAgent` only requests a destination. The movement system owns:

`started_to_move -> moving -> arrived`

The simulation location and perception subscription change only after the Phaser
movement completion event or nearest-safe fallback completion.

## Perception Subscriptions

Use generated location subscriptions for pub/sub.

- agents in the same room perceive room events
- agents in the same hall perceive hall events
- direct targets always receive targeted actions
- game-master/global events bypass location limits
- hall subscribers can hear room-originated public speech as muffled text
- agents outside the location do not receive local events unless told later

Muffled hallway text should remain understandable but imperfect. It is a visual
and memory cue, not a cryptographic transform.

## Renovation

The landlord can renovate:

- a selected unit
- a selected floor

Renovation deducts from the landlord's `budgetAed`, updates unit/floor quality,
changes the visual template or finish level, and affects placeholder ROI inputs
such as rent potential, satisfaction, maintenance pressure, and property value
proxy.

## Landlord Budget

The landlord has a run-scoped `budgetAed` chosen before simulation start. The
simulation engine owns this value.

Budget changes come from validated events such as:

- rent payments
- skipped rent and lost expected cashflow
- renovations
- maintenance and repair costs
- move-in and move-out costs
- deposits, fees, or incentives when included in a scenario
- game-master-adjudicated incidents that logically cost or pay the landlord

Agents and LLMs may request or describe budget-affecting actions, but they do
not mutate `budgetAed` directly.

Keep controls simple. The v1 UI should expose enough to show configurability,
not a full building editor.

## Debug Surface

Add a developer logging menu in the future Phaser slice. It can show:

- path grid cells
- current path
- door nodes
- stair links
- collision cells
- generated location ids
- movement state transitions

Keep the overlay off by default for demo recording.
