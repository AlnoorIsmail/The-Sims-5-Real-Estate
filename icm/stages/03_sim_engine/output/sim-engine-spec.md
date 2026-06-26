# Simulation Engine Spec: Location Movement

## Inputs

- State shapes from `../02_data_state_model/output/state-model.md`
- Generated-building rules from `icm/_config/building-navigation.md`
- Character state-machine rules from `icm/_config/character-state-machine.md`
- Authority and action rules from `icm/_config/simulation-rules.md`

## Process

The deterministic engine owns truth, including landlord `budgetAed`. Phaser owns
animation. CharacterAgent graphs propose bare tool actions. A* returns a path or
nearest safe reachable fallback.

## Tick Flow

1. Accept proposed action.
2. Validate idempotency key, actor, target type, permissions, and current
   execution/busy state.
3. For `move_to`, create a `PathRequest` for character, room, location, or door.
4. Resolve the request against generated locations, doors, walls, and stair
   links.
5. Queue the path for Phaser.
6. Keep the actor subscribed to the old location while moving.
7. On Phaser arrival, update current location and subscription.
8. Record the resolved event and publish it to relevant subscribers.
9. Apply validated metric and budget deltas.
10. Trigger memory writes.

## Character Execution Rules

- `idle`, `observing`, `retrieving`, and `deciding` can lead to one bare tool
  action.
- `waiting_on_tool`, `moving`, `acting`, `speaking`, `digesting`, `reflecting`,
  `cooling_down`, and `limited_wait` cannot issue normal new tools.
- While moving, agents can perceive only; raw perceptions queue until arrival
  and a permitted digest call.
- Urgent interrupts are limited to safety or direct crisis cases.
- Failed or rejected actions are recorded as observations, then return the agent
  to `idle` or `cooling_down`. Do not auto-retry or auto-escalate.

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

## Speech Rules

- `say_to` publishes a speech event and may create a pending reply expectation
  for the speaker.
- The target receives direct speech as priority next-turn perception.
- The speaker is not blocked while waiting.
- If the patience deadline expires without response, create an in-world silence
  observation for the speaker.

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

## Adaptive Limiter Rules

- The shared scheduler decides which CharacterAgent graph gets model time.
- Priority favors landlord-facing actions, direct speech, altercations, safety
  events, rent crises, visible demo beats, and high ROI/reputation/occupancy/
  budget impact.
- Maintain a soft minimum so active agents usually receive at least one useful
  decision or digest per sim day.
- Never exceed observed API rate limits.
- If a call is denied, put the agent in `limited_wait`, keep raw perceptions
  queued, and do not synthesize a fallback tool action.

## Idempotency Rules

- Use the in-memory run ledger for graph run ids, node attempt ids, LLM decision
  ids, tool intent ids, engine event ids, memory write ids, and budget/capital
  event ids.
- Retried graph nodes replay cached LLM decisions.
- Side effects apply at most once.

## Outputs

- movement state deltas
- character execution state deltas
- location subscription changes after arrival
- event log entries for movement, unreachable targets, renovation, and muffled
  overheard speech
- budget deltas and capital events
- adaptive limiter decisions and denied-call events
- idempotency ledger records
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
- CharacterAgent tool retries do not duplicate engine events, memory writes, or
  budget deltas.
- Rate-limited agents enter `limited_wait` without fake actions.
- Mock proposals can drive the loop without LangGraph, Chroma, or Gemini.
