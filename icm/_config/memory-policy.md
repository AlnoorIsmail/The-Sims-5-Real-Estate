# Memory Policy

The LLM is not the database. The engine owns truth; Chroma memory retrieval only
builds prompt context for agent decisions.

## Chroma Setup

- Run local Chroma OSS with `npm run chroma`.
- Connect from server-side app code with `chromadb`.
- Use `@chroma-core/google-gemini` and `GEMINI_API_KEY`.
- Default embedding model: `gemini-embedding-001`.
- Do not expose Chroma or Gemini keys to browser code.

## Collections

Use isolated collections:

- one collection per character: `agent_{agentId}_memory`
- one game-master collection: `gm_world_memory`

Each character owns its own perceived memories. The game master owns objective
world events, daily summaries, event-card history, and adjudication notes.

## Memory Record Shape

Store document text plus metadata:

- `memoryType`: episodic, semantic, relationship, reflection, news, summary
- `day`
- `block`
- `location`
- `participants`
- `tags`
- `importance`
- `sourceEventId`
- `timestamp`

Use metadata filters before or alongside vector search. Do not retrieve the
whole event log.

## V1 Memory Stack

| Layer | Owner | Purpose |
| --- | --- | --- |
| Authoritative world state | simulation engine | Current truth: time, positions, units, money, rent, occupancy, reputation, ROI inputs |
| Immediate context | agent runtime | Last local events, actions, and dialogue relevant to this tick |
| Working agent state | simulation engine | Current location, visible agents, needs, mood, active goals, and constraints |
| Episodic memory | per-agent Chroma collection | Timestamped events as that agent perceived them |
| Semantic/pinned memory | per-agent Chroma collection and ICM config | Stable facts, persona, durable preferences, and known routines |
| Relationship memory | engine plus per-agent Chroma notes | Agent-to-agent trust, affection, fear, resentment, obligations, and subjective notes |
| Reflection memory | per-agent Chroma collection | Periodic compressed beliefs, lessons, fears, and changed goals |
| World memory | `gm_world_memory` | Objective daily briefs, global events, news-card outcomes, and summaries |

## Subjective Writes

When an event resolves:

- direct participants write subjective memories
- agents in the same map block write perceived memories
- global game-master events write to all relevant agents and `gm_world_memory`
- agents outside the block do not learn local events unless later told

Memory is written after validation and resolution, not when an agent merely
intends an action.

## Agent Context Bundle

For one agent action, assemble only scoped context:

1. system rules
2. agent identity and persona
3. current world state visible to the agent
4. relevant relationships
5. Chroma-retrieved episodic memories
6. relevant reflections
7. recent local events
8. available actions
9. JSON output schema

## Retrieval

Query the actor collection with a short text query built from current state,
goal, target, location, and recent events.

Prefer metadata filters for:

- actor or participant
- block
- location
- day range
- memory type
- tags

Rank final prompt candidates by semantic match, recency, importance, and direct
participant overlap.

## Reflection

Run reflection every 5 to 10 meaningful events per agent, or immediately after a
high-emotion or high-impact event.

Reflection should extract:

- facts that changed
- emotional consequences
- relationship changes
- new goals, fears, or obligations
- contradictions with older memories

## Runtime Loop

Use this loop for character behavior:

1. observe
2. retrieve
3. propose
4. validate
5. execute
6. record
7. reflect when due

The LLM proposes intent only. It cannot directly mutate money, jobs, reputation,
occupancy, rent, ownership, or ROI.

## Source Docs

- Chroma TypeScript setup: https://docs.trychroma.com/docs/overview/getting-started
- Chroma local server: https://docs.trychroma.com/docs/run-chroma/client-server
- Gemini embeddings: https://docs.trychroma.com/integrations/embedding-models/google-gemini
- Metadata filtering: https://docs.trychroma.com/docs/querying-collections/metadata-filtering
