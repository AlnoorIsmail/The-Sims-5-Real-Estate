# ROI Prediction Contract

Contract name: `roi_prediction.v1`

Purpose: freeze the app-facing input and output shape for ROI recommendation so
future ML work can improve model internals without breaking the Next.js route,
demo panel, or recorded demo script.

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

## Demo Honesty

Until a trained ROI model is explicitly integrated, warnings must include that
the final recommendation uses transparent rule-based ROI logic, not a trained
ROI model. Starter-kit data must be described as synthetic challenge data.
