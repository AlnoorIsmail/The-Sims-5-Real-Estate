# Agent Architecture

The harness uses app-owned classes as the boundary around any LangGraph or LLM
implementation. Classes define responsibilities; the graph is an implementation
detail.

Character agents are autonomous per-character LangGraph applications. A shared
runtime scheduler coordinates graph execution, model-call limiting, tool
execution, and idempotency.

## Base Class

`Agent` owns:

- `id`
- `role`
- Chroma collection routing
- Gemini embedding configuration
- memory retrieval
- memory writes
- prompt context assembly helpers

The base class never mutates authoritative world state.

## Character Agent

`CharacterAgent` extends `Agent` and owns:

- sprite identity and animation keys
- persona cards and psychology modifiers
- layered state machines from `character-state-machine.md`
- visible world-state observation
- action proposal from the fixed verb set
- Phaser endpoint tools such as
  `move_to(characterId | roomId | locationId | doorId, speed)` and
  `say_to(agentId, message, interrupt?)`
- action vocabulary for endpoint and landlord-facing tools
- pub/sub event perception and subjective memory writes

Character tools enqueue intents or visual endpoint commands. The engine and game
master decide what becomes true.

`CharacterAgent` does not reason about tile paths, stair waypoints, or pixels.
It chooses a character, room, generated location, or door endpoint. The Phaser
movement system and A* pathfinder turn that endpoint into waypoints.

## Landlord Agent

`LandlordAgent` extends `Agent` but is not autonomous. It represents the human
landlord/player as a UI gateway.

`LandlordAgent` owns:

- fast FIFO request queue
- priority jumps for `altercate` spillover and `skip_rent`
- compact action-card creation
- current landlord `budgetAed` display and budget-affecting request context
- timeout handling as "no landlord action taken"
- user replies and free-text notes
- forwarding landlord responses to `GameMasterAgent`
- recording landlord-facing events for audit and memory

These character actions target `LandlordAgent` directly:

- `request_repair`
- `file_complaint`
- `pay_rent`
- `skip_rent`

`move_in` and `move_out` are landlord-mediated lifecycle actions. The landlord
is the human decision-maker; the game master adjudicates consequences.

## Game Master Agent

`GameMasterAgent` extends `Agent` and owns:

- morning brief generation
- daily world-event card selection
- future news-feed signal intake
- global event publication
- adjudication of proposed actions
- context selection for character agents
- receiving landlord/user responses from `LandlordAgent`
- daily summary writing
- objective world memory in `gm_world_memory`

The game master is not a puppet master for normal resident behavior. Characters
act independently; the game master frames the day and adjudicates consequences.

## Timing

- A sim day starts with a game-master morning brief.
- Characters act autonomously during a 45-second day window.
- Day close stops new actions, lets the active action finish, then asks the game
  master for a summary.
- The shared scheduler uses adaptive limiting and current API rate-limit signals
  so autonomous graphs do not exhaust keys mid demo.

## Atomic Actions

Actions are queued and resolved one at a time. If Agent A wants to talk to Agent
B while Agent B is busy with Agent C, Agent A learns that from the current state
and must wait, interrupt, or choose another action.

No agent teleports. `move_to` changes interaction/subscription only after Phaser
movement reaches the destination or the nearest safe reachable node.

`move_to(roomId)` defaults to entering the room; access rules may resolve the
target to the door. `move_to(characterId)` tracks a dynamic target and can
replan while the target moves.

Use `move_to` as the canonical action name in prompts and schemas; Phaser may
implement it with walking or running animation internally.

Movement states exposed to the engine are:

- `started_to_move`
- `moving`
- `arrived`
- `unreachable_endpoint`

Stair traversal is handled by explicit pathfinder links. A resident can enter
their own unit. A visitor targeting another resident's unit stops at the door
only when access is denied.

Landlord `budgetAed` is engine-owned authoritative state. Agents can propose or
route budget-affecting actions, but only validated engine/game-master outcomes
change the value.

## Character Graph Runtime

Each `CharacterAgent` graph uses these v1 nodes:

- `observe`
- `retrieve`
- `perceive_digest`
- `decide_action`
- `call_tool`
- `wait_result`
- `record_memory`
- `maybe_reflect`

The graph emits one bare tool action at a time. It does not emit freeform action
metadata, waypoints, pixel coordinates, or direct state mutations.

While Phaser movement is active, the graph can queue perceptions but cannot
issue normal new tools. After arrival, queued perceptions are digested if the
adaptive limiter allows it.

The shared scheduler uses scene importance and API rate limits to decide which
agent gets model time. If a call is denied, the agent enters `limited_wait` and
does not invent a fallback tool action.

Use an in-memory run ledger for idempotency. Retried graph nodes replay cached
LLM decisions and side effects are applied at most once.
