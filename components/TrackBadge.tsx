// The four challenge tracks. Set yours once in app/page.tsx.
export type Track = "land" | "investment" | "communities" | "decision";

const TRACKS: Record<Track, { label: string; classes: string }> = {
  land: {
    label: "Land Intelligence",
    classes: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  },
  investment: {
    label: "Investment Intelligence",
    classes: "bg-violet-400/10 text-violet-300 ring-violet-400/30",
  },
  communities: {
    label: "Future Communities",
    classes: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  },
  decision: {
    label: "Decision Intelligence",
    classes: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  },
};

export default function TrackBadge({ track }: { track: Track }) {
  const { label, classes } = TRACKS[track];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${classes}`}
    >
      {label}
    </span>
  );
}
