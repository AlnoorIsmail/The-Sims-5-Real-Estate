# Simulation Rules

## Authority Model

Resident agents propose actions. The game master adjudicates whether each action
is allowed and what changes in the world.

Agents do not directly mutate state. The simulation engine applies validated
state deltas.

The game master creates morning briefs, global events, and adjudicated outcomes.
It does not puppet normal resident behavior.

## V1 Action Vocabulary

Use a small fixed verb set:

- `move_to`: targets a character, room, generated location, or door endpoint; includes `speed: "walk" | "run"`
- `say_to`: targets a character; may include `interrupt: true`
- `request_repair`: targets `LandlordAgent`
- `file_complaint`: targets `LandlordAgent`
- `pay_rent`: targets `LandlordAgent`
- `skip_rent`: targets `LandlordAgent`
- `move_in`: landlord-mediated lifecycle action
- `move_out`: landlord-mediated lifecycle action
- `altercate`: targets a character or door and escalates to game-master adjudication
- `idle`: explicit no-op or wait


Add new verbs only when a demo scene cannot be expressed with these.

## Landlord Gateway

The human user is the landlord. `LandlordAgent` is a non-autonomous gateway that
delivers resident requests to the UI and returns user responses to the game
master for adjudication.

These character actions target `LandlordAgent` directly:

- `request_repair`
- `file_complaint`
- `pay_rent`
- `skip_rent`

`move_in` and `move_out` are landlord-mediated: residents or prospects can
request them, but approval, vacancy, cost, and consequences are resolved through
the landlord/game-master flow.

The landlord has a run-scoped `budgetAed` chosen before simulation start. The
simulation engine owns this value. Rent payments increase it after validation;
renovations, maintenance, lifecycle costs, skipped rent, and adjudicated
incidents change it through validated state deltas.

## Landlord Request Queue

Use a fast one-at-a-time FIFO buffer so autonomous agents do not drop or
overwrite landlord requests.

Priority jumps are allowed only for:

- `altercate` spillover affecting safety, reputation, or the landlord
- `skip_rent`

Landlord action cards include:

- requester
- action type
- summary
- urgency
- suggested choices
- free-text reply
- timeout/default

If the human ignores a card, timeout resolves as "no landlord action taken"; the
game master applies consequences.

## Daily Flow

- The game master emits a morning brief before character actions start.
- Characters act autonomously during a 45-second sim-day window.
- Day close stops new actions, lets the active action finish, then asks the game
  master for a summary.

## Generated Location Pub/Sub

Use generated building locations for local perception. Agents subscribe to the
generated location where their Phaser character currently stands.

V1 location types are:

- `room`
- `hall`
- `stair`
- `lobby`
- `exterior`
- `door`

Publication rules:

- same-location agents hear and see local public actions
- hall subscribers can hear public speech from adjacent rooms as muffled text
- direct targets always receive targeted actions
- game-master/global events bypass location limits
- moving intent does not update subscription
- `move_to` updates subscription only after Phaser movement completes

Muffled text should be slightly degraded but still understandable enough to
support story and memory. It is a perception effect, not a security boundary.

## Generated Building Movement

The first Phaser slice uses a fixed-camera side-cutaway apartment grid generated
from `floors x unitsPerFloor`.

- default: 2 floors by 3 units
- UI range: 2-4 floors by 2-5 units
- one tenant per unit
- three same-size studio templates: basic, cluttered, premium
- furniture is decorative only
- walls, doors, floor edges, and stair links constrain movement

For `m` room columns, generate `m - 1` internal stair shafts. Stairs connect
floors through explicit pathfinder links. Agents request endpoints; the
pathfinder owns waypoints.

`move_to(roomId)` enters the room by default. If the room door is locked and the
actor is not the owner, invited, permitted, or adjudicated through escalation,
the target resolves to the room door.

`move_to(characterId)` follows the target character's current reachable
interaction point. A* must replan when the target changes cell or location, or
when the active path becomes stale. Arrival means reaching an interaction cell,
not occupying the same cell.

`move_to(locationId | doorId)` targets a static generated endpoint. Static paths
compute once unless layout or door access changes.

`altercate` may target a door, but forced entry requires game-master
adjudication before the room interior becomes reachable.

If an endpoint is unreachable, log an unreachable-target event and move to the
nearest safe reachable node.

## Atomic Actions

Actions resolve in order. If a target is busy, the proposing agent must wait,
interrupt through an allowed action, or choose another action.

`say_to(..., interrupt: true)` is allowed when the target is visible/reachable,
but it is socially discouraged. The interrupting agent prompt should understand
that interrupting is rude unless urgent, and interrupted agents should react
according to context, mood, and relationship memory.

## Core Consequence Axes

- resident satisfaction
- resident relationships
- landlord reputation
- occupancy and churn risk
- rent/payment reliability
- maintenance pressure
- incident severity
- landlord budget
- placeholder ROI

## Determinism

Keep the non-LLM simulation path deterministic for tests and fallback demos.
Random events should come from seeded inputs when practical.
