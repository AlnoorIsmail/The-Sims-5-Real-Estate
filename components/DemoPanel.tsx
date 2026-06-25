"use client";

import { useState } from "react";
import type { Track } from "./TrackBadge";
import { mockInference } from "@/lib/sampleData";

/**
 * The interactive heart of the template:
 * input → "Run Prototype" → AI output.
 *
 * By default it calls mockInference() from lib/sampleData.ts — a local,
 * key-free stand-in so the template works immediately. Replace the body of
 * runPrototype() with a real model call.
 */
export default function DemoPanel({ track }: { track: Track }) {
  const [input, setInput] = useState(
    "Which vacant parcels have the highest development potential?"
  );
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPrototype() {
    setLoading(true);
    setOutput(null);
    try {
      // ── CONNECT YOUR MODEL HERE ──────────────────────────────────
      // Best practice: create app/api/run/route.ts and call your provider
      // there, so API keys stay server-side. Then replace the line below with:
      //   const res = await fetch("/api/run", {
      //     method: "POST",
      //     body: JSON.stringify({ input, track }),
      //   });
      //   const { text } = await res.json();
      //
      // Inside that route handler, pick your provider:
      //
      // • OpenAI:        const client = new OpenAI();            // OPENAI_API_KEY
      // • Anthropic:     const client = new Anthropic();         // ANTHROPIC_API_KEY
      // • Hugging Face:  fetch("https://api-inference.huggingface.co/...", { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } })
      // • Local (Ollama): fetch(`${process.env.LOCAL_MODEL_URL}/api/generate`, ...)
      // • Custom API:    fetch(process.env.CUSTOM_API_URL!, ...)
      //
      // The mock below simulates latency and returns a structured answer
      // from the sample data — delete it once your model is wired up.
      const text = await mockInference(input, track);
      // ─────────────────────────────────────────────────────────────
      setOutput(text);
    } catch (err) {
      setOutput(
        `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="demo" className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight">Prototype demo</h2>
      <p className="mt-1 text-sm text-sand-50/60">
        Ask a question, hit Run. Currently powered by a local mock — connect
        your model in{" "}
        <code className="rounded bg-night-800 px-1.5 py-0.5 text-xs">
          components/DemoPanel.tsx
        </code>
        .
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-night-800/60 p-5">
        <label
          htmlFor="prototype-input"
          className="text-xs font-medium uppercase tracking-wider text-sand-50/50"
        >
          Input
        </label>
        <textarea
          id="prototype-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-night-900 p-3 text-sm outline-none transition focus:border-white/30"
        />
        <button
          onClick={runPrototype}
          disabled={loading || input.trim() === ""}
          className="mt-3 rounded-lg bg-sand-50 px-5 py-2 text-sm font-semibold text-night-900 transition hover:bg-sand-100 disabled:opacity-40"
        >
          {loading ? "Running…" : "Run Prototype"}
        </button>

        {/* AI output placeholder — style this however your demo needs */}
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sand-50/50">
            AI output
          </p>
          <div className="mt-2 min-h-[96px] whitespace-pre-wrap rounded-lg border border-dashed border-white/10 bg-night-900/60 p-4 text-sm leading-relaxed text-sand-50/90">
            {loading
              ? "Thinking…"
              : output ??
                "Output will appear here. Run the prototype to see the mock engine respond — then make it real."}
          </div>
        </div>
      </div>
    </section>
  );
}
