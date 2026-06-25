# Memory Policy

The LLM is not the database. The engine owns truth; memory retrieval only builds
the prompt context for an agent decision.

## V1 Memory Stack

| Layer | Owner | Purpose |
| --- | --- | --- |
| Authoritative world state | simulation engine | Current truth: time, positions, units, money, rent, occupancy, reputation, ROI inputs |
| Immediate context | agent runtime | Last local events, actions, and dialogue relevant to this tick |
| Working agent state | simulation engine | Current location, visible agents, needs, mood, active goals, and constraints |
| Episodic memory | memory store | Timestamped remembered events with actors, location, tags, importance, and short text |
| Semantic/pinned memory | ICM/config or memory store | Stable facts, persona, durable preferences, and known routines |
| Relationship memory | simulation engine and memory store | Agent-to-agent trust, affection, fear, resentment, obligations, and notes |
| Reflection memory | memory store | Periodic compressed beliefs, lessons, fears, and changed goals |

V1 keeps these structures in memory for a run. Persisted files and vector search
are later upgrades.

## Agent Context Bundle

For one agent action, assemble only scoped context:

1. system rules
2. agent identity and persona
3. current world state visible to the agent
4. relevant relationships
5. retrieved episodic memories
6. relevant reflections
7. recent local events
8. available actions
9. JSON output schema

Do not dump the full event log into the prompt.

## Retrieval

V1 retrieval is deterministic and boring:

- filter by actor, target, location, tags, and current goal
- rank by recency, importance, and direct participant overlap
- include only the smallest set that explains the current decision

Embeddings and vector search can be added after the mock and deterministic paths
work.

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

Use this loop for agent behavior:

1. observe
2. retrieve
3. propose
4. validate
5. execute
6. record
7. reflect when due

The LLM proposes intent only. It cannot directly mutate money, jobs, reputation,
occupancy, rent, ownership, or ROI.

## Future Persistent Memory

If persisted character memory is added later:

- use fixed app-owned paths
- expose only whitelisted read/write tools
- store structured summaries, not raw unrestricted chat logs
- keep writes auditable and scoped to the active character
- treat in-memory state as the loaded working set and persisted files as cache
  misses or long-term memory sources

This can resemble RAG, but the purpose is scoped character continuity, not broad
document search.

## Source Patterns

- AI Dungeon: layered prompt context, auto summaries, memory bank retrieval, and context limits.
- Friends & Fables: compressed memories every few turns and selective context loading.
- Character.AI: pinned/auto/chat memories for durable persona facts.
- Inworld: realtime session state is ephemeral unless persisted externally.
- Generative Agents: memory stream, retrieval, reflection, and planning.

Hidden Door-style constraints and Voyager-style skill libraries are later-stage
inspiration, not v1 requirements.
