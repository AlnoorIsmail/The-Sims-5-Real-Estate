import TrackBadge, { type Track } from "./TrackBadge";

// ── Put your project's identity here ────────────────────────────────
const PROJECT_NAME = "Your Project Name";
const PROJECT_PITCH =
  "One sentence on what your prototype does and for whom. Edit this in components/Hero.tsx.";

const SUBMIT_URL =
  "https://github.com/abu-dhabi-ai-proptech-challenge/submissions/issues/new?template=project-submission.yml";

export default function Hero({ track }: { track: Track }) {
  return (
    <header className="pt-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sand-50/50">
        Abu Dhabi AI PropTech Challenge
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight">{PROJECT_NAME}</h1>
        <TrackBadge track={track} />
      </div>
      <p className="mt-3 max-w-2xl text-sand-50/70">{PROJECT_PITCH}</p>
      <div className="mt-6 flex gap-3">
        <a
          href="#demo"
          className="rounded-lg bg-sand-50 px-4 py-2 text-sm font-semibold text-night-900 transition hover:bg-sand-100"
        >
          Try the demo
        </a>
        <a
          href={SUBMIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-sand-50/90 transition hover:border-white/30"
        >
          Submit Project
        </a>
      </div>
    </header>
  );
}
