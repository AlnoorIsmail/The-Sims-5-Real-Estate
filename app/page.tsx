import Hero from "@/components/Hero";
import DemoPanel from "@/components/DemoPanel";
import RoiPredictionPanel from "@/components/RoiPredictionPanel";
import { sampleParcels } from "@/lib/sampleData";

const TRACK = "investment";

const valueFormatter = new Intl.NumberFormat("en-AE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <Hero track={TRACK} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
          <RoiPredictionPanel />

          <div className="min-w-0 space-y-6">
            <DemoPanel track={TRACK} />

            <section
              id="shortlist"
              className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] p-5 shadow-[0_18px_50px_rgba(45,38,24,0.08)]"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
                    Examples
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#17201f]">
                    Properties to compare
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-[#718078]">
                  A few sample opportunities to compare by area, size, upside,
                  and value.
                </p>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-[#ded7c9] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#ebe4d7] bg-[#f4efe5] text-[11px] uppercase tracking-[0.14em] text-[#66736e]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Parcel</th>
                        <th className="px-4 py-3 font-semibold">District</th>
                        <th className="px-4 py-3 font-semibold">Use</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Size
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Upside
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efe8db]">
                      {sampleParcels.map((p) => (
                        <tr key={p.parcelId} className="transition hover:bg-[#faf7ef]">
                          <td className="px-4 py-3 font-mono text-xs text-[#4e5b55]">
                            {p.parcelId}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#17201f]">
                            {p.district}
                          </td>
                          <td className="px-4 py-3 capitalize text-[#64716b]">
                            {p.landUse.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#64716b]">
                            {p.parcelSizeSqm.toLocaleString()} sqm
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="rounded-full bg-[#edf4f1] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#2f6f5d]">
                              {p.developmentPotentialScore}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#17201f]">
                            AED {valueFormatter.format(p.estimatedValueAed)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-12 border-t border-[#d9d2c4] pt-6 text-xs text-[#718078]">
          Estimates are for early screening only. Review the numbers with a
          qualified advisor before making a real purchase.
        </footer>
      </div>
    </main>
  );
}
