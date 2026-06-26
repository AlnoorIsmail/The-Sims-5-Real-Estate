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
- The app shell is still the starter page: `app/page.tsx` uses `TRACK = "land"`
  and renders `Hero + DemoPanel`.
- No Phaser panel, generated building renderer, A* visual movement,
  `window.render_game_to_text`, or `window.advanceTime` was found in the current
  scan.

## Stage Progress

| Area | Status | Notes |
| --- | --- | --- |
| ICM routing and awareness | Spec complete | `icm/CONTEXT.md`, `.cursor/rules/icm.mdc`, and `AGENTS.md` route agents into ICM. |
| Package setup | Partial runtime | Phaser, Chroma, Gemini, OpenAI, and Gemini provider packages are present. Chroma/Gemini runtime behavior still needs verification. |
| Stage 01 product brief | Spec complete | Product direction is captured in shared config; no locked output brief yet. |
| Stage 02 data/state model | Partial runtime | Spec is complete; runtime partial exists in `lib/sim/types.ts`. |
| Stage 03 simulation engine | Partial runtime | Spec is complete; runtime is currently a stub engine in `lib/sim/engine-interface.ts`, not the full deterministic simulator. |
| Stage 04 agent harness | Partial runtime | Spec is complete; runtime partial exists under `lib/agents/` with agent classes, scheduler, idempotency, prompt assembly, tool routing, mock fallback, and provider seams. |
| Stage 05 Phaser UI | Not started | Spec is complete; no Phaser UI/runtime panel found. |
| Stage 06 ROI demo audit | Not started | Stage contract exists; audit output is not written. |
| App shell | Divergent | Root app still presents the starter land-track demo, not the decision simulator. |

## Current Divergences From ICM Specs

### Harmless Partial Implementation

- `lib/sim/types.ts` mirrors much of the stage 02 state model, but the engine is
  not complete.
- `lib/agents/` contains useful harness pieces, but this needs integration with
  a real deterministic world and UI before it can demonstrate the product loop.
- Memory abstractions exist, but Chroma persistence/retrieval behavior needs a
  dedicated verification pass.

### Real Mismatches

- ICM says CharacterAgent is an autonomous per-character LangGraph app; current
  runtime appears to use a custom LangGraph-style node runner, not actual
  `@langchain/langgraph`.
- ICM says the app should be Decision Intelligence; `app/page.tsx` still sets
  `TRACK = "land"`.
- ICM says movement completion drives location/subscription changes; current
  runtime has no Phaser movement/A* implementation to enforce that.
- ICM says landlord budget changes come from validated engine outcomes; current
  runtime budget side effects need verification beyond the stub engine.

## Next Recommended Implementation Slice

Build Stage 03 and Stage 05 together:

- generated building state
- deterministic movement validation
- A* pathfinding
- minimal Phaser panel
- movement completion events
- `window.render_game_to_text`
- `window.advanceTime`

This gives the partial agent harness a real world to act in instead of only
stubbed engine events.

## Verification Needed

- Run TypeScript/build checks after current runtime changes settle.
- Verify whether the custom graph runner should remain or be replaced with
  actual LangGraph.js.
- Verify Chroma/Gemini memory writes and retrieval against the metadata policy.
- Verify package changes in `package.json` and `.env.example` against current
  provider setup.
- Verify app shell switch from starter `land` demo to the decision simulator.

## Recent Notes

- 2026-06-26: Added status tracking after ICM specs expanded to generated
  building movement, landlord budget, character state machines, adaptive
  limiting, and idempotency.
