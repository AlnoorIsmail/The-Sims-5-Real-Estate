# ROI Prediction Contract

Contract name: `roi_prediction.v1`

Purpose: freeze the app-facing input and output shape for ROI recommendation so
future ML work can improve model internals without breaking the Next.js route,
demo panel, or recorded demo script.

## Model Pipeline Summary

The current implementation is a local-first ML pipeline under `ml_pipeline/`.
It uses only the Hugging Face / starter-kit CSVs, preferring local copies in
`data/` when present. It does not use the bonus live API.

Required source tables:

- `districts.csv`
- `sample_transactions.csv`
- `sample_parcels.csv`
- `sample_communities.csv`
- `osm_amenities.csv`

The pipeline trains three row-level regression models:

| Prediction | Target | Training table | Model family | Artifact |
| --- | --- | --- | --- | --- |
| Price per sqm | `price_per_sqm` | Transactions joined with district context | CatBoost | `models/price_per_sqm_catboost_regressor.joblib` |
| Parcel value | `estimated_value_aed` | Parcels joined with district, community, and amenity features | XGBoost | `models/estimated_value_aed_xgb_regressor.joblib` |
| Development potential | `development_potential_score` | Same parcel feature table | CatBoost | `models/development_potential_score_catboost_regressor.joblib` |

Model families are selected per target based on the same deterministic
`train_test_split(test_size=0.2, random_state=42)`. CatBoost is used where it
beat the same-split XGBoost baseline; XGBoost remains for parcel value because
it performed better for that target.

Current held-out metrics are written to `outputs/model_metrics.json`.

## Feature Contract

The model feature contract is internal to the ML boundary. The UI must not
depend on raw feature columns. Larger app integrations may feed equivalent
fields into the feature builder, but the app-facing contract stays
`roi_prediction.v1`.

### Price Per Sqm Features

Source: `sample_transactions.csv` joined with `districts.csv`.

Target: `price_per_sqm`.

Required feature columns:

- `district`
- `asset_type`
- `size_sqm`
- `buyer_type`
- `area_type`
- `profile`
- `base_sale_aed_sqm`
- `gross_yield_pct`
- `infrastructure_score`
- `established_year`
- `transaction_year`
- `transaction_month`
- `transaction_quarter`

Leakage rule: exclude `transaction_value_aed` because it directly relates to
`price_per_sqm`.

### Parcel Value And Development Potential Features

Source: `sample_parcels.csv` joined with `districts.csv`, district-level
community aggregates, and district-level amenity aggregates.

Targets:

- `estimated_value_aed`
- `development_potential_score`

Required parcel and district features:

- `district`
- `zone`
- `land_use`
- `parcel_size_sqm`
- `current_status`
- `area_type`
- `profile`
- `base_sale_aed_sqm`
- `gross_yield_pct`
- `infrastructure_score`
- `established_year`

Required community aggregate features:

- `avg_population_estimate`
- `avg_occupancy_rate`
- `avg_service_demand_index`
- `avg_mobility_score`
- `avg_resident_experience_score`

Required amenity aggregate features:

- `amenity_count_total`
- `amenity_count_education`
- `amenity_count_healthcare`
- `amenity_count_retail`
- `amenity_count_services`
- `amenity_count_community`
- `amenity_count_mobility`

## Internal Prediction Output

The model layer produces exactly these normalized prediction values for the ROI
calculator:

```json
{
  "predicted_price_per_sqm": 7171.61,
  "predicted_estimated_value_aed": 25756704,
  "predicted_development_potential_score": 73.56
}
```

The ROI calculator also needs district and scenario-cost context:

```json
{
  "district_profile": "mid",
  "district_gross_yield_pct": 8,
  "district_infrastructure_score": 67,
  "acquisition_cost_aed": 18029692.8,
  "development_cost_aed": 5151340.8
}
```

In the current sample script, scenario costs are deterministic assumptions:

```text
acquisition_cost_aed = predicted_estimated_value_aed * 0.70
development_cost_aed = predicted_estimated_value_aed * 0.20
```

## Boundary

The UI calls the app-owned recommendation boundary. In the current local demo
that boundary is `GET /api/recommend`, which reads
`outputs/sample_roi_decision.json`.

The route response is one of:

```json
{
  "ready": true,
  "decision": {}
}
```

```json
{
  "ready": false,
  "message": "No prepared recommendation was found.",
  "command": "python ml_pipeline/train_models.py && python ml_pipeline/predict_and_score.py"
}
```

When `ready` is true, `decision` must conform to `RoiDecisionV1`.

For a larger app, keep this boundary as a backend service, for example:

```text
selected parcel + district/community/amenity context
  -> feature builder
  -> model artifacts
  -> three predictions
  -> ROI calculator
  -> RoiDecisionV1
  -> app route / API response
```

The UI should only consume `RoiDecisionV1`, not raw feature rows, training
tables, or model-specific metadata.

## Required Input

These are the stable inputs to the ROI scoring boundary. Model teams may derive
them however they like, but the app boundary consumes these names and units.

