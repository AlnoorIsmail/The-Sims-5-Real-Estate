# Agent Harness Spec: Deterministic Routing + Language Machine

## Inputs

- Agent class rules from `icm/_config/agent-architecture.md`
- Character state-machine rules from `icm/_config/character-state-machine.md`
- Memory rules from `icm/_config/memory-policy.md`
- Movement state from `../02_data_state_model/output/state-model.md`
- Engine rules from `../03_sim_engine/output/sim-engine-spec.md`

## Language-Machine Boundary

The harness is **fully deterministic**. The LLM is a language machine only:

- **Text channel**: speech (`say_to.message`), perception digests, reflections, GM brief/summary narration.
- **Tool channel**: provider-native function/tool calls with harness-built schemas.
- **Harness-owned**: all IDs, routing, memory metadata, bus messages, tool intent ids, event correlation.

The LLM must **not** emit routing JSON, invent world IDs outside tool enums, or choose event/memory identifiers.

Implementation:

- `LanguageModel.completeText(prompt)` for prose outputs.
- `LanguageModel.completeWithTools(prompt, tools)` for world actions.
- `ActionCatalog` builds tools from live engine-visible state with **enum parameters only**.
- `ToolCallRouter` maps `(toolName, args)` → `BareToolAction` with harness-generated `id`.
- `PromptAssembler` builds RAG-supported narrative prompts from `AgentContextBundle` + Chroma retrieval.
- `SimulationBus` carries typed inter-agent messages for UI (Stage 05) and engine routing.

## Process

The harness runs one autonomous graph per character. A shared scheduler coordinates
adaptive limiting, tool execution, idempotency, and bus publication. It does not
expose tile grids, waypoints, or Phaser internals to LLMs.

## Agent Roles

`CharacterAgent` selects one harness tool per turn (mapped to v1 verbs):

- `move_to(characterId | roomId | locationId | doorId, speed)`
- `say_to(characterId, message, interrupt?)`
- landlord-facing actions from the frozen v1 vocabulary
- `altercate(characterId | doorId)`
- `idle`

`GameMasterAgent` adjudicates permission, consequences, forced entry, incidents,
and metric effects. GM event-card **selection is deterministic** (seeded deck index).
GM narration uses `completeText` only.

`LandlordAgent` remains the non-autonomous UI gateway for human choices. No LLM.

## ActionCatalog And ToolCallRouter

`ActionCatalog` is built per `decide_action` from:

- visible characters
- reachable rooms
- static hall/stair/lobby/exterior endpoints
- nearby doors

Example native tools:

- `move_to_character`, `move_to_room`, `move_to_location`, `move_to_door`
- `say_to` (free-text `message` only)
- `request_repair`, `file_complaint`, `pay_rent`, `skip_rent`, `move_in`, `move_out`
- `altercate_character`, `altercate_door`
- `idle`

`ToolCallRouter` validates enum args against the catalog, then emits `BareToolAction`.
Invalid or unknown tool calls fall back to `idle` without LLM-invented IDs.

## SimulationBus Message Types

Harness assigns message ids. Stage 05 UI can subscribe without importing LLM code.

| Type | Producer | Consumer |
| --- | --- | --- |
| `speech_published` | CharacterGraph after `say_to` | target perception queue, UI bubbles |
| `tool_intent_submitted` | CharacterGraph | engine / landlord / GM routing |
| `landlord_request_queued` | harness after landlord verb | UI action cards |
| `gm_narration` | GameMasterAgent | event log, `gm_world_memory` |
| `perception_digested` | CharacterGraph after digest | memory write pipeline |
| `silence_observed` | CharacterGraph timeout | speaker perception queue |

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
produced, replay the cached tool call or text.

## Context Bundle (RAG Prompt Inputs)

`PromptAssembler` formats:

- persona and identity
- current generated location and movement summary
- visible characters, rooms, static endpoints, doors (labels for narrative; enums in tools)
- behavior drivers and goals
- Chroma-retrieved episodic memories and reflections
- recent local events
- landlord budget summary only when relevant

Do not include path grids or JSON output schemas for routing.

## Action Output

World actions use **one native tool call** per turn. `say_to.message` is the only
action-related free text from the LLM.

Digests: LLM returns numbered prose (`[1] ...`); harness maps index → `RawPerception.id`.

Reflections: LLM returns prose; harness attaches memory metadata (day, location, type).

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
- LLM decision ids (cached tool calls or text)
- tool intent ids
- engine event ids
- memory write ids
- budget/capital event ids

Chroma is not the idempotency ledger.

## Speech And Perception

`say_to` is fire-and-forget. `speech_published` on the bus gives the target
priority next-turn perception and can create a patience deadline for the
speaker. If no response arrives before the deadline, `silence_observed` is published.

While moving, agents can perceive only. Queue raw observations, then run
`perceive_digest` after arrival if the limiter allows it.

## Mock Fallback

Mock mode uses the same `ActionCatalog`, `ToolCallRouter`, and `SimulationBus`
paths. `mockSelectToolCall` picks deterministic tools without API keys.

## Perception And Memory

- Same-location events become normal perceived memories.
- Hall-overheard room speech becomes a muffled perceived memory.
- Direct-target messages are delivered even across location boundaries when the
  action itself validates.
- Global GM events remain objective world context.
- Raw plus interpreted perceptions are stored when a digest runs.

## Provider Boundary

- Per-character `LanguageModel` with own API key (Gemini default, OpenAI optional).
- Game master uses a separate `LanguageModel` instance.
- Keys stay server-side in route handlers; never in browser code.

## Code Map

| Module | Path |
| --- | --- |
| Language seam | `lib/agents/llm/language-model.ts` |
| Action catalog | `lib/agents/routing/action-catalog.ts` |
| Tool router | `lib/agents/routing/tool-call-router.ts` |
| Prompt assembler | `lib/agents/prompts/assembler.ts` |
| Simulation bus | `lib/agents/bus/simulation-bus.ts` |
| Character graph | `lib/agents/character-graph.ts` |
| Harness coordinator | `lib/agents/harness.ts` |

## Verify

- Tool intents always have harness-generated IDs before the engine sees them.
- LLM never chooses routing JSON or invents IDs outside tool enums.
- `say_to.message` is the only action-related free text from the LLM.
- Digest/reflection/GM narration are prose; harness attaches metadata.
- Mock mode runs full bus + router without API keys.
- Retried graph nodes replay cached tool calls or text, not re-parsed JSON.
- Agents never output waypoints or pixel coordinates.
- Agents emit one bare tool action at a time.
- Adaptive limiting respects API rate limits and scene importance.
- Rate-limited agents do not fabricate fallback actions.
- Fire-and-forget speech creates priority perception and in-world silence on timeout.
- Agents cannot mutate landlord `budgetAed` directly.
- Stage 05 can subscribe to `SimulationBus` without importing LLM providers.
