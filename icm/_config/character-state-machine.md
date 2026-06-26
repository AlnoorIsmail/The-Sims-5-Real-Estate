# Character State Machine

This file freezes the v1 `CharacterAgent` state-machine contract. It is a
planning document only; it does not implement LangGraph.

## Runtime Shape

Each `CharacterAgent` is an autonomous per-character LangGraph application. A
shared runtime scheduler coordinates all character graphs, model-call limiting,
tool execution, idempotency, and interaction with the deterministic engine.

The graph proposes one bare tool call at a time. The engine and game master own
truth, validation, and side effects.

## Layered State Machines

Do not model character state as one flat enum. Track these layers separately:

### Tenancy Lifecycle

- `prospect`
- `applicant`
- `approved`
- `rejected`
- `moving_in`
- `current`
- `notice_given`
- `moving_out`
- `evicted`
- `former`
- `inactive`

The engine and game master are the only authorities for lifecycle transitions.
Characters can request, threaten, apply, comply, or resist, but cannot directly
set lifecycle state.

### Rent Account

- `paid`
- `due`
- `late`
- `delinquent`
- `skipped`
- `defaulted`

Rent state is separate from lifecycle state. A current tenant can be late or
delinquent without ceasing to be a current tenant.

### Execution

- `idle`
- `observing`
- `retrieving`
- `deciding`
- `waiting_on_tool`
- `moving`
- `acting`
- `speaking`
- `digesting`
- `reflecting`
- `cooling_down`
- `limited_wait`

Execution state gates tool calls. While a Phaser `move_to` is executing, the
agent can perceive but cannot issue normal new tools.

### Social Reply

Speech is fire-and-forget. `say_to` publishes a speech event and creates an
optional pending reply expectation for the speaker.

The speaker is not blocked while waiting. If no response arrives before the
speaker's patience deadline, the silence is treated as an in-world social event.
The next LLM decision may retry, leave, escalate, internalize the silence, or do
something else based on personality and context.

### Perception And Memory

Each character keeps:

- raw perception queue
- digest queue
- pending subjective memory writes
- reflection threshold state

When walking through a generated subscription domain, the character queues raw
perceived snippets. After arrival, a digest node can interpret them if the
adaptive limiter allows a model call. If the limiter denies the call, raw
perceptions remain queued.

## Character Graph Nodes

Use these v1 nodes:

- `observe`: collect visible state, execution state, pending replies, lifecycle,
  rent status, and queued perceptions
- `retrieve`: get scoped Chroma memories and relationship context
- `perceive_digest`: interpret queued raw perceptions into subjective notes
- `decide_action`: choose one bare tool call from the fixed action vocabulary
- `call_tool`: submit the tool intent to the scheduler/engine bridge
- `wait_result`: wait for validated engine, landlord, Phaser, or GM result
- `record_memory`: write raw plus subjective memories after resolved events
- `maybe_reflect`: run reflection when thresholds are met

The graph may use LangGraph retry policies for transient failures, but retries
must be idempotent.

## Bare Tool Output

The LLM action output is tool-only:

- `verb`
- `target`
- required arguments

For `say_to`, include the message. Do not output waypoints, pixel coordinates,
internal monologue, freeform action metadata, or direct state mutations.

## Movement Guardrails

While `move_to` is executing:

- set execution state to `moving`
- suppress normal new tool calls
- queue normal observations as raw perceptions
- allow urgent interrupt handling only for safety or direct crisis cases
- after arrival or nearest-safe fallback, enter `digesting` if queued
  perceptions exist and the limiter allows it

Urgent interrupt examples:

- nearby `altercate`
- direct threat or insult
- landlord emergency
- fire, power, utility, or safety issue
- eviction, rent crisis, or direct lifecycle crisis
- target blocks the active path

## Adaptive Limiting

Use adaptive model-call limiting, not fixed per-agent caps.

Priority favors scene importance:

- landlord-facing actions
- direct speech
- altercations and safety events
- rent crises
- visible demo beats
- high ROI, reputation, occupancy, or budget impact

The scheduler should maintain a soft minimum so every active character usually
gets at least one useful decision or digest per sim day. This soft minimum never
overrides API rate limits.

If a model call is denied:

- enter `limited_wait`
- keep visible idle or occupied animation
- do not invent a silent tool action
- keep queued perceptions raw and deferred

## Idempotency

V1 uses an in-memory run ledger for idempotency. Use deterministic ids for:

- graph run ids
- node attempt ids
- LLM decision ids
- tool intent ids
- engine event ids
- memory write ids
- budget and capital event ids

If a node retries after an LLM decision already exists, replay the cached result
instead of calling the model again. Side effects must be applied at most once.

Chroma is memory storage, not the authoritative idempotency ledger.

## Numeric State Defaults

Use 0-100 integers for mutable numeric state:

- needs
- mood
- stress
- patience
- sociability
- conflict tolerance
- landlord trust
- rent pressure
- attachment to unit

The engine updates and clamps numbers. The LLM interprets them into subjective
language and memories.

## Personality Defaults

Each character has stable Big Five-derived background traits:

- extraversion
- agreeableness
- conscientiousness
- neuroticism

Traits stay stable. Beliefs, relationships, goals, mood, stress, obligations,
and reflections evolve through events and memory.

## Goal State

Each character maintains:

- `currentGoal`
- small `obligations[]`
- small `fears[]`
- small `promises[]`
- pending reply expectations

The graph carries a goal, but emits only one validated tool call at a time.

## Failed Actions

If a proposed action is rejected or resolves unexpectedly:

- record the failure as an observation for the LLM
- return to `idle` or `cooling_down`
- do not auto-retry
- do not auto-escalate

The next action must come from a later graph decision.
