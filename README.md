# Abu Dhabi AI PropTech Challenge — Project Template

**Building the Intelligence Layer for Land, Investment and Communities**

A clean Next.js + TypeScript + Tailwind starter for challenge teams: a generic AI prototype dashboard with a hero, track badge, sample data display, and a demo panel wired for AI output. Replace the mock engine with your model and you have a demo.

**No paid APIs are used by default** — the "Run Prototype" button calls a local mock so the template works the moment you clone it.

**Cursor-ready:** the template ships with event rules in `.cursor/rules/event.mdc` — open it in [Cursor](https://cursor.com) and the AI already knows the event, the tracks and the data. There's a ⚡ *Best Use of Cursor* award.

## Quick start

```bash
# 1. Get the code (pick one)
#    a) Click "Use this template" on GitHub, then clone your new repo
#    b) Or clone directly:
git clone https://github.com/abu-dhabi-ai-proptech-challenge/project-template.git my-project
cd my-project

# 2. Install and run
npm install
npm run dev
```

Open <http://localhost:3000>. You should see the dashboard with sample parcel data and a working (mocked) Run Prototype flow.

## Customize it

1. **Set your track** — edit the `track` value in `app/page.tsx` (`land` | `investment` | `communities` | `decision`). The badge and accent color follow.
2. **Name your project** — title and description in `components/Hero.tsx` and `app/layout.tsx`.
3. **Bring your data** — `lib/sampleData.ts` ships with parcel rows from the starter kit. Replace with whatever your prototype consumes.
4. **Connect your AI** — `components/DemoPanel.tsx` contains `runPrototype()`, a mock engine with clearly marked hooks for:
   - OpenAI
   - Anthropic (Claude)
   - Hugging Face Inference
   - Local models (Ollama / llama.cpp)
   - Your own API
5. **Keep keys out of git** — copy `.env.example` to `.env.local` and put keys there. For real key security, move model calls into a [route handler](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) (`app/api/run/route.ts`) so keys stay server-side.

## Project structure

```
app/
  layout.tsx        Root layout + metadata
  page.tsx          The dashboard page — set your track here
  globals.css       Tailwind + base styles
components/
  Hero.tsx          Event-branded header — put your project name here
  TrackBadge.tsx    Colored badge for your chosen track
  DemoPanel.tsx     Input → "Run Prototype" → AI output. Connect your model here.
lib/
  sampleData.ts     Typed sample data + the mock inference engine
docs/
  architecture.md   How the pieces fit, and patterns for adding an API layer
  demo-script.md    A 3-minute demo script skeleton to fill in
```

## Suggested structure as you grow

```
app/api/run/route.ts    Server-side model calls (keeps keys off the client)
lib/engine.ts           Your actual scoring/matching/reasoning logic
lib/types.ts            Shared types as data outgrows sampleData.ts
components/...          One component per panel — keep page.tsx thin
```

## Example ideas per track

| Track | Ideas |
|---|---|
| 🗺️ **Land Intelligence** | Parcel scoring with explained rankings · natural-language land search · "what should be built here" recommender |
| 💼 **Investment Intelligence** | Investor–asset matching with fit scores · deal memo generator · district momentum analyzer |
| 🏙️ **Future Communities** | Service demand forecaster · resident experience explainer · community-fit matching |
| 🧭 **Decision Intelligence** | Cross-dataset Q&A copilot with sources · automated morning briefing · scenario simulator |

Sample datasets for all four live in the [starter kit](https://github.com/abu-dhabi-ai-proptech-challenge/starter-kit/tree/main/data).

## How to submit

1. Push your project to your own GitHub repo (this template's "Use this template" flow does that for you).
2. Deploy if you can (`vercel deploy` works out of the box) or record a 2–3 minute walkthrough.
3. Before the deadline, open an Issue in the [`submissions`](https://github.com/abu-dhabi-ai-proptech-challenge/submissions) repo using the **Project Submission** form.

Full guide: [submissions repo](https://github.com/abu-dhabi-ai-proptech-challenge/submissions).

## Links

- 🌐 Website: https://challenge.evoost.ai
- 💬 Discord: https://discord.gg/jy3QDxQ3jK
- 🐙 GitHub Org: https://github.com/abu-dhabi-ai-proptech-challenge
- 📦 Starter kit: https://github.com/abu-dhabi-ai-proptech-challenge/starter-kit

---

Licensed under the [MIT License](LICENSE).
