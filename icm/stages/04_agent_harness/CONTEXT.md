# Stage 04: Agent Harness

Define the provider-neutral LLM harness around the deterministic engine.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/simulation-rules.md` | Agents propose, GM adjudicates |
| Layer 3 | `../../_config/memory-policy.md` | Chroma memory and retrieval |
| Layer 3 | `../../_config/agent-architecture.md` | Agent class hierarchy |
| Layer 3 | `../../_config/character-archetypes.md` | Sprite/persona rules |
| Layer 3 | `../../_config/game-master-events.md` | GM daily events and news seam |
| Layer 3 | `../../_config/building-navigation.md` | Endpoint movement and generated location subscriptions |
| Layer 3 | `../../_config/character-state-machine.md` | Character graph states, limiter, idempotency, and speech behavior |
| Layer 3 | `../../_config/technical-constraints.md` | Next.js and provider-neutral boundary |
| Layer 3 | `../../_config/tone-safety.md` | Prompt and adjudication boundaries |
| Layer 4 | `../02_data_state_model/output/state-model.md` | State available to agents |
| Layer 4 | `../03_sim_engine/output/sim-engine-spec.md` | Engine interface and validation |

## Process

Specify a LangGraph.js-style harness without committing to a provider:

- app-owned classes are `Agent`, `CharacterAgent`, `LandlordAgent`, and
  `GameMasterAgent`
- `Agent` owns Chroma routing, Gemini embedding config, retrieval, writes, and
  context helpers
- each `CharacterAgent` is an autonomous per-character LangGraph app with
  layered state machines, Phaser endpoint tools, and subjective memory writes
- a shared scheduler coordinates all character graphs, adaptive limiting,
  idempotency, and tool execution
- `LandlordAgent` is a non-autonomous UI gateway for request queueing, action
  cards, user replies, timeouts, and forwarding outcomes to the game master
- `GameMasterAgent` owns morning brief, event-card selection, future news
  signals, global publication, adjudication, and daily summary
- resident/prospect agents receive scoped state, persona, needs, and allowed
  tools
- resident/prospect agents request endpoints only; they do not generate paths,
  waypoints, stair traversal, or pixel coordinates
- `move_to` endpoints are grouped as visible characters, rooms, static
  locations, and doors
- character-target movement is dynamic and can replan outside the agent prompt
- landlord `budgetAed` appears in context only when relevant to landlord-facing
  or budget-affecting actions
- character graph nodes are `observe`, `retrieve`, `perceive_digest`,
  `decide_action`, `call_tool`, `wait_result`, `record_memory`, and
  `maybe_reflect`
- graph output is one bare tool action at a time
- fire-and-forget `say_to` creates priority perception for the target and a
  patience deadline for the speaker
- walking agents perceive only; queued perceptions digest after arrival when
  adaptive limiting allows it
- adaptive limiting prioritizes scene importance and respects API rate limits
- idempotency uses an in-memory run ledger for graph runs, node attempts, tool
  intents, engine events, memory writes, and budget/capital events
- the runtime assembles an `AgentContextBundle` per actor using system rules,
  identity, visible world state, relationships, retrieved memories,
  reflections, recent local events, available actions, and JSON schema
- v1 retrieval queries the actor's Chroma collection using Gemini embeddings,
  then filters/ranks by metadata, recency, importance, and direct participant
  overlap
- agents output action proposals from the fixed verb set
- the fixed verb set is `move_to`, `say_to`, `request_repair`,
  `file_complaint`, `pay_rent`, `skip_rent`, `move_in`, `move_out`,
  `altercate`, and `idle`
- landlord-facing verbs create compact action cards through `LandlordAgent`
- the game master receives proposals, current state, landlord input, recent
  events, and relevant Chroma memories
- the game master adjudicates consequences and calls the deterministic engine
- generated location subscriptions determine what agents perceive and remember
- hall subscribers can receive muffled room-originated public speech
- model calls can stream story/chat events to the UI
- mock mode can bypass LLMs with deterministic proposals

Do not grant agents filesystem access. Memory access goes through Chroma tools.
The LLM proposes intent only; the engine validates and applies reality.

## Outputs

Write to `output/agent-harness-spec.md`:

- agent roles
- prompt context per role
- `LandlordAgent` queue and action-card flow
- action target map for each v1 verb
- Chroma collection naming and retrieval flow
- `AgentContextBundle` assembly rules
- tool list and schemas at a high level
- message flow
- generated location perception flow
- character state-machine flow
- adaptive limiter and idempotency flow
- speech timeout and in-world silence flow
- mock autonomy movement proposal flow
- game-master daily brief and summary flow
- mock fallback behavior
- provider boundary
- human/landlord input path
- landlord budget context and budget mutation boundary

## Verify

- Resident agents cannot mutate state directly.
- CharacterAgent graphs emit bare tool calls only.
- Retried graph nodes replay cached LLM decisions rather than duplicating side
  effects.
- `request_repair`, `file_complaint`, `pay_rent`, and `skip_rent` target
  `LandlordAgent`, not the game master directly.
- The game master remains the only adjudicator.
- Agents cannot mutate landlord `budgetAed`.
- Retrieved context includes relevant relationship/event memory without loading
  the whole event log.
- Per-agent Chroma collections preserve subjective memory isolation.
- GM/global events bypass generated location limits; local events do not.
- The harness can run with mocks for demo safety.
- Mock mode works without Chroma/Gemini running.
- A landlord action-card timeout creates a no-action event for game-master
  adjudication.
- The spec does not depend on one LLM provider.
