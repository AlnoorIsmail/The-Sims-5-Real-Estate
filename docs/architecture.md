# Architecture

How the template fits together, and the recommended path from mock to real prototype.

## Current shape (out of the box)

```
Browser
  └── app/page.tsx                 server component: layout + sample data table
        ├── components/Hero.tsx    project identity + Submit button
        └── components/DemoPanel.tsx   client component: input → Run → output
              └── lib/sampleData.ts    typed sample data + mockInference()
```

Everything runs in the browser; `mockInference()` fakes a model call with latency. Zero keys, zero network.

## Recommended shape (with a real model)

Move model calls server-side so API keys never reach the browser:

```
Browser
  └── DemoPanel.tsx ── fetch("/api/run") ──► app/api/run/route.ts
                                                ├── reads process.env.*_API_KEY
                                                ├── calls your provider
                                                └── returns { text }
```

Create `app/api/run/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { input, track } = await req.json();

  // Call your provider here — OpenAI, Anthropic, Hugging Face,
  // a local model (Ollama), or your own API. Keys come from .env.local
  // and stay on the server.
  const text = `Echo: ${input} (track: ${track})`;

  return NextResponse.json({ text });
}
```

Then in `DemoPanel.tsx`, replace the `mockInference()` call with a `fetch("/api/run", ...)` — the swap point is marked with `CONNECT YOUR MODEL HERE`.

## Where your real logic goes

| Concern | Put it in |
|---|---|
| Scoring / matching / reasoning logic | `lib/engine.ts` (new file) — keep it framework-free and testable |
| Shared types | `lib/types.ts` as data outgrows `sampleData.ts` |
| Bigger datasets | `public/data/*.csv` + parse on the server, or an API route that reads them |
| New UI panels | One component each in `components/` — keep `page.tsx` thin |

## Deploying

The template deploys to Vercel unmodified:

```bash
npm i -g vercel && vercel
```

Set environment variables in the Vercel dashboard (not in git). Other hosts (Netlify, Railway, a VM with `npm run build && npm start`) work the same way.

## Design constraints worth keeping

- **Key-free default.** Anyone cloning your repo should get a running app before any setup. Keep the mock as a fallback.
- **One obvious demo path.** The "Run Prototype" flow is what judges see — optimize that path over feature count.
- **High contrast.** The dark palette is projector-friendly; keep text ≥ `text-sm` for the demo screen.
