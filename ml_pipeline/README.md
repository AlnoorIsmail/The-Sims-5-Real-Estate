# ML Pipeline

This directory contains the fresh local-first ML pipeline for **The Sims 5 Real Estate**.

It uses the Hugging Face / starter-kit CSVs, preferring matching local files in `data/` when present:

- `districts.csv`
- `sample_transactions.csv`
- `sample_parcels.csv`
- `sample_communities.csv`
- `osm_amenities.csv`

The pipeline trains three row-level regression models:

- `price_per_sqm` with CatBoost, after a same-split check showed a small
  improvement versus XGBoost
- `estimated_value_aed` with XGBoost
- `development_potential_score` with CatBoost, after an apples-to-apples
  split check showed it improved the weak development-score fit versus XGBoost

District fields such as `profile`, `base_sale_aed_sqm`, `gross_yield_pct`, and `infrastructure_score` are used as context features. They are not trained as standalone targets.

## Run

```bash
pip install -r requirements.txt
python ml_pipeline/train_models.py
python ml_pipeline/predict_and_score.py
```

Training writes model artifacts to `models/` and auditable outputs to `outputs/`.

The final recommendation in `outputs/sample_roi_decision.json` is a transparent rule-based feasibility score that consumes model predictions plus district context. It is not a trained ROI model.

## External API Gated Pipeline

The bonus UAE listings API is not used for primary model training yet. The
starter-kit / Hugging Face CSV pipeline remains the training source, and the
external API is treated as a messy live inference and scoring source.

API data must pass quality gates before scoring:

- raw cache is non-empty
- required listing columns are present
- cleaned rows have valid price and built-up area
- area values map to model-compatible districts
- listing features satisfy the transaction model contract
- parcel/development models are only used when the API row has compatible
  parcel fields

The transaction price model benchmarks each listing by predicting expected
`price_per_sqm`. The pipeline compares that estimate with the observed API
`price / built_up_area_sqm` and labels the listing as `UNDERVALUED`,
`FAIR_VALUE`, or `OVERPRICED`. A transparent opportunity score combines price
gap, district gross yield, infrastructure score, profile, and mapping
confidence.

Cached raw data is saved under `data/raw/` and cleaned feature rows are saved
under `data/processed/`, so a demo can reuse cached API rows when live API
access is unavailable.

```bash
export UAE_DATA_API_KEY="uae_..."
python ml_pipeline/api_predict_and_score.py
```

Use `--refresh` to force a live API fetch when cached raw rows already exist.

The API pipeline writes:

- `outputs/api_listing_predictions.csv`
- `outputs/api_top_opportunities.csv`
- `outputs/api_data_quality_report.json`

## ONNX Export

```bash
python ml_pipeline/export_onnx.py
```

This writes browser-embeddable artifacts to `public/models/roi/`:

- `price_per_sqm_catboost.onnx`
- `estimated_value_aed_xgb.onnx`
- `development_potential_score_catboost.onnx`
- `model_schema.json`

CatBoost cannot export the current categorical-feature models to ONNX-ML, so
the ONNX bundle uses JSON-defined one-hot numeric preprocessing. It exports
CatBoost for the targets where that ONNX-compatible setup performs better and
XGBoost where XGBoost still wins.
