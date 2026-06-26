import TrackBadge, { type Track } from "./TrackBadge";

// Project identity.
const PROJECT_NAME = "The Sims 5 Real Estate";
const PROJECT_PITCH =
  "An AI-assisted real estate investment simulator that scores Abu Dhabi districts and parcels using market, land, community, and amenity signals.";

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
