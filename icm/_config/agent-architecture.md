# Agent Architecture

The harness uses app-owned classes as the boundary around any LangGraph or LLM
implementation. Classes define responsibilities; the graph is an implementation
detail.

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
- visible world-state observation
- action proposal from the fixed verb set
- Phaser endpoint tools such as `move_to(locationId | characterId, speed)` and
  `say_to(agentId, message, interrupt?)`
- action vocabulary for endpoint and landlord-facing tools
- pub/sub event perception and subjective memory writes

Character tools enqueue intents or visual endpoint commands. The engine and game
master decide what becomes true.

## Landlord Agent

`LandlordAgent` extends `Agent` but is not autonomous. It represents the human
landlord/player as a UI gateway.

`LandlordAgent` owns:

- fast FIFO request queue
- priority jumps for `altercate` spillover and `skip_rent`
- compact action-card creation
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
- Rate limits are to be implemented per agent so we dont max out API keys mid demo.

## Atomic Actions

Actions are queued and resolved one at a time. If Agent A wants to talk to Agent
B while Agent B is busy with Agent C, Agent A learns that from the current state
and must wait, interrupt, or choose another action.

No agent teleports. `move_to` changes interaction/subscription only after Phaser
movement reaches the destination.

Use `move_to` as the canonical action name in prompts and schemas; Phaser may
implement it with walking or running animation internally.
