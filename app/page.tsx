import Hero from "@/components/Hero";
import DemoPanel from "@/components/DemoPanel";
import RoiPredictionPanel from "@/components/RoiPredictionPanel";
import SimulatorControlPanel from "@/components/SimulatorControlPanel";

const TRACK = "investment";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <Hero track={TRACK} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)] lg:items-stretch">
          <RoiPredictionPanel />

          <div className="min-w-0 space-y-6 lg:flex lg:flex-col lg:gap-4 lg:space-y-0">
            <DemoPanel track={TRACK} />
            <SimulatorControlPanel />
          </div>
        </div>

        <footer className="mt-6 border-t border-[#d9d2c4] pt-4 text-xs text-[#718078]">
          Predicted values and estimated profits are for early screening only.
          Review the numbers with a qualified advisor before making a real
          purchase.
        </footer>
      </div>
    </main>
  );
}
