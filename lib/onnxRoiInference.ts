import type { Recommendation } from "@/lib/roiPrediction";

export type FeatureValue = string | number | null | undefined;
export type FeatureRow = Record<string, FeatureValue>;

export type ModelScoringInputV1 = {
  price_per_sqm_features: FeatureRow;
  parcel_features: FeatureRow;
  scenario: {
    parcel_id?: string;
    district?: string;
    acquisition_cost_aed: number;
    development_cost_aed: number;
    currency?: "AED";
  };
};

export type RoiDecisionV1 = {
  recommendation: Recommendation;
  success_score: number;
  predicted_price_per_sqm: number;
  predicted_estimated_value_aed: number;
  predicted_development_potential_score: number;
  district_profile: string;
  district_gross_yield_pct: number;
  district_infrastructure_score: number;
  total_cost_aed: number;
  margin_aed: number;
  margin_pct: number;
  reason: string;
  warnings: string[];
  district?: string;
  parcel_id?: string;
  land_use?: string;
  current_status?: string;
  acquisition_cost_aed: number;
  development_cost_aed: number;
  generated_at: string;
  data_source: string;
};

type ModelKey =
  | "price_per_sqm"
  | "estimated_value_aed"
  | "development_potential_score";

type OnnxModelSchema = {
  numeric_columns: string[];
  categorical_columns: string[];
  numeric_means: Record<string, number>;
  categorical_values: Record<string, string[]>;
  input_tensor_name: string;
  output_tensor_name: string;
  onnx_path: string;
};

type OnnxBundleSchema = {
  schema_version: string;
  models: Record<ModelKey, OnnxModelSchema>;
};

type OnnxPredictionOutputV1 = {
  predicted_price_per_sqm: number;
  predicted_estimated_value_aed: number;
  predicted_development_potential_score: number;
};

type Tensor = {
  data: ArrayLike<number>;
};

type InferenceSession = {
  run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
};

type OrtRuntime = {
  env: {
    wasm: {
      wasmPaths?: string;
      numThreads?: number;
    };
  };
  Tensor: new (
    type: "float32",
    data: Float32Array,
    dims: number[]
  ) => Tensor;
  InferenceSession: {
    create(path: string): Promise<InferenceSession>;
  };
};

declare global {
  interface Window {
    ort?: OrtRuntime;
  }
}

const MODEL_KEYS: ModelKey[] = [
  "price_per_sqm",
  "estimated_value_aed",
  "development_potential_score",
];

let bundlePromise:
  | Promise<{
      schema: OnnxBundleSchema;
      sessions: Record<ModelKey, InferenceSession>;
    }>
  | null = null;

let runtimePromise: Promise<OrtRuntime> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadOrtRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (typeof window === "undefined") {
        throw new Error("ONNX browser runtime is only available in the browser.");
      }
      await loadScript("/ort-wasm/ort.wasm.min.js");
      if (!window.ort) {
        throw new Error("ONNX Runtime did not attach to window.ort.");
      }
      window.ort.env.wasm.wasmPaths = "/ort-wasm/";
      window.ort.env.wasm.numThreads = 1;
      return window.ort;
    })();
  }

  return runtimePromise;
}

function modelUrl(onnxPath: string) {
  return onnxPath.replace(/^public\//, "/");
}

function numericValue(value: FeatureValue, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, lower = 0, upper = 100) {
  return Math.max(lower, Math.min(upper, value));
}

function encodeFeatures(schema: OnnxModelSchema, row: FeatureRow) {
  const values: number[] = [];

  for (const column of schema.numeric_columns) {
    values.push(numericValue(row[column], schema.numeric_means[column] ?? 0));
  }

  for (const column of schema.categorical_columns) {
    const rawValue = row[column];
    const isMissing = rawValue === null || rawValue === undefined || rawValue === "";
    const normalized = isMissing ? "" : String(rawValue);
    const knownValues = schema.categorical_values[column] ?? [];
    const isKnown = knownValues.includes(normalized);

    for (const category of knownValues) {
      values.push(normalized === category ? 1 : 0);
    }
    values.push(isMissing ? 1 : 0);
    values.push(!isMissing && !isKnown ? 1 : 0);
  }

  return new Float32Array(values);
}

async function loadBundleSchema(baseUrl: string) {
  const response = await fetch(`${baseUrl}/model_schema.json`);
  if (!response.ok) {
    throw new Error(`Failed to load ONNX schema: ${response.status}`);
  }
  return (await response.json()) as OnnxBundleSchema;
}

async function loadBundle(baseUrl: string) {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const ort = await loadOrtRuntime();
      const schema = await loadBundleSchema(baseUrl);
      const sessions = Object.fromEntries(
        await Promise.all(
          MODEL_KEYS.map(async (key) => {
            const modelSchema = schema.models[key];
            return [
              key,
              await ort.InferenceSession.create(modelUrl(modelSchema.onnx_path)),
            ];
          })
        )
      ) as Record<ModelKey, InferenceSession>;

      return { schema, sessions };
    })();
  }

  return bundlePromise;
}

