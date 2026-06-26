# Simulation Engine Spec: Location Movement

## Inputs

- State shapes from `../02_data_state_model/output/state-model.md`
- Generated-building rules from `icm/_config/building-navigation.md`
- Authority and action rules from `icm/_config/simulation-rules.md`

## Process

The deterministic engine owns truth, including landlord `budgetAed`. Phaser owns
animation. Agents propose endpoints. A* returns a path or nearest safe reachable
fallback.

## Tick Flow

1. Accept proposed action.
2. Validate actor, target type, permissions, and current movement/busy state.
3. For `move_to`, create a `PathRequest` for character, room, location, or door.
4. Resolve the request against generated locations, doors, walls, and stair
   links.
5. Queue the path for Phaser.
6. Keep the actor subscribed to the old location while moving.
7. On Phaser arrival, update current location and subscription.
8. Record the resolved event and publish it to relevant subscribers.
9. Apply validated metric and budget deltas.
10. Trigger memory writes.

## Movement Rules

- A* uses logical grid cells and 4-way movement.
- Stair traversal uses explicit `StairLink` edges.
- Furniture does not block paths.
- Walls, floor edges, closed doors, and missing stair links block paths.
- `move_to(roomId)` enters the room by default.
- If a room door is locked and the actor is not the owner, invited,
  landlord-permitted, or adjudicated through escalation, the target resolves to
  the door.
- `move_to(characterId)` resolves to the target character's nearest valid
  interaction cell.
- Character-target paths are dynamic and replan when the target changes cell,
  changes location, reaches a new room/hall, or the active path becomes stale.
- Static location, room, and door paths compute once unless the layout or door
  access state changes.
- `altercate` may target a door; forced entry is a GM-adjudicated incident.
- If an endpoint is unreachable, log `unreachable_endpoint` and move to the
  nearest safe reachable node.

## Location Publication

- Same-location subscribers perceive local public events.
- Hall subscribers can receive muffled room-originated public speech.
- Direct targets always receive targeted events.
- GM/global events bypass location subscriptions.
- Agents outside the location do not receive local events unless told later.

## Renovation Rules

- Unit renovation targets one `UnitState`.
- Floor renovation targets all units on one floor.
- Renovation deducts landlord `budgetAed` before applying quality and metric
  deltas.
- If budget is insufficient, reject or degrade the action with a logged
  consequence event.

## Budget Rules

- `budgetAed` is engine-owned authoritative state.
- `pay_rent` increases `budgetAed` after validation.
- `skip_rent` reduces expected cashflow and can create downstream cost,
  reputation, and churn effects.
- Maintenance, repairs, renovations, move-in costs, move-out costs, incentives,
  fees, and GM incidents create `CapitalEvent` records.
- Every budget change records before/after values and a source event id.
- Agents and LLMs can request or narrate budget-affecting actions, but cannot
  mutate `budgetAed` directly.

## Outputs

- movement state deltas
- location subscription changes after arrival
- event log entries for movement, unreachable targets, renovation, and muffled
  overheard speech
- budget deltas and capital events
- placeholder ROI metric updates
- memory write payloads after resolved events

## Verify

- No `move_to` updates location before Phaser reports arrival.
- A cross-floor route uses at least one stair link.
- Room movement defaults to entry, but locked/private rooms resolve to the door
  when the actor lacks permission.
- Character-target movement replans when the target moves.
- Unreachable endpoints do not teleport the actor.
- Only validated engine/GM outcomes change `budgetAed`.
- Mock proposals can drive the loop without LangGraph, Chroma, or Gemini.
