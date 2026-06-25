import type { Track } from "@/components/TrackBadge";

/**
 * Typed sample data — a small slice of the starter kit's synthetic
 * sample_parcels.csv. Replace with your own data, or fetch the full CSVs:
 * https://github.com/abu-dhabi-ai-proptech-challenge/starter-kit/tree/main/data
 *
 * All values are synthetic. No real market data.
 */

export interface Parcel {
  parcelId: string;
  district: string;
  landUse: string;
  parcelSizeSqm: number;
  currentStatus: string;
  infrastructureScore: number;
  developmentPotentialScore: number;
  estimatedValueAed: number;
  recommendedUse: string;
}

export const sampleParcels: Parcel[] = [
  {
    parcelId: "PRC-0001",
    district: "Saadiyat Island",
    landUse: "mixed_use",
    parcelSizeSqm: 12500,
    currentStatus: "vacant",
    infrastructureScore: 88,
    developmentPotentialScore: 92,
    estimatedValueAed: 68_750_000,
    recommendedUse: "cultural_mixed_use",
  },
  {
    parcelId: "PRC-0003",
    district: "Yas Island",
    landUse: "hospitality",
    parcelSizeSqm: 21000,
    currentStatus: "vacant",
    infrastructureScore: 85,
    developmentPotentialScore: 89,
    estimatedValueAed: 94_500_000,
    recommendedUse: "resort_hospitality",
  },
  {
    parcelId: "PRC-0011",
    district: "Zayed City",
    landUse: "mixed_use",
    parcelSizeSqm: 28000,
    currentStatus: "reserved",
    infrastructureScore: 58,
    developmentPotentialScore: 88,
    estimatedValueAed: 42_000_000,
    recommendedUse: "transit_oriented_development",
  },
  {
    parcelId: "PRC-0014",
    district: "Saadiyat Island",
    landUse: "residential",
    parcelSizeSqm: 11000,
    currentStatus: "vacant",
    infrastructureScore: 86,
    developmentPotentialScore: 90,
    estimatedValueAed: 60_500_000,
    recommendedUse: "beachfront_residential",
  },
  {
    parcelId: "PRC-0016",
    district: "Masdar City",
    landUse: "industrial",
    parcelSizeSqm: 14500,
    currentStatus: "vacant",
    infrastructureScore: 89,
    developmentPotentialScore: 86,
    estimatedValueAed: 30_450_000,
    recommendedUse: "cleantech_manufacturing",
  },
  {
    parcelId: "PRC-0022",
    district: "Zayed City",
    landUse: "residential",
    parcelSizeSqm: 19600,
    currentStatus: "vacant",
    infrastructureScore: 57,
    developmentPotentialScore: 85,
    estimatedValueAed: 25_480_000,
    recommendedUse: "mid_rise_residential",
  },
];

const TRACK_FRAMING: Record<Track, string> = {
  land: "land development analysis",
  investment: "investment opportunity analysis",
  communities: "community impact analysis",
  decision: "cross-domain decision support",
};

/**
 * Local mock engine — a key-free stand-in for a real model so the template
 * runs out of the box. It "answers" by ranking the sample parcels.
 *
 * Delete this once you connect a real provider in components/DemoPanel.tsx.
 */
export async function mockInference(
  input: string,
  track: Track
): Promise<string> {
  // Simulated latency so the loading state is visible in demos
  await new Promise((resolve) => setTimeout(resolve, 900));

  const top = [...sampleParcels]
    .filter((p) => p.currentStatus === "vacant")
    .sort((a, b) => b.developmentPotentialScore - a.developmentPotentialScore)
    .slice(0, 3);

  const lines = top.map(
    (p, i) =>
      `${i + 1}. ${p.parcelId} — ${p.district}: potential ${p.developmentPotentialScore}/100, ` +
      `suggested ${p.recommendedUse.replace(/_/g, " ")} ` +
      `(${p.parcelSizeSqm.toLocaleString()} sqm, est. AED ${p.estimatedValueAed.toLocaleString()})`
  );

  return [
    `[mock ${TRACK_FRAMING[track]}] For: "${input}"`,
    "",
    "Top vacant parcels by development potential:",
    ...lines,
    "",
    "— This is the built-in mock engine. Connect a real model in components/DemoPanel.tsx for actual reasoning.",
  ].join("\n");
}
