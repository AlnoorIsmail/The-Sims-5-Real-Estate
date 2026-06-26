# Stage 02: Data And State Model

Define the minimum state needed for the simulator and UI.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/product-vision.md` | Product entities and demo needs |
| Layer 3 | `../../_config/simulation-rules.md` | Consequence axes and action vocabulary |
| Layer 3 | `../../_config/roi-ml-handoff.md` | Placeholder ROI fields and future handoff |
| Layer 3 | `../../_config/memory-policy.md` | Runtime memory constraints |
| Layer 3 | `../../_config/agent-architecture.md` | Agent class responsibilities |
| Layer 3 | `../../_config/character-archetypes.md` | Sprite/persona seed rules |
| Layer 3 | `../../_config/game-master-events.md` | Event-card shape |
| Layer 4 | `../01_product_brief/output/product-brief.md` | Locked demo path |
| Layer 4 | `../../../challenge-repo/docs/datasets.md` | Synthetic data columns and caveats |

## Process

Specify plain TypeScript-friendly data shapes for:

- building configuration
- units/floors/locations
- residents and prospective residents
- landlord/player state
- agent class state for `Agent`, `CharacterAgent`, and `GameMasterAgent`
- sprite archetype, gender mapping, and persona-card seed state
- relationships and satisfaction
- events and incidents
- four-block map subscription state
- atomic action queue and busy/available state
- memory layers: immediate context, episodic memory, semantic/pinned memory,
  relationship memory, reflection memory, and working agent state
- Chroma collection names and memory record metadata
- `AgentContextBundle` inputs for one agent action
- game-master event-card state and daily summary state
- validated action proposals
- simulation tick state
- placeholder ROI inputs and output

Use names close to the domain. Avoid abstractions for features not in the demo.
V1 memory uses local Chroma with per-agent collections and one game-master
collection. Authoritative world state stays in the engine.

## Outputs

Write to `output/state-model.md`:

- entity list
- field list with types and meaning
- memory layer ownership and reason to exist
- Chroma collection and metadata field list
- `AgentContextBundle` shape
- initial demo seed data
- derived metrics
- open questions that should block implementation only if unavoidable

## Verify

- Every UI element in the product brief has a state source.
- Every action in the v1 vocabulary has enough state to validate it.
- Every memory layer has one owner and one reason to exist.
- Old events can be stored without being dumped wholesale into prompts.
- Chroma memory is isolated per agent except for game-master global memory.
- Synthetic data is labeled synthetic when referenced.
- No future ML contract is invented.
