import TrackBadge, { type Track } from "./TrackBadge";

const PROJECT_NAME = "The Sims 5 Real Estate";
const PROJECT_PITCH =
  "Is this property worth buying? Enter the area, property type, size, and costs to see predicted value, likely upside, and the main things to check before you decide.";

export default function Hero({ track }: { track: Track }) {
  return (
    <header className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9d2c4] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#23443d] text-sm font-semibold text-white shadow-sm">
            S5
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#17201f]">
              {PROJECT_NAME}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#6c7a74]">
              Abu Dhabi property buy checker
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TrackBadge track={track} />
          <a
            href="#demo"
            className="rounded-md bg-[#23443d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b3731]"
          >
            Start check
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
            Property decision helper
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#17201f] sm:text-4xl">
            Check the numbers before you buy.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#53615b]">
            {PROJECT_PITCH}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="#demo"
            className="rounded-md border border-[#cfc6b6] bg-[#fbfaf6] px-4 py-2 text-sm font-semibold text-[#2d3834] transition hover:border-[#aab9b2]"
          >
            Check a property
          </a>
          <a
            href="#shortlist"
            className="rounded-md border border-[#cfc6b6] bg-white/70 px-4 py-2 text-sm font-semibold text-[#2d3834] transition hover:border-[#aab9b2]"
          >
            View examples
          </a>
        </div>
      </div>
    </header>
  );
}
