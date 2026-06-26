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
    <section className="overflow-hidden rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] shadow-[0_18px_50px_rgba(45,38,24,0.08)]">
      <div className="px-5 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
          Visual reference
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#17201f]">
              {TRACK_LABELS[track]}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#64716b]">
              Keep the visual context on the right while checking the property
              numbers on the left.
            </p>
          </div>
          <span className="rounded-full border border-[#d8d1c3] bg-white px-3 py-1 text-[11px] font-semibold text-[#66736e]">
            preview
          </span>
        </div>
      </div>

      <div className="mt-5 border-y border-[#ded7c9] bg-[#ebe5d9]">
        <video
          className="aspect-video w-full bg-[#e7e0d4] object-cover"
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

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
          <p className="text-xs font-medium text-[#718078]">Use it with</p>
          <p className="mt-1 text-sm font-semibold text-[#17201f]">
            District inputs
          </p>
        </div>
        <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
          <p className="text-xs font-medium text-[#718078]">Compare against</p>
          <p className="mt-1 text-sm font-semibold text-[#17201f]">
            Predicted value
          </p>
        </div>
        <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
          <p className="text-xs font-medium text-[#718078]">Decision focus</p>
          <p className="mt-1 text-sm font-semibold text-[#17201f]">
            Buy confidence
          </p>
        </div>
      </div>
    </section>
  );
}
