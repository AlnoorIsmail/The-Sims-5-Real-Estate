"use client";

import { useState } from "react";
import type { Track } from "./TrackBadge";

type RecommendationDecision = {
  district?: string;
  parcel_id?: string;
  land_use?: string;
  current_status?: string;
  recommendation?: string;
  success_score?: number;
  margin_pct?: number;
  margin_aed?: number;
  predicted_estimated_value_aed?: number;
  predicted_price_per_sqm?: number;
  predicted_development_potential_score?: number;
  district_gross_yield_pct?: number;
  district_infrastructure_score?: number;
  total_cost_aed?: number;
  reason?: string;
  warnings?: string[];
};

type RecommendationResponse =
  | {
      ready: true;
      decision: RecommendationDecision;
    }
  | {
      ready: false;
      message: string;
      command?: string;
    };

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-AE", {
  maximumFractionDigits: 2,
});

function formatCurrency(value?: number) {
  return typeof value === "number" ? currency.format(value) : "Pending";
}

function formatNumber(value?: number, suffix = "") {
  return typeof value === "number" ? `${number.format(value)}${suffix}` : "Pending";
}

function trackLabel(track: Track) {
  return track === "investment" ? "Investment Intelligence" : "Decision Intelligence";
}

export default function DemoPanel({ track }: { track: Track }) {
  const [decision, setDecision] = useState<RecommendationDecision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchRecommendation() {
    setLoading(true);
    setMessage(null);
    setCommand(null);

    try {
      const response = await fetch("/api/recommend");
      const payload = (await response.json()) as RecommendationResponse;

      if (!response.ok) {
        throw new Error("Recommendation route failed.");
      }

      if (payload.ready) {
        setDecision(payload.decision);
      } else {
        setDecision(null);
        setMessage(payload.message);
        setCommand(payload.command ?? null);
      }
    } catch (err) {
      setDecision(null);
      setMessage(
        `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="demo" className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight">Investment recommendation</h2>
      <p className="mt-1 text-sm text-sand-50/60">
        Prepared from three local regression models and a transparent ROI
        calculator. Latest output is read from{" "}
        <code className="rounded bg-night-800 px-1.5 py-0.5 text-xs">
          outputs/sample_roi_decision.json
        </code>
        .
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-night-800/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-sand-50/50">
              {trackLabel(track)}
            </p>
            <p className="mt-1 text-sm text-sand-50/70">
              District and parcel feasibility from the latest pipeline run.
            </p>
          </div>
          <button
            onClick={fetchRecommendation}
            disabled={loading}
            className="rounded-lg bg-sand-50 px-5 py-2 text-sm font-semibold text-night-900 transition hover:bg-sand-100 disabled:opacity-40"
          >
            {loading ? "Loading..." : "Fetch recommendation"}
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
            <p>{message}</p>
            {command && (
              <code className="mt-3 block overflow-x-auto rounded bg-night-900/80 px-3 py-2 text-xs text-sand-50">
                {command}
              </code>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-night-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-sand-50/50">District</p>
            <p className="mt-2 text-lg font-semibold">{decision?.district ?? "Pending"}</p>
            <p className="mt-1 text-xs capitalize text-sand-50/50">
              {decision?.parcel_id ?? "No parcel selected"} /{" "}
              {decision?.land_use?.replace(/_/g, " ") ?? "run pipeline"}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-night-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-sand-50/50">
              Recommendation
            </p>
            <p className="mt-2 text-lg font-semibold">
              {decision?.recommendation ?? "Pending"}
            </p>
            <p className="mt-1 text-xs text-sand-50/50">
              Success score {formatNumber(decision?.success_score, "/100")}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-night-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-sand-50/50">Margin</p>
            <p className="mt-2 text-lg font-semibold">
              {formatNumber(decision?.margin_pct, "%")}
            </p>
            <p className="mt-1 text-xs text-sand-50/50">
              {formatCurrency(decision?.margin_aed)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Predicted value", formatCurrency(decision?.predicted_estimated_value_aed)],
            ["Price per sqm", formatCurrency(decision?.predicted_price_per_sqm)],
            ["Gross yield", formatNumber(decision?.district_gross_yield_pct, "%")],
            [
              "Infrastructure",
              formatNumber(decision?.district_infrastructure_score, "/100"),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-night-900/40 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-sand-50/50">
                {label}
              </p>
              <p className="mt-2 font-semibold text-sand-50">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-night-900/60 p-4 text-sm leading-relaxed text-sand-50/80">
          {decision?.reason ??
            "Run the ML pipeline, then fetch the latest prepared recommendation."}
        </div>

        {decision?.warnings && decision.warnings.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-sand-50/50">
              Warnings
            </p>
            <ul className="mt-2 space-y-2 text-sm text-sand-50/70">
              {decision.warnings.map((warning) => (
                <li key={warning} className="rounded bg-white/[0.03] px-3 py-2">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
