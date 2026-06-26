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

## Local Kaggle Dataset Staging

The user-provided Kaggle files live under `Kaggle_Data/`:

- `transactions-2023-07-02.csv`
- `properties_data.csv`
- `uae_real_estate_2024.xls`

Prepare normalized, source-labeled tables with:

```bash
python ml_pipeline/prepare_kaggle_datasets.py --input-dir Kaggle_Data
```

The preparation step writes:

- `data/processed/kaggle_transactions_normalized.csv`
- `data/processed/kaggle_dubai_properties_normalized.csv`
- `data/processed/kaggle_uae_2024_listings_normalized.csv`
- `data/processed/kaggle_external_listings_normalized.csv`
- `outputs/kaggle_data_quality_report.json`

Use `kaggle_transactions_normalized.csv` as the strongest real-data candidate
for Dubai `price_per_sqm` training or benchmarking. Use
`kaggle_external_listings_normalized.csv` for listing-style gated scoring
experiments.

Compatibility rule: these datasets describe the Dubai market. They must keep
their `market`, `source_dataset`, `source_url`, and `source_license` metadata
when used downstream, and they must not be presented as Abu Dhabi parcel,
development-potential, or ROI ground truth. Listing rows provide asking prices,
not closed-transaction labels.

Kaggle price-model experimentation is isolated from the app-facing starter-kit
artifacts. Run the HPC-ready CatBoost/SFS path with:

```bash
python ml_pipeline/train_kaggle_catboost_sfs.py --mode balanced --threads -1
```

This path trains on `log1p(price_per_sqm)` and saves a wrapper that predicts
normal AED/sqm values to
`models/kaggle_price_per_sqm_catboost_sfs.joblib`. Review its metrics before
using it to replace the current transaction model.

## Development Potential Fallback Rule

The current sample `development_potential_score` target has weak feature signal.
The pipeline now adds non-leaky engineered parcel/community features and trains
the CatBoost candidate, but it does not force a weak ML model into the ROI
contract. If held-out R2 stays below the configured gate, the compatibility
artifact at `models/development_potential_score_catboost_regressor.joblib`
uses a transparent rule-based fallback while keeping the same prediction field:

```json
{
  "predicted_development_potential_score": 78.4,
  "development_potential_method": "rule_based_development_potential_fallback"
}
```

The fallback combines infrastructure, service demand, mobility, resident
experience, amenity density, district yield, occupancy opportunity, parcel
status, land use, and profile adjustments into a clamped `0-100` score. It is a
business-rule score, not trained market accuracy.

## Synthetic Gated Listing Source

The gated external-listing path is synthetic for this branch. It does not call
the live UAE listings API and does not require `UAE_DATA_API_KEY`.

Generate the deterministic raw feed with:

```bash
python ml_pipeline/generate_synthetic_external_listings.py --rows 50000 --seed 20260626
```

Run the gated listing scorer with:

```bash
python ml_pipeline/synthetic_gated_predict_and_score.py
```

The raw feed is committed at
`data/raw/synthetic_external_listings_raw.csv`. It intentionally mimics a
messy external feed with missing values, invalid prices/sizes, unmapped areas,
missing building metadata, rent/sale mislabels, and price outliers.

The optimized generator is aligned to the transaction model's training
distribution without target leakage. It includes transaction-compatible
`asset_type`, `buyer_type`, district, size, and listing-date fields, while the
hidden fair-price label follows the starter-kit transaction formula for
district base price, asset multiplier, monthly appreciation, and controlled
noise. It also includes parcel-compatible zoning, land-use, parcel-size,
status, community, and amenity features so the synthetic gated path can run all
three existing models.

Evaluation-only columns are prefixed with `synthetic_`:

- `synthetic_true_district`
- `synthetic_fair_price_per_sqm`
- `synthetic_estimated_value_aed`
- `synthetic_development_potential_score`
- `synthetic_quality_case`
- `synthetic_price_multiplier`

These fields are never model inputs. The gated scorer reports synthetic
benchmark metrics by comparing each prediction against its matching
evaluation-only label, not against observed listing price.

