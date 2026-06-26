# ICM Status

Last updated: 2026-06-26

## How To Maintain This File

Update this file after meaningful ICM or runtime edits. Keep it brief and
honest:

- mark what is specified only
- mark what has partial runtime code
- mark what is missing
- mark real divergences from the agreed ICM specs
- do not claim unverified behavior

Use these labels:

- `Spec complete`
- `Partial runtime`
- `Not started`
- `Divergent`
- `Needs verification`

## Current Implementation Snapshot

- ICM workspace is mostly complete: routing, stage specs, shared references,
  Cursor rules, and Codex awareness exist.
- Package setup includes Phaser, Chroma, Gemini embeddings, OpenAI, and Gemini
  provider packages.
- Runtime state and agent harness work is partially present under `lib/sim/`
  and `lib/agents/`.
- The app shell now mounts the decision simulator PoC through
  `components/DecisionSimulatorShell.tsx`.
- Stage 05 has a hardcoded Phaser cutaway shell with generated rooms, halls,
  stairs, deterministic movement, landlord controls, metrics, event log,
  `window.render_game_to_text`, and `window.advanceTime`.
- Character visuals intentionally use colored markers/initials for submission
  reliability; ICM-approved sprite asset animation is deferred.

## Stage Progress

| Area | Status | Notes |
| --- | --- | --- |
| ICM routing and awareness | Spec complete | `icm/CONTEXT.md`, `.cursor/rules/icm.mdc`, and `AGENTS.md` route agents into ICM. |
| Package setup | Partial runtime | Phaser, Chroma, Gemini, OpenAI, and Gemini provider packages are present. Chroma/Gemini runtime behavior still needs verification. |
| Stage 01 product brief | Spec complete | Locked output brief exists under `icm/stages/01_product_brief/output/`. |
| Stage 02 data/state model | Partial runtime | Spec is complete; runtime partial exists in `lib/sim/types.ts` with generated building, movement, landlord budget, queue, metrics, and mock scenario state. |
| Stage 03 simulation engine | Partial runtime | Deterministic substrate exists in `lib/sim/engine-interface.ts`; full harness/UI integration still needs verification. |
| Stage 04 agent harness | Partial runtime | Spec is complete; runtime partial exists under `lib/agents/` with agent classes, scheduler, idempotency, prompt assembly, tool routing, mock fallback, and provider seams. |
| Stage 05 Phaser UI | Partial runtime | Hardcoded Phaser PoC renders a fixed-camera generated cutaway with deterministic movement, controls, metrics, and browser hooks. |
| Stage 06 ROI demo audit | Spec complete | Audit output exists with placeholder ROI, ML handoff, fallback, checklist, and limitations. |
| App shell | Partial runtime | Root app mounts the decision simulator shell instead of the starter land-track demo. |

## Current Divergences From ICM Specs

### Harmless Partial Implementation

- `lib/sim/types.ts` and `lib/sim/engine-interface.ts` provide a deterministic
  simulation foundation, but full UI/harness integration still needs
  verification.
- `lib/agents/` contains useful harness pieces, but this needs integration with
  a real deterministic world and UI before it can demonstrate the product loop.
- `components/DecisionSimulatorShell.tsx` gives a submission-ready Phaser PoC,
  but it is currently hardcoded and uses colored markers instead of sprite
  animation.
- Memory abstractions exist, but Chroma persistence/retrieval behavior needs a
  dedicated verification pass.

### Real Mismatches

- ICM says CharacterAgent is an autonomous per-character LangGraph app; current
  runtime appears to use a custom LangGraph-style node runner, not actual
  `@langchain/langgraph`.
- ICM says production character visuals should use the approved sprite assets;
  the current PoC defers sprite animation and uses colored character markers for
  reliability.
- ICM says landlord budget changes come from validated engine outcomes; the PoC
  UI has local deterministic budget controls and still needs deeper engine
  wiring verification.

## Next Recommended Implementation Slice

Harden the submission PoC:

- browser smoke check the Phaser shell
- verify `render_game_to_text` and `advanceTime`
- tune the fixed-camera layout for projector readability
- optionally reintroduce sprite assets after the PoC path is stable
- integrate or defer the real LangGraph patch intentionally

## Verification Needed

- Run/record browser checks against the Phaser PoC.
- Verify whether the custom graph runner should remain or be replaced with
  actual LangGraph.js.
- Verify Chroma/Gemini memory writes and retrieval against the metadata policy.
- Verify package changes in `package.json` and `.env.example` against current
  provider setup.
- Verify Stage 05 controls and hooks across default 2x3 and max 4x5 layouts.

## Recent Notes

- 2026-06-26: Mounted a hardcoded Phaser decision-simulator PoC, switched the
  root app away from the starter land page, and deferred sprite animation in
  favor of stable colored character markers.
- 2026-06-26: Locked Stage 01 and Stage 06 foundation outputs and updated the
  demo script.
- 2026-06-26: Added status tracking after ICM specs expanded to generated
  building movement, landlord budget, character state machines, adaptive
  limiting, and idempotency.