async function runModel(
  session: InferenceSession,
  schema: OnnxModelSchema,
  row: FeatureRow
) {
  const ort = await loadOrtRuntime();
  const encoded = encodeFeatures(schema, row);
  const tensor = new ort.Tensor("float32", encoded, [1, encoded.length]);
  const result = await session.run({ [schema.input_tensor_name]: tensor });
  const output = result[schema.output_tensor_name];
  return Number(output.data[0]);
}

function marginScore(marginPct: number) {
  if (marginPct <= -20) return 0;
  if (marginPct <= 0) return ((marginPct + 20) / 20) * 50;
  if (marginPct >= 40) return 100;
  return 50 + (marginPct / 40) * 50;
}

function profileAdjustment(profile: string) {
  const normalized = profile.trim().toLowerCase();
  if (["premium", "high", "high_value"].includes(normalized)) return 5;
  if (["established", "mid_high"].includes(normalized)) return 3;
  if (["industrial", "leisure", "innovation"].includes(normalized)) return -2;
  return 0;
}

function calculateDecision(
  input: ModelScoringInputV1,
  predictions: OnnxPredictionOutputV1
): RoiDecisionV1 {
  const parcel = input.parcel_features;
  const totalCost =
    input.scenario.acquisition_cost_aed + input.scenario.development_cost_aed;
  const marginAed = predictions.predicted_estimated_value_aed - totalCost;
  const marginPct = totalCost === 0 ? 0 : (marginAed / totalCost) * 100;
  const districtProfile = String(parcel.profile ?? "unknown");
  const districtYield = numericValue(parcel.gross_yield_pct, 0);
  const infrastructure = numericValue(parcel.infrastructure_score, 0);
  const potential = clamp(predictions.predicted_development_potential_score);

  const score = clamp(
    0.45 * marginScore(marginPct) +
      0.25 * clamp((districtYield / 8) * 100) +
      0.1 * potential +
      0.2 * clamp(infrastructure) +
      profileAdjustment(districtProfile)
  );

  const recommendation =
    score >= 75 && marginAed > 0
      ? "BUY"
      : score >= 50
        ? "CONSIDER"
        : "DO NOT BUY";

  return {
    recommendation,
    success_score: Number(score.toFixed(2)),
    predicted_price_per_sqm: Number(
      predictions.predicted_price_per_sqm.toFixed(2)
    ),
    predicted_estimated_value_aed: Number(
      predictions.predicted_estimated_value_aed.toFixed(2)
    ),
    predicted_development_potential_score: Number(potential.toFixed(2)),
    district_profile: districtProfile,
    district_gross_yield_pct: Number(districtYield.toFixed(2)),
    district_infrastructure_score: Number(infrastructure.toFixed(2)),
    total_cost_aed: Number(totalCost.toFixed(2)),
    margin_aed: Number(marginAed.toFixed(2)),
    margin_pct: Number(marginPct.toFixed(2)),
    reason: `${recommendation}: score ${score.toFixed(
      1
    )}/100 with ${marginPct.toFixed(
      1
    )}% margin, ${districtYield.toFixed(
      1
    )}% district yield, ${potential.toFixed(
      1
    )}/100 development potential, and ${infrastructure.toFixed(
      1
    )}/100 infrastructure.`,
    warnings: [
      "Final recommendation uses transparent rule-based ROI logic, not a trained ROI model.",
      "Predictions are generated from the browser ONNX model bundle.",
    ],
    district: input.scenario.district ?? String(parcel.district ?? "unknown"),
    parcel_id: input.scenario.parcel_id,
    land_use: typeof parcel.land_use === "string" ? parcel.land_use : undefined,
    current_status:
      typeof parcel.current_status === "string"
        ? parcel.current_status
        : undefined,
    acquisition_cost_aed: Number(input.scenario.acquisition_cost_aed.toFixed(2)),
    development_cost_aed: Number(input.scenario.development_cost_aed.toFixed(2)),
    generated_at: new Date().toISOString(),
    data_source: "Browser ONNX bundle",
  };
}

export async function predictRoiWithOnnx(
  input: ModelScoringInputV1,
  baseUrl = "/models/roi"
) {
  const { schema, sessions } = await loadBundle(baseUrl);

  const predictions: OnnxPredictionOutputV1 = {
    predicted_price_per_sqm: await runModel(
      sessions.price_per_sqm,
      schema.models.price_per_sqm,
      input.price_per_sqm_features
    ),
    predicted_estimated_value_aed: await runModel(
      sessions.estimated_value_aed,
      schema.models.estimated_value_aed,
      input.parcel_features
    ),
    predicted_development_potential_score: await runModel(
      sessions.development_potential_score,
      schema.models.development_potential_score,
      input.parcel_features
    ),
  };

  return {
    ready: true as const,
    predictions,
    decision: calculateDecision(input, predictions),
  };
}
