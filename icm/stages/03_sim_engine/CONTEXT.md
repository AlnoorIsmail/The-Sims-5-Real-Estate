# Stage 03: Simulation Engine

Design the deterministic engine before adding LLM behavior.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/simulation-rules.md` | Authority model, verbs, consequences |
| Layer 3 | `../../_config/tone-safety.md` | Consequence boundaries |
| Layer 3 | `../../_config/technical-constraints.md` | Runtime and fallback constraints |
| Layer 3 | `../../_config/memory-policy.md` | Subjective memory writes |
| Layer 3 | `../../_config/game-master-events.md` | Daily event deck and global publication |
| Layer 3 | `../../_config/building-navigation.md` | Generated locations and A* movement contract |
| Layer 3 | `../../_config/character-state-machine.md` | Execution gating, limiter, idempotency, and failure handling |
| Layer 4 | `../02_data_state_model/output/state-model.md` | State shapes |

## Process

Define the minimum deterministic loop:

- accept a current sim state
- accept proposed actions
- accept bare tool actions from CharacterAgent graphs
- validate actions against actor capability and location
- validate action target type: location, character, landlord, lifecycle, or none
- convert `move_to` endpoints into path requests
- replan character-target `move_to` paths when the target moves or the path
  becomes stale
- accept Phaser movement completion before changing location subscriptions
- queue and resolve actions atomically
- gate actions by CharacterAgent execution state
- preserve raw perception queues while agents are moving or rate-limited
- respect busy targets and ordered information transfer
- route `request_repair`, `file_complaint`, `pay_rent`, and `skip_rent` to the
  landlord request queue
- priority-notify landlord for `skip_rent` and `altercate` spillover only
- produce state deltas
- append event log entries
- record meaningful resolved events into episodic memory
- publish same-location local events and global game-master events
- publish muffled room speech to hall subscribers when applicable
- update relationship memory when actions affect trust, affection, fear,
  resentment, or obligations
- trigger reflection every 5 to 10 meaningful events per agent, or after a
  high-emotion/high-impact event
- enforce idempotency for tool intents, engine events, memory writes, and budget
  deltas
- update reputation, satisfaction, maintenance pressure, occupancy/churn risk,
  landlord `budgetAed`, and placeholder ROI inputs

Keep random events seedable. Keep the engine callable without an LLM.
Use the loop: observe -> retrieve -> propose -> validate -> execute -> record
-> reflect when due.
Use 45-second sim days: morning brief, autonomous character window, active action
finish, game-master day summary.

## Outputs

Write to `output/sim-engine-spec.md`:

- tick flow
- action validation rules
- action target routing rules
- generated location and pathfinding rules
- dynamic character-target replanning rules
- landlord request queue and timeout rules
- landlord budget delta and capital event rules
- state delta rules
- event log format
- location subscription publication rules
- atomic action queue rules
- memory recording rules
- reflection trigger rules
- deterministic fallback scenarios
- adaptive limiter and idempotency rules
- smallest checks needed when implemented

## Verify

- The engine works with resident proposals but does not require them.
- Invalid actions produce safe no-op or rejected events, not partial state.
- Failed or rejected CharacterAgent actions become observations, then return the
  agent to idle or cooling_down without auto-retry.
- The LLM never directly mutates authoritative state.
- Characters cannot mutate landlord/business state directly through landlord
  actions.
- Ignored landlord cards become timeout events meaning "no landlord action
  taken".
- Memory records describe what happened after validation, not what an agent
  merely attempted.
- `move_to` changes location subscription only after movement completes.
- Same-location subscribers write subjective memory of resolved local events.
- Hall subscribers receive muffled room-originated public speech.
- `move_to(roomId)` enters rooms by default unless access denial resolves to a
  door.
- `move_to(characterId)` replans toward the moving target's current interaction
  cell.
- Only validated engine/game-master outcomes mutate landlord `budgetAed`.
- One scripted scenario can show movement, speech, complaint, repair, and ROI
  movement.
