# Technical Constraints

## Runtime

- Use the existing Next.js 14, TypeScript, React, and Tailwind app.
- Keep model calls server-side in route handlers when implemented.
- Keep the provider boundary neutral: OpenAI, Anthropic, Hugging Face, local
  models, and custom APIs should remain swappable behind the harness interface.

## Demo Target

- Optimize for local run plus fallback video.
- Keep a mock or deterministic fallback so the demo path can run without API
  keys.
- Prefer one complete vertical slice over broad incomplete systems.

## Package Policy

- Do not add dependencies during documentation work.
- When implementation starts, prefer existing platform features and installed
  packages first.
- Add Phaser or LangGraph only when implementing the stage that needs them.

## Repo Boundaries

- Preserve `challenge-repo` as challenge source material.
- Preserve root `icm.md` as the ICM paper/source reference.
- Do not present synthetic challenge data as real Abu Dhabi market data.
