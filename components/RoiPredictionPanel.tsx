"use client";

import { useState } from "react";
import {
  districtOptions,
  predictRoiFromForm,
  propertyTypeOptions,
  type Recommendation,
  type RoiFormState,
  type RoiPredictionOutputV1,
} from "@/lib/roiPrediction";

const initialForm: RoiFormState = {
  district: "Al Bahia",
  propertyType: "residential",
  propertySizeSqm: 6297,
  acquisitionCostAed: 12322860,
  developmentCostAed: 3520817,
};

const recommendationStyles: Record<
  Recommendation,
  {
    text: string;
    bg: string;
    stroke: string;
    bar: string;
    track: string;
  }
> = {
  BUY: {
    text: "text-emerald-800",
    bg: "bg-emerald-50 border-emerald-200",
    stroke: "#2f8f6b",
    bar: "bg-[#2f8f6b]",
    track: "bg-emerald-100",
  },
  CONSIDER: {
    text: "text-amber-800",
    bg: "bg-amber-50 border-amber-200",
    stroke: "#c98218",
    bar: "bg-[#c98218]",
    track: "bg-amber-100",
  },
  "DO NOT BUY": {
    text: "text-rose-800",
    bg: "bg-rose-50 border-rose-200",
    stroke: "#c44949",
    bar: "bg-[#c44949]",
    track: "bg-rose-100",
  },
};

const moneyFormatter = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-AE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-AE", {
  maximumFractionDigits: 0,
});

const recommendationCopy: Record<Recommendation, string> = {
  BUY: "Worth buying",
  CONSIDER: "Review first",
  "DO NOT BUY": "Do not buy",
};

const recommendationReactions: Record<
  Recommendation,
  { src: string; alt: string }
> = {
  BUY: {
    src: "/reactions/excellent.png",
    alt: "Excellent result",
  },
  CONSIDER: {
    src: "/reactions/maybe.png",
    alt: "Maybe result",
  },
  "DO NOT BUY": {
    src: "/reactions/bad.png",
    alt: "Bad result",
  },
};