| Field | Type | Unit | Rule |
| --- | --- | --- | --- |
| `predicted_price_per_sqm` | number | AED per sqm | Required, finite |
| `predicted_estimated_value_aed` | number | AED | Required, finite |
| `predicted_development_potential_score` | number | 0 to 100 score | Required, clamp to 0 to 100 before scoring |
| `district_profile` | string | label | Required, unknown allowed |
| `district_gross_yield_pct` | number | percent, not fraction | Required, finite |
| `district_infrastructure_score` | number | 0 to 100 score | Required, clamp to 0 to 100 before scoring |
| `acquisition_cost_aed` | number | AED | Required, finite |
| `development_cost_aed` | number | AED | Required, finite |

Optional pass-through context may include `district`, `parcel_id`, `land_use`,
`current_status`, `generated_at`, and `data_source`.

## Required Output: `RoiDecisionV1`

| Field | Type | Unit | Rule |
| --- | --- | --- | --- |
| `recommendation` | string | enum | `BUY`, `CONSIDER`, or `DO NOT BUY` |
| `success_score` | number | 0 to 100 score | Required, rounded for display |
| `predicted_price_per_sqm` | number | AED per sqm | Echo model prediction |
| `predicted_estimated_value_aed` | number | AED | Echo model prediction |
| `predicted_development_potential_score` | number | 0 to 100 score | Echo clamped model prediction |
| `district_profile` | string | label | Echo district context |
| `district_gross_yield_pct` | number | percent, not fraction | Echo district context |
| `district_infrastructure_score` | number | 0 to 100 score | Echo district context |
| `total_cost_aed` | number | AED | `acquisition_cost_aed + development_cost_aed` |
| `margin_aed` | number | AED | `predicted_estimated_value_aed - total_cost_aed` |
| `margin_pct` | number | percent, not fraction | Safe division; use 0 when total cost is 0 |
| `reason` | string | sentence | Human-readable explanation of the decision |
| `warnings` | string[] | messages | Include limitation and data-quality warnings |

Recommended pass-through output fields:

| Field | Type | Unit | Rule |
| --- | --- | --- | --- |
| `district` | string | label | Selected district |
| `parcel_id` | string | id | Selected parcel |
| `land_use` | string | label | Starter-kit land-use label |
| `current_status` | string | label | Starter-kit parcel status |
| `acquisition_cost_aed` | number | AED | Echo input |
| `development_cost_aed` | number | AED | Echo input |
| `generated_at` | string | ISO timestamp | UTC preferred |
| `data_source` | string | description | Local CSVs, Hugging Face starter-kit CSVs, or future source |

## Recommendation Semantics

The v1 semantics are:

- `BUY`: `success_score >= 75` and `margin_aed > 0`
- `CONSIDER`: `success_score >= 50` and not `BUY`
- `DO NOT BUY`: all other cases

Current v1 score composition:

```text
score =
  0.45 * margin_score
  + 0.25 * yield_score
  + 0.10 * potential_score
  + 0.20 * infrastructure_score
  + profile_adjustment
```

`margin_score` maps margin percent linearly across these anchors:

- `margin_pct <= -20` -> 0
- `margin_pct == 0` -> 50
- `margin_pct >= 40` -> 100

Profile adjustment:

- `premium`, `high`, `high_value` -> +5
- `established`, `mid_high` -> +3
- `affordable`, `mid`, unknown -> 0
- `industrial`, `leisure`, `innovation` -> -2

The final score is clamped to 0 to 100.

## Compatibility Rules

- Do not rename required fields in `roi_prediction.v1`.
- Do not change currency units from AED.
- Do not change percent fields from percent values to fractions.
- Do not change score ranges from 0 to 100.
- Do not change recommendation labels or thresholds without creating
  `roi_prediction.v2`.
- Future ML models may add optional fields such as confidence intervals,
  scenario names, feature attributions, or model metadata.
- The UI must tolerate unknown optional fields and missing recommended
  pass-through fields, but not missing required fields when `ready` is true.
- Any trained ROI model must keep a deterministic fallback response with
  `ready: false`, `message`, and an optional operator `command`.
- If a future app moves from prepared JSON files to live inference, preserve the
  route response shape and keep model execution server-side.
- If a future app adds multiple parcels, scenarios, or confidence intervals,
  add them as optional fields or create `roi_prediction.v2`.

## Demo Honesty

Until a trained ROI model is explicitly integrated, warnings must include that
the final recommendation uses transparent rule-based ROI logic, not a trained
ROI model. Starter-kit data must be described as synthetic challenge data.

## Larger App Integration Notes

The safest integration point is an app-owned `RoiPredictionService` with one
method that returns `RoiDecisionV1`. Internally, that service can decide whether
to read a prepared JSON artifact, load local model files, call a remote model
endpoint, or use a deterministic fallback.

Recommended service responsibilities:

- validate all required `roi_prediction.v1` inputs
- keep CatBoost/XGBoost dependencies server-side
- load model artifacts once per process where possible
- convert source data into the feature contract before inference
- call the transparent ROI calculator after model inference
- return `ready: false` with an operator message when artifacts or features are
  missing
- include warnings when predictions are weak, synthetic, stale, or fallback
  generated

Do not expose model-specific feature columns directly to frontend components.
Do not make the UI know whether a prediction came from CatBoost, XGBoost, a
remote API, or a future ensemble.