Synthetic gated outputs:

- `data/processed/synthetic_external_listings_clean.csv`
- `data/processed/synthetic_listing_features.csv`
- `outputs/synthetic_listing_predictions.csv`
- `outputs/synthetic_top_opportunities.csv`
- `outputs/synthetic_data_quality_report.json`
- `outputs/synthetic_gated_model_metrics.json`

The old `ml_pipeline/api_predict_and_score.py` command is now a compatibility
wrapper that runs the synthetic gated scorer and does not fetch live API data.

Current optimized synthetic gated benchmark:

- raw rows: `50,000`
- cleaned rows: `47,582`
- scored rows: `29,757`
- mapping coverage: `89.61%`
- price per sqm R2: `0.969`, MAE `655 AED/sqm`
- estimated value R2: `0.897`, MAE `8.83M AED`
- development potential R2: `-0.226`, MAE `10.08 pts`

These are synthetic benchmark metrics only. They should not be presented as
real market accuracy.

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

## JSON Input Shape

The model-serving layer should accept a structured object that separates price
features, parcel features, and scenario assumptions. This shape is internal to
the backend model boundary. The frontend should consume only `RoiDecisionV1`.

Example `ModelScoringInputV1`:

```json
{
  "price_per_sqm_features": {
    "district": "Al Bahia",
    "asset_type": "retail",
    "size_sqm": 778,
    "buyer_type": "individual",
    "area_type": "coastal",
    "profile": "mid",
    "base_sale_aed_sqm": 8000,
    "gross_yield_pct": 8.0,
    "infrastructure_score": 67,
    "established_year": 2006,
    "transaction_year": 2023,
    "transaction_month": 1,
    "transaction_quarter": 1
  },
  "parcel_features": {
    "district": "Al Bahia",
    "zone": "Z-CMU-05",
    "land_use": "community",
    "parcel_size_sqm": 8959,
    "current_status": "under_development",
    "area_type": "coastal",
    "profile": "mid",
    "base_sale_aed_sqm": 8000,
    "gross_yield_pct": 8.0,
    "infrastructure_score": 67,
    "established_year": 2006,
    "avg_population_estimate": 52583.5,
    "avg_occupancy_rate": 0.8975,
    "avg_service_demand_index": 63.0,
    "avg_mobility_score": 61.5,
    "avg_resident_experience_score": 88.25,
    "amenity_count_total": 100,
    "amenity_count_education": 14,
    "amenity_count_healthcare": 10,
    "amenity_count_retail": 9,
    "amenity_count_services": 11,
    "amenity_count_community": 38,
    "amenity_count_mobility": 18
  },
  "scenario": {
    "parcel_id": "PRC-0280",
    "district": "Al Bahia",
    "acquisition_cost_aed": 18029692.8,
    "development_cost_aed": 5151340.8,
    "currency": "AED"
  }
}
```

Rules:

- Do not include target fields such as `price_per_sqm`,
  `estimated_value_aed`, or `development_potential_score` in the input at
  inference time.
- Do not include leakage fields such as `transaction_value_aed` in
  `price_per_sqm_features`.
- `parcel_features` is reused by both the parcel-value model and the
  development-potential model.
- Scenario costs may be user-entered, finance-team estimates, or deterministic
  assumptions. In the current sample script they are derived from predicted
  parcel value.

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

## JSON Output Shape

The model layer should first produce `ModelPredictionOutputV1`:

```json
{
  "predictions": {
    "predicted_price_per_sqm": 7171.61,
    "predicted_estimated_value_aed": 25756704,
    "predicted_development_potential_score": 73.56
  },
  "model_metadata": {
    "price_per_sqm_model": "catboost",
    "estimated_value_aed_model": "xgboost",
    "development_potential_score_model": "catboost",
    "metrics_file": "outputs/model_metrics.json"
  },
  "context": {
    "district_profile": "mid",
    "district_gross_yield_pct": 8.0,
    "district_infrastructure_score": 67.0,
    "acquisition_cost_aed": 18029692.8,
    "development_cost_aed": 5151340.8
  },
  "warnings": []
}
```

