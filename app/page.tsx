import Hero from "@/components/Hero";
import DemoPanel from "@/components/DemoPanel";
import { sampleParcels } from "@/lib/sampleData";

const TRACK = "investment";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-24">
      <Hero track={TRACK} />

      <DemoPanel track={TRACK} />

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">Starter-kit parcel preview</h2>
        <p className="mt-1 text-sm text-sand-50/60">
          A small synthetic parcel slice for the page. The ML scripts use the
          full required CSVs from{" "}
          <code className="rounded bg-night-800 px-1.5 py-0.5 text-xs">
            data/
          </code>
          {" "}or Hugging Face.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-night-800 text-xs uppercase tracking-wider text-sand-50/50">
              <tr>
                <th className="px-4 py-3">Parcel</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Use</th>
                <th className="px-4 py-3 text-right">Size (sqm)</th>
                <th className="px-4 py-3 text-right">Potential</th>
                <th className="px-4 py-3 text-right">Est. value (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sampleParcels.map((p) => (
                <tr key={p.parcelId} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs">{p.parcelId}</td>
                  <td className="px-4 py-3">{p.district}</td>
                  <td className="px-4 py-3 capitalize">
                    {p.landUse.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.parcelSizeSqm.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.developmentPotentialScore}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.estimatedValueAed.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-16 border-t border-white/10 pt-6 text-xs text-sand-50/40">
        Abu Dhabi AI PropTech Challenge, Investment Intelligence track. Synthetic
        starter-kit data only, with transparent local ROI logic.
      </footer>
    </main>
  );
}
