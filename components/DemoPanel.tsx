import type { Track } from "./TrackBadge";

const TRACK_COPY: Record<Track, string> = {
  land: "Good land decisions need more than a cheap price.",
  investment: "A good purchase should have value upside, sensible costs, and manageable risk.",
  communities: "A strong area should support demand, access, and quality of life.",
  decision: "A clear decision should show the result and the reasons behind it.",
};

const CHECK_CARDS = [
  {
    label: "Value check",
    title: "What could it be worth?",
    detail: "Compares the property details with the selected area and property type.",
  },
  {
    label: "Profit check",
    title: "Is there room after costs?",
    detail: "Looks at purchase cost, development cost, estimated value, and margin.",
  },
  {
    label: "Risk check",
    title: "What could weaken the deal?",
    detail: "Highlights area quality, infrastructure, and warning signs before you commit.",
  },
];

const RESULT_ITEMS = [
  "A clear buy, review, or avoid recommendation",
  "Estimated value and profit",
  "Confidence score out of 100",
  "Main factors behind the answer",
  "Warnings to review before making a real decision",
];

function CheckCard({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#ded7c9] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-[#718078]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#17201f]">{title}</p>
      <p className="mt-3 text-xs leading-relaxed text-[#738079]">{detail}</p>
    </div>
  );
}

function LogicStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#23443d] text-xs font-semibold text-white">
        {index}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#17201f]">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#64716b]">{text}</p>
      </div>
    </div>
  );
}

export default function DemoPanel({ track }: { track: Track }) {
  return (
    <section className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] p-5 shadow-[0_18px_50px_rgba(45,38,24,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
            How it helps
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#17201f]">
            A quick second opinion before you buy
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#64716b]">
            {TRACK_COPY[track]} This screen brings the key numbers together so
            you can spot attractive deals and avoid weak ones faster.
          </p>
        </div>
        <span className="rounded-full border border-[#d8d1c3] bg-white px-3 py-1 text-[11px] font-semibold text-[#66736e]">
          plain-language result
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {CHECK_CARDS.map((card) => (
          <CheckCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-[#ded7c9] bg-white p-4">
          <p className="text-sm font-semibold text-[#17201f]">How to read it</p>
          <div className="mt-4 space-y-4">
            <LogicStep
              index="1"
              title="Enter the property details"
              text="Choose the area, property type, size, purchase cost, and expected development cost."
            />
            <LogicStep
              index="2"
              title="Review the numbers"
              text="Check the estimated value, expected profit, score, and the main factors behind the answer."
            />
            <LogicStep
              index="3"
              title="Use the warnings"
              text="If the margin is thin or the area risk is high, slow down and review before moving forward."
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#ded7c9] bg-white p-4">
          <p className="text-sm font-semibold text-[#17201f]">What you get</p>
          <p className="mt-1 text-xs leading-relaxed text-[#718078]">
            A simple view for comparing the deal, not a final financial opinion.
          </p>
          <div className="mt-4 space-y-2">
            {RESULT_ITEMS.map((item) => (
              <div
                key={item}
                className="rounded-md border border-[#ebe4d7] bg-[#faf8f2] px-3 py-2 text-xs text-[#52605a]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
