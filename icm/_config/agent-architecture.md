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
- Phaser endpoint tools such as `walk_to(locationId)` and `say_to(agentId)`
- pub/sub event perception and subjective memory writes

Character tools enqueue intents or visual endpoint commands. The engine and game
master decide what becomes true.

## Game Master Agent

`GameMasterAgent` extends `Agent` and owns:

- morning brief generation
- daily world-event card selection
- future news-feed signal intake
- global event publication
- adjudication of proposed actions
- context selection for character agents
- daily summary writing
- objective world memory in `gm_world_memory`

The game master is not a puppet master for normal resident behavior. Characters
act independently; the game master frames the day and adjudicates consequences.

## Timing

- A sim day starts with a game-master morning brief.
- Characters act autonomously during a 45-second day window.
- Day close stops new actions, lets the active action finish, then asks the game
  master for a summary.

## Atomic Actions

Actions are queued and resolved one at a time. If Agent A wants to talk to Agent
B while Agent B is busy with Agent C, Agent A learns that from the current state
and must wait, interrupt, or choose another action.

No agent teleports. `walk_to` changes interaction/subscription only after Phaser
movement reaches the destination.
