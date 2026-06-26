# Phaser UI Spec: Generated Apartment Cutaway

## Inputs

- Generated building rules from `icm/_config/building-navigation.md`
- State shapes from `../02_data_state_model/output/state-model.md`
- Movement rules from `../03_sim_engine/output/sim-engine-spec.md`
- Endpoint proposal rules from `../04_agent_harness/output/agent-harness-spec.md`

## Process

Build the future UI as a fixed-camera side-cutaway game panel. The first pass is
still allowed to be deterministic mock mode; no LangGraph or LLM calls are
required.

## Screen Layout

- Phaser canvas: generated building, agents, chat bubbles, movement, and
  optional debug overlay.
- Side panel: day/time, landlord `budgetAed`, recent capital events,
  satisfaction, reputation, occupancy, maintenance pressure, and placeholder
  ROI.
- Controls: floors, units per floor, seed, selected floor, selected unit,
  starting budget, renovate floor, renovate unit, dev logging menu.
- Event log: movement, speech, renovation, complaints, payments, unreachable
  endpoints, and GM/global events.

## Building Rendering

- Default: 2 floors by 3 units.
- UI range: 2-4 floors by 2-5 units.
- Whole generated building fits the canvas; do not pan or scroll camera.
- Use the interior tile pack for walls, wallpaper, doors, platforms, stairs,
  and decorative furniture.
- Three studio variants: basic, cluttered, premium.
- Furniture is decorative and has no collision.
- Edge connectors render as walls.
- Stair shafts appear between room columns.

## Movement Rendering

- `move_to` starts walking/running animation.
- Phaser follows A* waypoints generated from logical cells.
- Movement emits `started_to_move`, `moving`, and `arrived`.
- Arrival updates location/subscription in the engine.
- `move_to(characterId)` visibly follows the target's current reachable
  interaction point and replans when the target moves.
- `move_to(roomId)` enters the room unless access rules resolve the actor to
  the door.
- Unreachable targets move to nearest safe reachable node and log the failure.
- Cross-floor movement visibly uses stairs.

## Chat And Perception

- `say_to` renders a chat bubble near the speaker.
- Hallway overhearing of room speech renders as muffled text.
- Same-location speech is clear.
- Text should not cover critical movement or metrics.

## Renovation Controls

- Floor renovation upgrades all units on a selected floor.
- Unit renovation upgrades one selected unit.
- Both deduct landlord `budgetAed` and update visual quality plus placeholder ROI
  inputs.
- Starting budget is configured before each run.
- The metrics panel shows current budget and recent capital events.
- Keep controls simple; no drag-and-drop editor in v1.

## Dev Logging Menu

Off by default. When enabled, show:

- path grid
- current path
- dynamic target and replan events
- door nodes
- stair links
- blocked cells
- generated location ids
- movement transition log

## Outputs

- generated building render policy
- landlord setup and renovation controls
- action-to-animation mapping
- character-follow and room-entry movement behavior
- chat bubble and muffled speech rules
- landlord budget and capital-event display behavior
- dev logging menu behavior
- deterministic test hook requirements

## Test Hooks

Future implementation should expose:

- `window.render_game_to_text()`
- `window.advanceTime(ms)`

The text state should include building dimensions, selected unit/floor, agent
locations, movement status, current paths, dynamic target state, budgetAed,
recent capital events, and recent events.

## Verify

- 2x3 shows six units clearly.
- 4x5 still fits the fixed canvas.
- Agents move between floors through stair shafts.
- Character-target movement replans if the target moves.
- Room-target movement enters rooms by default and stops at locked/private doors
  when access is denied.
- Renovation changes visuals, budget, and placeholder metrics.
- The demo can run with deterministic mock autonomy only.
