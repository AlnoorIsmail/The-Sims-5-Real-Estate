# Agent Harness Spec: Endpoint Movement

## Inputs

- Agent class rules from `icm/_config/agent-architecture.md`
- Character state-machine rules from `icm/_config/character-state-machine.md`
- Memory rules from `icm/_config/memory-policy.md`
- Movement state from `../02_data_state_model/output/state-model.md`
- Engine rules from `../03_sim_engine/output/sim-engine-spec.md`

## Process

The harness runs one autonomous LangGraph app per character. A shared scheduler
gives graphs scoped state and endpoint tools, then coordinates adaptive limiting,
tool execution, and idempotency. It does not expose tile grids, waypoints, or
Phaser internals to LLMs.

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

## Character State Machines

Track these layers separately:

- lifecycle: prospect, applicant, approved, rejected, moving_in, current,
  notice_given, moving_out, evicted, former, inactive
- rent account: paid, due, late, delinquent, skipped, defaulted
- execution: idle, observing, retrieving, deciding, waiting_on_tool, moving,
  acting, speaking, digesting, reflecting, cooling_down, limited_wait
- social reply: pending reply deadlines that do not block normal autonomy
- perception/memory: raw queue, digest queue, subjective writes, reflection
  thresholds

The engine and game master own lifecycle, rent account, budget, movement
resolution, and side effects.

## Graph Nodes

Use these LangGraph-style nodes:

- `observe`
- `retrieve`
- `perceive_digest`
- `decide_action`
- `call_tool`
- `wait_result`
- `record_memory`
- `maybe_reflect`

Retries must be idempotent. If a node retries after an LLM decision was already
produced, replay the cached result.

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

## Action Output

The LLM emits one bare tool action:

- verb
- target type and id
- required args

For `say_to`, args include the message. Do not include freeform action metadata,
internal monologue, direct state mutations, waypoints, or pixel coordinates.

## Adaptive Limiting

The scheduler uses adaptive limiting instead of fixed per-agent caps.

Prioritize:

- landlord-facing actions
- direct speech
- altercations and safety events
- rent crises
- visible demo beats
- high ROI, reputation, occupancy, or budget impact

Maintain a soft minimum so every active character usually gets one useful
decision or digest per sim day. Never exceed current API rate limits.

If denied, the agent enters `limited_wait`; queued perceptions remain raw and no
fake tool action is generated.

## Idempotency

Use an in-memory run ledger for:

- graph run ids
- node attempt ids
- LLM decision ids
- tool intent ids
- engine event ids
- memory write ids
- budget/capital event ids

Chroma is not the idempotency ledger.

## Speech And Perception

`say_to` is fire-and-forget. It publishes a speech event, gives the target
priority next-turn perception, and can create a patience deadline for the
speaker. If no response arrives before the deadline, create an in-world silence
observation.

While moving, agents can perceive only. Queue raw observations, then run
`perceive_digest` after arrival if the limiter allows it.

## Mock Fallback

When the model or graph runtime is disabled, deterministic mock fallback should
choose valid endpoint commands using the same bare tool shape. Mock mode must
exercise character-follow and room-entry movement, including at least one
locked-room door fallback.

## Perception And Memory

- Same-location events become normal perceived memories.
- Hall-overheard room speech becomes a muffled perceived memory.
- Direct-target messages are delivered even across location boundaries when the
  action itself validates.
- Global GM events remain objective world context.
- Raw plus interpreted perceptions are stored when a digest runs.

## Outputs

- action proposal schemas
- character state-machine layers and graph node flow
- endpoint candidate lists separated into visible characters, reachable rooms,
  and static generated endpoints
- adaptive limiter and idempotency ledger flow
- fire-and-forget speech and patience timeout flow
- movement proposal events
- memory-write payloads keyed by `locationId` and `locationType`
- mock-autonomy proposal flow

## Verify

- Agents never output waypoints or pixel coordinates.
- Agents emit one bare tool action at a time.
- Adaptive limiting respects API rate limits and scene importance.
- Rate-limited agents do not fabricate fallback actions.
- Retried graph nodes do not duplicate tool calls, engine events, memory writes,
  or budget deltas.
- Fire-and-forget speech creates priority perception and in-world silence on
  timeout.
- A normal `move_to(roomId)` enters the room only when access allows it.
- A denied room target resolves to the door without requiring the agent to know
  the lock mechanics.
- A `move_to(characterId)` request can replan while the target moves.
- Agents cannot mutate landlord `budgetAed`; they can only propose actions that
  the engine/GM may validate into budget deltas.
- Door `altercate` is visible as escalation, not normal navigation.
- Mock mode can exercise movement without LangGraph, Chroma, Gemini, or LLM API
  keys.
