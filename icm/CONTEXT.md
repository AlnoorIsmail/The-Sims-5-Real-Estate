# ICM Routing

This workspace keeps future coding work sequential, reviewable, and easy for
Cursor or Codex to resume.

## Product Direction

Build a Decision Intelligence prototype for the Abu Dhabi AI PropTech Challenge:
a real estate life simulator where resident agents create events, a game master
adjudicates consequences, and the landlord sees reputation and ROI movement over
time.

The ICM files guide development. Runtime multi-agent behavior still belongs in
the app code.

## Stage Routing

| Task | Stage |
| --- | --- |
| Clarify demo story, user, judging angle, or scope | `stages/01_product_brief/` |
| Define building, resident, prospect, landlord, event, or ROI state | `stages/02_data_state_model/` |
| Build deterministic simulation loop, state updates, or action validation | `stages/03_sim_engine/` |
| Build LLM proposal/adjudication flow, tools, memory policy, or provider seam | `stages/04_agent_harness/` |
| Build Phaser panel, sprites, chat bubbles, event log, or landlord controls | `stages/05_phaser_ui/` |
| Prepare ROI placeholder, synthetic run summary, ML handoff, or demo audit | `stages/06_roi_demo_audit/` |

## Shared References

- `_config/product-vision.md`
- `_config/technical-constraints.md`
- `_config/simulation-rules.md`
- `_config/tone-safety.md`
- `_config/roi-ml-handoff.md`
- `_config/memory-policy.md`
- `_config/agent-architecture.md`
- `_config/character-archetypes.md`
- `_config/game-master-events.md`

Load only the references named by the active stage. Avoid monolithic context.

## Repo Defaults

- Runtime target: TypeScript in the existing Next.js app.
- Demo target: local run plus recorded video.
- Track: Decision Intelligence.
- Authority model: resident agents propose; game master adjudicates.
- ROI: transparent local placeholder until the teammate ML branch defines its
  integration contract.
- Memory: local Chroma OSS with Gemini embeddings, one collection per character
  and one game-master collection.
