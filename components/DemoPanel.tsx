import type { Track } from "./TrackBadge";

const VIDEO_SRC = "/videos/property-preview.mp4";

const TRACK_LABELS: Record<Track, string> = {
  land: "Land opportunity preview",
  investment: "Investment opportunity preview",
  communities: "Area quality preview",
  decision: "Property decision preview",
};

export default function DemoPanel({ track }: { track: Track }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] shadow-[0_18px_50px_rgba(45,38,24,0.08)] lg:shrink-0">
      <div className="px-4 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
          Visual reference
        </p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#17201f]">
              {TRACK_LABELS[track]}
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-[#64716b]">
              Keep the visual context on the right while checking the property
              numbers on the left.
            </p>
          </div>
          <span className="rounded-full border border-[#d8d1c3] bg-white px-3 py-1 text-[11px] font-semibold text-[#66736e]">
            preview
          </span>
        </div>
      </div>

      <div className="mt-4 border-y border-[#ded7c9] bg-[#ebe5d9]">
        <video
          className="h-44 w-full bg-[#e7e0d4] object-cover sm:h-52 lg:h-40"
          src={VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          controls
        >
          Your browser does not support the video preview.
        </video>
      </div>
    </section>
  );
}
