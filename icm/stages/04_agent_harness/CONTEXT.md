# Stage 04: Agent Harness

Define the provider-neutral LLM harness around the deterministic engine.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/simulation-rules.md` | Agents propose, GM adjudicates |
| Layer 3 | `../../_config/memory-policy.md` | In-memory v1 and future file memory |
| Layer 3 | `../../_config/technical-constraints.md` | Next.js and provider-neutral boundary |
| Layer 3 | `../../_config/tone-safety.md` | Prompt and adjudication boundaries |
| Layer 4 | `../02_data_state_model/output/state-model.md` | State available to agents |
| Layer 4 | `../03_sim_engine/output/sim-engine-spec.md` | Engine interface and validation |

## Process

Specify a LangGraph.js-style harness without committing to a provider:

- resident/prospect agents receive scoped state, persona, needs, and allowed
  tools
- the runtime assembles an `AgentContextBundle` per actor using system rules,
  identity, visible world state, relationships, retrieved memories,
  reflections, recent local events, available actions, and JSON schema
- v1 retrieval filters/ranks by actor, target, location, recency, tags, and
  importance; embeddings are later
- agents output action proposals from the fixed verb set
- the game master receives proposals, current state, landlord input, and recent
  events
- the game master adjudicates consequences and calls the deterministic engine
- model calls can stream story/chat events to the UI
- mock mode can bypass LLMs with deterministic proposals

Do not grant agents filesystem access. Future memory tools must be whitelisted.
The LLM proposes intent only; the engine validates and applies reality.

## Outputs

Write to `output/agent-harness-spec.md`:

- agent roles
- prompt context per role
- `AgentContextBundle` assembly rules
- deterministic retrieval rules
- tool list and schemas at a high level
- message flow
- mock fallback behavior
- provider boundary
- human/landlord input path

## Verify

- Resident agents cannot mutate state directly.
- The game master remains the only adjudicator.
- Retrieved context includes relevant relationship/event memory without loading
  the whole event log.
- The harness can run with mocks for demo safety.
- Mock mode works without embeddings or API keys.
- The spec does not depend on one LLM provider.
