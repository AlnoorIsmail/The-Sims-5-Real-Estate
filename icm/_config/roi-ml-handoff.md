# ROI And ML Handoff

## V1 Boundary

Use a transparent local formula for demo purposes. It should be explainable from
simulation metrics such as occupancy, rent collection, maintenance load,
resident satisfaction, reputation, and incident severity.

Label placeholder ROI clearly. Do not claim it is trained or predictive.

The app-owned boundary is frozen as `roi_prediction.v1`. Implementation may be
local, mocked, or backed by the ML pipeline, but callers should not see a shape
change without an explicit `roi_prediction.v2` doc update.

## Stable Input Contract

The ROI scorer receives ML predictions plus district context and cost
assumptions. District reference values are context, not ML targets.

```ts
type RoiPredictionInputV1 = {
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
```

Input rules:

- All money fields are AED.
- `predicted_price_per_sqm` is AED per sqm.
- `predicted_development_potential_score`, `infrastructure_score`, and
  `success_score` use a 0-100 scale.
- `gross_yield_pct` is a percentage such as `7.5`, not a decimal such as
  `0.075`.
- Required fields must be present and finite. If a model is unavailable, the
  fallback must still fill the same fields and add a warning in the output.
- Do not pass raw model feature rows through this boundary.

## Stable Output Contract

```ts
type RoiPredictionOutputV1 = {
  contract_version: "roi_prediction.v1";
  recommendation: "BUY" | "CONSIDER" | "DO NOT BUY";
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
```

Output rules:

- `recommendation` is the only UI decision label.
- `success_score` must be clamped to 0-100.
- `reason` must be human-readable and cite the main business drivers.
- `warnings` must include assumptions, fallback/model failure, low
  infrastructure, negative margin, or low potential when applicable.
- Do not add, remove, or rename top-level fields in v1.

## Integration Default

Use this contract behind a small app-owned boundary. Keep UI behavior stable:
the simulation can change how it obtains predictions, but the ROI panel should
continue to consume `RoiPredictionOutputV1`.

## Non-Goals

- Do not train a district-level ROI model in the app.
- Do not expose raw model internals or feature tables to the UI.
- Do not implement live API enrichment as part of this handoff.
