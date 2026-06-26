# Agent Harness Spec: Endpoint Movement

## Inputs

- Agent class rules from `icm/_config/agent-architecture.md`
- Memory rules from `icm/_config/memory-policy.md`
- Movement state from `../02_data_state_model/output/state-model.md`
- Engine rules from `../03_sim_engine/output/sim-engine-spec.md`

## Process

The harness gives agents scoped state and endpoint tools. It does not expose
tile grids, waypoints, or Phaser internals to LLMs.

## Agent Roles

`CharacterAgent` can propose:

- `move_to(characterId | roomId | locationId | doorId, speed)`
- `say_to(agentId, message, interrupt?)`
- landlord-facing actions from the frozen v1 vocabulary
- `altercate(characterId | doorId)`
- `idle`

`GameMasterAgent` adjudicates permission, consequences, forced entry, incidents,
and metric effects.

`LandlordAgent` remains the non-autonomous UI gateway for human choices.

## Context Bundle Additions

For movement decisions, include:

- current generated location
- visible same-location agents
- visible character targets
- reachable room targets
- static hall, stair, lobby, exterior, and door endpoints
- owned unit id
- nearby doors and hall/stair endpoints
- current movement state
- whether the actor is allowed to enter the target room
- landlord budget summary only when relevant to landlord-facing requests

Do not include the full path grid in prompts.

## Mock Autonomy

Before LangGraph exists, deterministic mock agents should periodically choose
valid endpoint commands using the same `move_to` proposal shape. Mock mode must
exercise character-follow and room-entry movement, including at least one
locked-room door fallback. This proves the movement bridge and keeps the demo
runnable without API keys.

## Perception And Memory

- Same-location events become normal perceived memories.
- Hall-overheard room speech becomes a muffled perceived memory.
- Direct-target messages are delivered even across location boundaries when the
  action itself validates.
- Global GM events remain objective world context.

## Outputs

- action proposal schemas
- endpoint candidate lists separated into visible characters, reachable rooms,
  and static generated endpoints
- movement proposal events
- memory-write payloads keyed by `locationId` and `locationType`
- mock-autonomy proposal flow

## Verify

- Agents never output waypoints or pixel coordinates.
- A normal `move_to(roomId)` enters the room only when access allows it.
- A denied room target resolves to the door without requiring the agent to know
  the lock mechanics.
- A `move_to(characterId)` request can replan while the target moves.
- Agents cannot mutate landlord `budgetAed`; they can only propose actions that
  the engine/GM may validate into budget deltas.
- Door `altercate` is visible as escalation, not normal navigation.
- Mock mode can exercise movement without LangGraph, Chroma, Gemini, or LLM API
  keys.
