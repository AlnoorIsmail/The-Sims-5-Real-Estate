# Stage 05: Phaser UI

Define the visible simulator panel and landlord controls.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/product-vision.md` | Demo shape |
| Layer 3 | `../../_config/technical-constraints.md` | Next.js local demo constraints |
| Layer 3 | `../../_config/tone-safety.md` | Visible incident tone |
| Layer 4 | `../01_product_brief/output/product-brief.md` | Demo beats |
| Layer 4 | `../02_data_state_model/output/state-model.md` | UI state |
| Layer 4 | `../03_sim_engine/output/sim-engine-spec.md` | Events and state deltas |
| Layer 4 | `../04_agent_harness/output/agent-harness-spec.md` | Streaming events and controls |

## Process

Specify the fixed-camera game panel:

- one reusable building/background scene
- free or placeholder sprites for characters
- fixed locations such as lobby, hallway, unit, exterior, and office
- chat bubbles from `say_to`
- emotes/status labels from actions and incidents
- event log and current metrics beside the canvas
- landlord controls for scenario setup and text/action input

Keep the first UI slice readable on a projector. Prefer clarity over decoration.

## Outputs

Write to `output/phaser-ui-spec.md`:

- screen layout
- visual state mapping
- action-to-animation mapping
- chat bubble rules
- controls and empty/loading/error states
- asset policy

## Verify

- A viewer can understand who is acting and why without reading code.
- Every visible animation maps to a known action or state delta.
- The UI can run with deterministic mock events.
- Text does not hide the simulation or metrics.
