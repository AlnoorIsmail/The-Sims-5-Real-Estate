# Agent Context

This repo uses an ICM workspace for sequential coding context.

Start here:

1. Read `icm/CONTEXT.md`.
2. Read `icm/STATUS.md` for current implementation progress and divergences.
3. Pick the stage that matches the task.
4. Read that stage's `CONTEXT.md` and only the `_config` files it names.

Default constraints:

- Build inside the existing Next.js + TypeScript app.
- Keep the demo local-first and recordable.
- Preserve the `challenge-repo` submodule and the root `icm.md` source paper.
- Do not implement Phaser, LangGraph, or ML integration unless the task asks for
  that implementation step.
- After meaningful docs or runtime edits, update `icm/STATUS.md` before the
  final handoff.
