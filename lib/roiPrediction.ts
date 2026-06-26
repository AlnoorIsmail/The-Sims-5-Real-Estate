import {
  predictRoiWithOnnx,
  type ModelScoringInputV1,
} from "@/lib/onnxRoiInference";

export type Recommendation = "BUY" | "CONSIDER" | "DO NOT BUY";

export type RoiPredictionInputV1 = {
  contract_version: "roi_prediction.v1";
  district: string;
  predictions: {
    predicted_price_per_sqm: number;
    predicted_estimated_value_aed: number;
    predicted_development_potential_score: number;
  };
  district_context: {
    profile: string;
    gross_yield_pct: number;
    infrastructure_score: number;
    base_sale_aed_sqm: number;
  };
  assumptions: {
    acquisition_cost_aed: number;
    development_cost_aed: number;
  };
};

export type RoiPredictionOutputV1 = {
  contract_version: "roi_prediction.v1";
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
};

export type RoiFormState = {
  district: string;
  propertyType: string;
  propertySizeSqm: number;
  acquisitionCostAed: number;
  developmentCostAed: number;
};

type DistrictModelContext = RoiPredictionInputV1["district_context"] & {
  area_type: string;
  established_year: number;
};

export const districtOptions = [
  "Al Bahia",
  "Al Maryah Island",
  "Al Raha Beach",
  "Al Reem Island",
  "Masdar City",
  "Saadiyat Island",
  "Yas Island",
  "Zayed City",
] as const;

export const propertyTypeOptions = [
  "residential",
  "mixed_use",
  "retail",
  "office",
  "hospitality",
  "industrial",
] as const;

const districtContext: Record<string, DistrictModelContext> = {
  "Al Bahia": {
    area_type: "coastal",
    profile: "mid",
    gross_yield_pct: 8,
    infrastructure_score: 67,
    base_sale_aed_sqm: 8000,
    established_year: 2006,
  },
  "Al Maryah Island": {
    area_type: "island",
    profile: "premium",
    gross_yield_pct: 6,
    infrastructure_score: 96,
    base_sale_aed_sqm: 22000,
    established_year: 2014,
  },
  "Al Raha Beach": {
    area_type: "waterfront",
    profile: "high",
    gross_yield_pct: 7,
    infrastructure_score: 87,
    base_sale_aed_sqm: 14500,
    established_year: 2011,
  },
  "Al Reem Island": {
    area_type: "island",
    profile: "mid_high",
    gross_yield_pct: 7.5,
    infrastructure_score: 86,
    base_sale_aed_sqm: 13000,
    established_year: 2010,
  },
  "Masdar City": {
    area_type: "mainland",
    profile: "innovation",
    gross_yield_pct: 7,
    infrastructure_score: 89,
    base_sale_aed_sqm: 9000,
    established_year: 2008,
  },
  "Saadiyat Island": {
    area_type: "island",
    profile: "premium",
    gross_yield_pct: 6,
    infrastructure_score: 92,
    base_sale_aed_sqm: 19000,
    established_year: 2009,
  },
  "Yas Island": {
    area_type: "island",
    profile: "leisure",
    gross_yield_pct: 7,
    infrastructure_score: 88,
    base_sale_aed_sqm: 14000,
    established_year: 2009,
  },
  "Zayed City": {
    area_type: "mainland",
    profile: "affordable",
    gross_yield_pct: 8,
    infrastructure_score: 70,
    base_sale_aed_sqm: 7500,
    established_year: 2018,
  },
};

const propertyMultipliers: Record<string, number> = {
  residential: 1,
  mixed_use: 1.12,
  retail: 1.18,
  office: 1.08,
  hospitality: 1.2,
  industrial: 0.78,
};

const propertyPotentialBonus: Record<string, number> = {
  residential: 3,
  mixed_use: 8,
  retail: 5,
  office: 2,
  hospitality: 6,
  industrial: -4,
};

const assetTypeByPropertyType: Record<string, string> = {
  residential: "apartment",
  mixed_use: "land",
  retail: "retail",
  office: "office",
  hospitality: "hotel",
  industrial: "warehouse",
};

const zoneByPropertyType: Record<string, string> = {
  residential: "Z-RES-01",
  mixed_use: "Z-MIX-01",
  retail: "Z-COM-01",
  office: "Z-COM-02",
  hospitality: "Z-HOS-01",
  industrial: "Z-IND-01",
};

function clamp(value: number, lower = 0, upper = 100) {
  return Math.max(lower, Math.min(upper, value));
}

function profileAdjustment(profile: string) {
  const normalized = profile.toLowerCase();
  if (["premium", "high", "high_value"].includes(normalized)) return 5;
  if (["established", "mid_high"].includes(normalized)) return 3;
  if (["industrial", "leisure", "innovation"].includes(normalized)) return -2;
  return 0;
}

function recommendationFor(score: number, marginAed: number): Recommendation {
  if (score >= 75 && marginAed > 0) return "BUY";
  if (score >= 50) return "CONSIDER";
  return "DO NOT BUY";
}

export function buildRoiPredictionInput(
  form: RoiFormState
): RoiPredictionInputV1 {
  const context = districtContext[form.district] ?? districtContext["Al Bahia"];
  const multiplier = propertyMultipliers[form.propertyType] ?? 1;
  const propertySize = Math.max(1, form.propertySizeSqm);
  const predictedPricePerSqm = context.base_sale_aed_sqm * multiplier;
  const sizeAdjustment = propertySize > 20000 ? 4 : propertySize > 10000 ? 2 : 0;
  const predictedPotential = clamp(
    38 +
      context.infrastructure_score * 0.28 +
      context.gross_yield_pct * 2.1 +
      (propertyPotentialBonus[form.propertyType] ?? 0) +
      sizeAdjustment
  );

  return {
    contract_version: "roi_prediction.v1",
    district: form.district,
    predictions: {
      predicted_price_per_sqm: predictedPricePerSqm,
      predicted_estimated_value_aed: predictedPricePerSqm * propertySize * 0.92,
      predicted_development_potential_score: predictedPotential,
    },
    district_context: context,
    assumptions: {
      acquisition_cost_aed: Math.max(0, form.acquisitionCostAed),
      development_cost_aed: Math.max(0, form.developmentCostAed),
    },
  };
}

