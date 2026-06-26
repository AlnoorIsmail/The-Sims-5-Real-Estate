// The four challenge tracks. Set yours once in app/page.tsx.
export type Track = "land" | "investment" | "communities" | "decision";

const TRACKS: Record<Track, { label: string; classes: string }> = {
  land: {
    label: "Land opportunities",
    classes: "bg-[#e7f2ed] text-[#2f6f5d] ring-[#b7d6ca]",
  },
  investment: {
    label: "For buyers & investors",
    classes: "bg-[#ebeef6] text-[#55627c] ring-[#cbd2e3]",
  },
  communities: {
    label: "Area quality",
    classes: "bg-[#fff2d8] text-[#8a651e] ring-[#e8d19f]",
  },
  decision: {
    label: "Clear recommendation",
    classes: "bg-[#e3f1f3] text-[#2f7280] ring-[#b7d5db]",
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
