# Technical Constraints

## Runtime

- Use the existing Next.js 14, TypeScript, React, and Tailwind app.
- Keep model calls server-side in route handlers when implemented.
- Keep the provider boundary neutral: OpenAI, Anthropic, Hugging Face, local
  models, and custom APIs should remain swappable behind the harness interface.
- Run Chroma locally for v1 memory with `npm run chroma`.
- Use Gemini embeddings for Chroma memory by default:
  `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`.

## Demo Target

- Optimize for local to make an impressive recorded video of it
- Keep a mock or deterministic fallback so the demo path can run without API
  keys.
- Prefer one complete vertical slice over broad incomplete systems.

## Package Policy

- When implementation starts, prefer existing platform features and installed
  packages first.
- Phaser and Chroma are installed for the simulator and memory layers.
- Add LangGraph only when implementing the stage that needs it.

## Repo Boundaries

- Preserve `challenge-repo` as challenge source material.
- Preserve root `icm.md` as the ICM paper/source reference.
- Do not present synthetic challenge data as real Abu Dhabi market data.