function buildModelScoringInput(form: RoiFormState): ModelScoringInputV1 {
  const context = districtContext[form.district] ?? districtContext["Al Bahia"];
  const propertySize = Math.max(1, form.propertySizeSqm);
  const propertyType = form.propertyType;
  const assetType = assetTypeByPropertyType[propertyType] ?? "apartment";
  const zone = zoneByPropertyType[propertyType] ?? "Z-RES-01";
  const commonDistrictFeatures = {
    district: form.district,
    area_type: context.area_type,
    profile: context.profile,
    base_sale_aed_sqm: context.base_sale_aed_sqm,
    gross_yield_pct: context.gross_yield_pct,
    infrastructure_score: context.infrastructure_score,
    established_year: context.established_year,
  };
  const parcelFeatures = {
    ...commonDistrictFeatures,
    zone,
    land_use: propertyType,
    parcel_size_sqm: propertySize,
    current_status: "vacant",
  };

  return {
    price_per_sqm_features: {
      ...commonDistrictFeatures,
      asset_type: assetType,
      buyer_type: "individual",
      size_sqm: propertySize,
      transaction_year: 2024,
      transaction_month: 7,
      transaction_quarter: 3,
    },
    parcel_features: parcelFeatures,
    scenario: {
      district: form.district,
      parcel_id: "UI-SCENARIO",
      acquisition_cost_aed: Math.max(0, form.acquisitionCostAed),
      development_cost_aed: Math.max(0, form.developmentCostAed),
      currency: "AED",
    },
  };
}

function withContractVersion(
  output: Omit<RoiPredictionOutputV1, "contract_version">
): RoiPredictionOutputV1 {
  return {
    contract_version: "roi_prediction.v1",
    ...output,
  };
}

export async function predictRoiFromForm(
  form: RoiFormState
): Promise<RoiPredictionOutputV1> {
  try {
    const onnxResult = await predictRoiWithOnnx(buildModelScoringInput(form));
    return withContractVersion(onnxResult.decision);
  } catch (error) {
    const fallback = await predictRoi(buildRoiPredictionInput(form));
    return {
      ...fallback,
      warnings: [
        `Model bundle fallback warning: ${
          error instanceof Error ? error.message : String(error)
        }`,
        ...fallback.warnings,
      ],
    };
  }
}

export async function predictRoi(
  input: RoiPredictionInputV1
): Promise<RoiPredictionOutputV1> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  const predictedValue = input.predictions.predicted_estimated_value_aed;
  const totalCost =
    input.assumptions.acquisition_cost_aed +
    input.assumptions.development_cost_aed;
  const marginAed = predictedValue - totalCost;
  const marginPct = totalCost > 0 ? (marginAed / totalCost) * 100 : 0;
  const marginScore = clamp(50 + marginPct * 2);
  const yieldScore = clamp((input.district_context.gross_yield_pct / 8) * 100);
  const potentialScore = clamp(
    input.predictions.predicted_development_potential_score
  );
  const infrastructureScore = clamp(input.district_context.infrastructure_score);
  const rawScore =
    0.35 * marginScore +
    0.25 * yieldScore +
    0.25 * potentialScore +
    0.15 * infrastructureScore;
  const successScore = clamp(
    rawScore + profileAdjustment(input.district_context.profile)
  );
  const recommendation = recommendationFor(successScore, marginAed);
  const warnings = [
    "Placeholder prediction warning: replace predictRoi() with /api/roi-predict when ML checkpoint output is available.",
  ];

  if (totalCost <= 0) {
    warnings.push("Invalid cost warning: total cost must be positive.");
  }
  if (marginAed < 0) {
    warnings.push("Negative margin warning: predicted value is below total cost.");
  }
  if (infrastructureScore < 60) {
    warnings.push(
      "Low infrastructure warning: district infrastructure score is below 60."
    );
  }
  if (potentialScore < 50) {
    warnings.push(
      "Low development potential warning: predicted development potential is below 50."
    );
  }

  return {
    contract_version: "roi_prediction.v1",
    recommendation,
    success_score: Number(successScore.toFixed(2)),
    predicted_price_per_sqm: Number(
      input.predictions.predicted_price_per_sqm.toFixed(2)
    ),
    predicted_estimated_value_aed: Number(predictedValue.toFixed(2)),
    predicted_development_potential_score: Number(potentialScore.toFixed(2)),
    district_profile: input.district_context.profile,
    district_gross_yield_pct: input.district_context.gross_yield_pct,
    district_infrastructure_score: infrastructureScore,
    total_cost_aed: Number(totalCost.toFixed(2)),
    margin_aed: Number(marginAed.toFixed(2)),
    margin_pct: Number(marginPct.toFixed(2)),
    reason: `${recommendation}: score ${successScore.toFixed(
      1
    )}/100 with margin ${marginPct.toFixed(1)}%, yield context ${
      input.district_context.gross_yield_pct
    }%, development potential ${potentialScore.toFixed(
      1
    )}, and infrastructure ${infrastructureScore.toFixed(1)}.`,
    warnings,
  };
}
