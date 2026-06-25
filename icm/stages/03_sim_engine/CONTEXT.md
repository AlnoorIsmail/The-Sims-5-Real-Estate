# Stage 03: Simulation Engine

Design the deterministic engine before adding LLM behavior.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/simulation-rules.md` | Authority model, verbs, consequences |
| Layer 3 | `../../_config/tone-safety.md` | Consequence boundaries |
| Layer 3 | `../../_config/technical-constraints.md` | Runtime and fallback constraints |
| Layer 4 | `../02_data_state_model/output/state-model.md` | State shapes |

## Process

Define the minimum deterministic loop:

- accept a current sim state
- accept proposed actions
- validate actions against actor capability and location
- produce state deltas
- append event log entries
- record meaningful resolved events into episodic memory
- update relationship memory when actions affect trust, affection, fear,
  resentment, or obligations
- trigger reflection every 5 to 10 meaningful events per agent, or after a
  high-emotion/high-impact event
- update reputation, satisfaction, maintenance pressure, occupancy/churn risk,
  and placeholder ROI inputs

Keep random events seedable. Keep the engine callable without an LLM.
Use the loop: observe -> retrieve -> propose -> validate -> execute -> record
-> reflect when due.

## Outputs

Write to `output/sim-engine-spec.md`:

- tick flow
- action validation rules
- state delta rules
- event log format
- memory recording rules
- reflection trigger rules
- deterministic fallback scenarios
- smallest checks needed when implemented

## Verify

- The engine works with resident proposals but does not require them.
- Invalid actions produce safe no-op or rejected events, not partial state.
- The LLM never directly mutates authoritative state.
- Memory records describe what happened after validation, not what an agent
  merely attempted.
- One scripted scenario can show movement, speech, complaint, repair, and ROI
  movement.
