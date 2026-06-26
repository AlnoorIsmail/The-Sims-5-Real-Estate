# Stage 05: Phaser UI

Define the visible simulator panel and landlord controls.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/product-vision.md` | Demo shape |
| Layer 3 | `../../_config/technical-constraints.md` | Next.js local demo constraints |
| Layer 3 | `../../_config/tone-safety.md` | Visible incident tone |
| Layer 3 | `../../_config/character-archetypes.md` | Sprite mappings and Skelly rules |
| Layer 3 | `../../_config/building-navigation.md` | Generated building, A*, and renovation UI |
| Layer 4 | `../01_product_brief/output/product-brief.md` | Demo beats |
| Layer 4 | `../02_data_state_model/output/state-model.md` | UI state |
| Layer 4 | `../03_sim_engine/output/sim-engine-spec.md` | Events and state deltas |
| Layer 4 | `../04_agent_harness/output/agent-harness-spec.md` | Streaming events and controls |

## Process

Specify the fixed-camera game panel:

- one generated side-cutaway building scene
- default 2 floors by 3 units, configurable to 2-4 floors by 2-5 units
- available sprites from `character-archetypes.md`
- generated locations such as lobby, hall, stair, door, unit room, and exterior
- room/hall/stair/lobby subscriptions for hearing/seeing
- A* endpoint movement over logical grid cells and explicit stair links
- live replanning for `move_to(characterId)` targets
- room-entry default for `move_to(roomId)`, with locked-room door fallback
- chat bubbles from `say_to`
- emotes/status labels from actions and incidents
- event log and current metrics beside the canvas
- landlord controls for scenario setup, building size, seed, selected floor/unit,
  starting budget, renovation, current budget, and text/action input
- a developer logging menu that can toggle grid, current path, node ids, door
  nodes, stair links, collision cells, and movement logs
- landlord action cards for repair, complaint, rent payment, skipped rent, and
  mediated move-in/out decisions

Keep the first UI slice readable on a projector. Prefer clarity over decoration.

## Outputs

Write to `output/phaser-ui-spec.md`:

- screen layout
- generated building layout policy
- A* path visualization and debug policy
- visual state mapping
- action-to-animation mapping
- chat bubble rules
- controls and empty/loading/error states
- landlord action-card layout, choices, free-text reply, timeout/default state
- asset policy
- generated location/subscription visualization policy
- renovation controls and metric feedback
- starting budget, current budget, and capital event display

## Verify

- A viewer can understand who is acting and why without reading code.
- Every visible animation maps to a known action or state delta.
- `move_to` visually completes before interaction location changes.
- Character-target movement can update its path while the target moves.
- Room-target movement enters rooms unless access rules resolve to the door.
- A generated 4x5 building still fits the fixed camera.
- Room-target movement enters by default and stops at locked/private doors only
  when access is denied.
- Landlord action cards are compact enough for the demo viewport.
- The UI can run with deterministic mock events.
- Text does not hide the simulation or metrics.