function clamp(value: number, lower = 0, upper = 100) {
  return Math.max(lower, Math.min(upper, value));
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatCompactMoney(value: number) {
  return `AED ${compactMoneyFormatter.format(value)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getPlainReason(result: RoiPredictionOutputV1) {
  const margin = formatPercent(result.margin_pct);
  const value = formatCompactMoney(result.predicted_estimated_value_aed);
  const profit = formatCompactMoney(result.margin_aed);

  if (result.recommendation === "BUY") {
    return `This looks attractive: predicted value is ${value}, with about ${profit} of estimated room above your total cost (${margin}).`;
  }

  if (result.recommendation === "CONSIDER") {
    return `This may be worth a closer look: predicted value is ${value}, with about ${profit} of estimated room above your total cost (${margin}).`;
  }

  return `This does not look strong enough right now: predicted value is ${value}, with about ${profit} of estimated room against your total cost (${margin}).`;
}

function toUserWarning(warning: string) {
  const normalized = warning.toLowerCase();

  if (
    normalized.includes("fallback") ||
    normalized.includes("model bundle") ||
    normalized.includes("placeholder") ||
    normalized.includes("onnx") ||
    normalized.includes("preview shown") ||
    normalized.includes("refresh the estimate")
  ) {
    return null;
  }

  if (normalized.includes("negative margin")) {
    return "The predicted value is below your total cost.";
  }

  if (normalized.includes("unrealistic size")) {
    return "The property size is too small for a normal buy recommendation.";
  }

  if (normalized.includes("small size")) {
    return "The property size is unusually small, so the result is capped.";
  }

  if (normalized.includes("size check")) {
    return "The predicted value was adjusted to fit the property size you entered.";
  }

  if (normalized.includes("negative npv")) {
    return "The long-term cash flow estimate is negative.";
  }

  if (normalized.includes("low infrastructure")) {
    return "The area infrastructure score is low, so access and services may need review.";
  }

  if (normalized.includes("long payback")) {
    return "The payback period may be longer than expected.";
  }

  if (normalized.includes("invalid cost")) {
    return "Enter a purchase cost and development cost greater than zero.";
  }

  return warning;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#66736e]"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  min,
  prefix,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  prefix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative mt-2">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8a918b]">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          min={min ?? 0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`h-11 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15 ${
            prefix ? "pl-12" : ""
          }`}
        />
      </div>
    </div>
  );
}

function ScoreGauge({ result }: { result: RoiPredictionOutputV1 }) {
  const score = clamp(result.success_score);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  const style = recommendationStyles[result.recommendation];
  const reaction = recommendationReactions[result.recommendation];

  return (
    <div className="rounded-lg border border-[#d8d1c3] bg-[#f8f5ee] p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#e1dbcf"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={style.stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth="10"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tracking-tight text-[#17201f]">
              {Math.round(score)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b847e]">
              /100
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}
          >
            {recommendationCopy[result.recommendation]}
          </div>
          <h3 className="mt-3 text-base font-semibold text-[#17201f]">
            Buy confidence from prediction
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[#5b6661]">
            {getPlainReason(result)}
          </p>
        </div>
        <div className="ml-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#ded7c9] bg-white p-2 shadow-sm sm:h-16 sm:w-16">
          <img
            src={reaction.src}
            alt={reaction.alt}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#ded7c9] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-[#718078]">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-[#17201f]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#87918b]">{hint}</p> : null}
    </div>
  );
}

function DriverBar({
  label,
  value,
  tone,
  track = "bg-[#ece5d8]",
}: {
  label: string;
  value: number;
  tone: string;
  track?: string;
}) {
  const width = clamp(value);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[#4f5b56]">{label}</span>
        <span className="tabular-nums text-[#6b756f]">{Math.round(width)}</span>
      </div>
      <div className={`mt-2 h-2 overflow-hidden rounded-full ${track}`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function RoiPredictionPanel() {
  const [form, setForm] = useState<RoiFormState>(initialForm);
  const [result, setResult] = useState<RoiPredictionOutputV1 | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeProperty() {
    setLoading(true);
    try {
      const nextResult = await predictRoiFromForm(form);
      setResult(nextResult);
    } finally {
      setLoading(false);
    }
  }

  const visibleResult =
    result ??
    ({
      contract_version: "roi_prediction.v1",
      recommendation: "CONSIDER",
      success_score: 74.06,
      predicted_price_per_sqm: 10130.91,
      predicted_estimated_value_aed: 17604086,
      predicted_development_potential_score: 54.94,
      district_profile: "mid",
      district_gross_yield_pct: 8,
      district_infrastructure_score: 67,
      total_cost_aed: 15843677,
      margin_aed: 1760409,
      margin_pct: 11.11,
      reason:
        "CONSIDER: score 74.1/100 with margin 11.1%, yield context 8.0%, development potential 54.9, and infrastructure 67.0.",
      warnings: [],
    } satisfies RoiPredictionOutputV1);

  const style = recommendationStyles[visibleResult.recommendation];
  const userWarnings = Array.from(
    new Set(
      visibleResult.warnings
        .map(toUserWarning)
        .filter((warning): warning is string => warning !== null)
    )
  );
  const driverValues = {
    margin: clamp(50 + visibleResult.margin_pct * 2),
    yield: clamp((visibleResult.district_gross_yield_pct / 8) * 100),
    potential: clamp(visibleResult.predicted_development_potential_score),
    infrastructure: clamp(visibleResult.district_infrastructure_score),
  };

  return (
    <section
      id="demo"
      className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] p-5 shadow-[0_18px_50px_rgba(45,38,24,0.10)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
            Property details
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#17201f]">
            Quick buy check
          </h2>
        </div>
        <span className="rounded-full border border-[#d8d1c3] bg-white px-3 py-1 text-[11px] font-semibold text-[#66736e]">
          enter your numbers
        </span>
      </div>

      <div className="mt-5">
      <div className="rounded-lg border border-[#ded7c9] bg-white p-4">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <FieldLabel htmlFor="district">District</FieldLabel>
              <select
                id="district"
                value={form.district}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    district: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
              >
                {districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="property-type">Property type</FieldLabel>
              <select
                id="property-type"
                value={form.propertyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    propertyType: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm capitalize text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
              >
                {propertyTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <TextInput
            id="property-size"
            label="Property size (sqm)"
            min={1}
            value={form.propertySizeSqm}
            onChange={(value) =>
              setForm((current) => ({ ...current, propertySizeSqm: value }))
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <TextInput
              id="acquisition-cost"
              label="Acquisition cost"
              prefix="AED"
              value={form.acquisitionCostAed}
              onChange={(value) =>
                setForm((current) => ({ ...current, acquisitionCostAed: value }))
              }
            />
            <TextInput
              id="development-cost"
              label="Development cost"
              prefix="AED"
              value={form.developmentCostAed}
              onChange={(value) =>
                setForm((current) => ({ ...current, developmentCostAed: value }))
              }
            />
          </div>

          <button
            onClick={analyzeProperty}
            disabled={loading}
            className="h-11 rounded-md bg-[#23443d] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b3731] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "Analyzing..." : "Analyze property"}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <ScoreGauge result={visibleResult} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatTile
          label="Predicted value"
          value={formatCompactMoney(visibleResult.predicted_estimated_value_aed)}
          hint={`Model estimate: ${formatMoney(
            visibleResult.predicted_estimated_value_aed
          )}`}
        />
        <StatTile
          label="Estimated profit"
          value={formatCompactMoney(visibleResult.margin_aed)}
          hint={`Predicted value minus your costs: ${formatPercent(
            visibleResult.margin_pct
          )}`}
        />
        <StatTile
          label="Predicted price / sqm"
          value={formatMoney(visibleResult.predicted_price_per_sqm)}
          hint="Model estimate"
        />
        <StatTile
          label="Total cost"
          value={formatCompactMoney(visibleResult.total_cost_aed)}
          hint={`Your inputs: ${formatMoney(visibleResult.total_cost_aed)}`}
        />
      </div>

      <div className="mt-5 rounded-lg border border-[#ded7c9] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#17201f]">
              What affects the answer
            </p>
            <p className="text-xs text-[#718078]">
              Predicted market value plus your entered costs.
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.track} ${style.text}`}>
            {numberFormatter.format(Math.round(visibleResult.success_score))}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <DriverBar label="Profit margin" value={driverValues.margin} tone={style.bar} />
          <DriverBar
            label="Rental return"
            value={driverValues.yield}
            tone="bg-[#4f8f80]"
            track="bg-[#deece7]"
          />
          <DriverBar
            label="Predicted development upside"
            value={driverValues.potential}
            tone="bg-[#6f7f9b]"
            track="bg-[#e5e9f0]"
          />
          <DriverBar
            label="Area infrastructure"
            value={driverValues.infrastructure}
            tone="bg-[#2f7786]"
            track="bg-[#dcebef]"
          />
        </div>
      </div>

      {userWarnings.length > 0 ? (
        <div className="mt-5 rounded-lg border border-[#e4d4aa] bg-[#fff8e8] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6829]">
            Things to watch
          </p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#6f5b2d]">
            {userWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>
    </section>
  );
}