The app-facing boundary then wraps the ROI decision:

```json
{
  "ready": true,
  "decision": {
    "recommendation": "CONSIDER",
    "success_score": 74.51,
    "predicted_price_per_sqm": 7171.61,
    "predicted_estimated_value_aed": 25756704,
    "predicted_development_potential_score": 73.56,
    "district_profile": "mid",
    "district_gross_yield_pct": 8.0,
    "district_infrastructure_score": 67.0,
    "total_cost_aed": 23181033.6,
    "margin_aed": 2575670.4,
    "margin_pct": 11.11,
    "reason": "CONSIDER: score 74.5/100 with 11.1% margin, 8.0% district yield, 73.6/100 development potential, and 67.0/100 infrastructure.",
    "warnings": [
      "Final recommendation uses transparent rule-based ROI logic, not a trained ROI model."
    ],
    "district": "Al Bahia",
    "parcel_id": "PRC-0280",
    "land_use": "community",
    "current_status": "under_development",
    "acquisition_cost_aed": 18029692.8,
    "development_cost_aed": 5151340.8,
    "generated_at": "2026-06-26T05:23:54.135791+00:00",
    "data_source": "Hugging Face starter-kit CSVs or matching local data/ CSVs"
  }
}
```

If model artifacts, feature inputs, or prepared outputs are unavailable, return
the fallback response instead of partial decision data:

```json
{
  "ready": false,
  "message": "No prepared recommendation was found.",
  "command": "python ml_pipeline/train_models.py && python ml_pipeline/predict_and_score.py"
}
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

## ONNX Browser Bundle

CatBoost native ONNX export is not available for the current CatBoost models
because they use categorical features. To support direct JavaScript/browser
inference without a Python server, the repo provides an ONNX-compatible bundle
generated by:

```bash
python ml_pipeline/export_onnx.py
```

The ONNX bundle uses manual JSON-defined preprocessing. It exports CatBoost
where numeric one-hot CatBoost performs better and XGBoost where XGBoost still
wins:

| Prediction | ONNX artifact |
| --- | --- |
| Price per sqm | `public/models/roi/price_per_sqm_catboost.onnx` |
| Parcel value | `public/models/roi/estimated_value_aed_xgb.onnx` |
| Development potential | `public/models/roi/development_potential_score_catboost.onnx` |

The browser loads `public/models/roi/model_schema.json`, converts source
features into the ordered `float32` tensor named `features`, runs the ONNX
models with `onnxruntime-web`, then passes the three predictions into the same
ROI calculator semantics documented below.

The current TypeScript helper for this browser path is
`lib/onnxRoiInference.ts`.

This ONNX bundle is optimized for embeddability and demo portability. It may
not exactly match the mixed CatBoost/XGBoost Python artifact metrics.

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

## Pre-Purchase Valuation Uses

This contract can support a larger real-estate decision product before a buyer
commits capital:

- Screen candidate parcels by predicted value, predicted price per sqm,
  development potential, yield, infrastructure, and final recommendation.
- Estimate an offer ceiling by comparing acquisition cost plus development cost
  against predicted parcel value and margin percent.
- Compare districts with the same cost assumptions to see whether yield and
  infrastructure are strong enough to justify a purchase.
- Build a pre-purchase investment memo with value estimate, margin, key
  district context, model warning notes, and a plain-language reason string.
- Run sensitivity analysis by changing `acquisition_cost_aed` and
  `development_cost_aed` while keeping model predictions fixed.
- Flag deals for deeper due diligence when margin is negative, infrastructure
  is weak, predicted value is non-positive, or warning messages are present.
- Rank parcels for a short list before manual underwriting, site visits, title
  review, and legal checks.
- Compare predicted value against seller asking price to identify potentially
  overpriced or underpriced opportunities.
- Support financing conversations by producing a repeatable, auditable
  feasibility score and cost/value breakdown.
- Track model risk by exposing warnings and keeping the rule-based ROI layer
  separate from trained predictions.

The output should not be treated as a purchase decision by itself. It is an
early valuation and triage aid for investors, analysts, and property teams.

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
