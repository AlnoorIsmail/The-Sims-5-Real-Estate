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

## Kaggle Dataset Preparation

Local Kaggle uploads can be staged under `Kaggle_Data/`:

- `transactions-2023-07-02.csv`
- `properties_data.csv`
- `uae_real_estate_2024.xls`

The `uae_real_estate_2024.xls` file is CSV text despite the extension, so it is
read with pandas CSV parsing.

Normalize and profile the Kaggle sources with:

```bash
python ml_pipeline/prepare_kaggle_datasets.py --input-dir Kaggle_Data
```

This writes:

- `data/processed/kaggle_transactions_normalized.csv`
- `data/processed/kaggle_dubai_properties_normalized.csv`
- `data/processed/kaggle_uae_2024_listings_normalized.csv`
- `data/processed/kaggle_external_listings_normalized.csv`
- `outputs/kaggle_data_quality_report.json`

Recommended use:

- use `kaggle_transactions_normalized.csv` as the real Dubai transaction
  candidate for price-per-sqm training or benchmarking
- use `kaggle_external_listings_normalized.csv` for listing-style gated scoring
  experiments and market browsing
- do not use these files to claim Abu Dhabi parcel value, development potential,
  or true ROI accuracy

These datasets are Dubai market data. Keep source, market, and license columns
visible in downstream work, and do not present listing asking prices as closed
transaction truth.

Train the separate Kaggle Dubai price-per-sqm CatBoost/SFS model with:

```bash
python ml_pipeline/train_kaggle_catboost_sfs.py --mode smoke --threads 4
python ml_pipeline/train_kaggle_catboost_sfs.py --mode balanced --threads -1
```

The model trains on `log1p(price_per_sqm)` for stability, but the saved wrapper
predicts normal AED/sqm values. This path writes separate review artifacts and
does not overwrite the app-facing starter-kit model:

- `models/kaggle_price_per_sqm_catboost_sfs.joblib`
- `outputs/kaggle_price_model_table.csv`
- `outputs/kaggle_price_model_metrics.json`
- `outputs/kaggle_price_model_feature_selection.json`
- `outputs/kaggle_price_model_test_predictions.csv`

## Development Potential Fallback

The `development_potential_score` target is weak in the current sample parcel
data. The training pipeline now adds non-leaky engineered parcel/community
features, then tries CatBoost as before. If held-out R2 is below the configured
gate, the saved compatibility artifact uses a transparent rule-based fallback
instead of a weak ML fit.

Inspect feature signal with:

```bash
python ml_pipeline/analyze_development_potential_features.py
```

The report is written to
`outputs/development_potential_feature_report.json`. When the fallback is active,
`outputs/model_metrics.json` records the rejected ML candidate metrics and
`outputs/sample_roi_decision.json` includes
`development_potential_method`.

## Synthetic External Gated Pipeline

The bonus live UAE listings API is not used for this branch. The starter-kit /
Hugging Face CSV pipeline remains the training source, and the gated listings
path uses a deterministic synthetic external-style feed for local demo scoring.

Generate the synthetic raw feed:

```bash
python ml_pipeline/generate_synthetic_external_listings.py --rows 50000 --seed 20260626
```

Run the gated scorer:

```bash
python ml_pipeline/synthetic_gated_predict_and_score.py
```

Synthetic listing rows must pass quality gates before scoring:

- raw cache is non-empty
- required listing columns are present
- cleaned rows have valid price and built-up area
- area values map to model-compatible districts
- listing features satisfy the transaction model contract
- parcel/development features satisfy the parcel model contract

The transaction price model benchmarks each listing by predicting expected
`price_per_sqm`. The pipeline compares that estimate with the observed
`price / built_up_area_sqm` and labels the listing as `UNDERVALUED`,
`FAIR_VALUE`, or `OVERPRICED`. A transparent opportunity score combines price
gap, district gross yield, infrastructure score, profile, and mapping
confidence.

The synthetic gated scorer now emits all three model predictions:

- `predicted_price_per_sqm`
- `predicted_estimated_value_aed`
- `predicted_development_potential_score`

Synthetic accuracy is measured against evaluation-only `synthetic_*` label
columns. Those columns must not be used as model input features.

The current generator is intentionally model-aligned without leaking the target:
it emits transaction-compatible `asset_type`, `buyer_type`, size, district, and
listing-date fields plus parcel-compatible zoning, land-use, parcel-size,
status, community, and amenity features. Raw observed prices still include
portal-style noise, outliers, missing values, and rent/sale messiness.

Current optimized synthetic gated benchmark:

- raw rows: `50,000`
- cleaned rows: `47,582`
- scored rows: `29,757`
- mapping coverage: `89.61%`
- price per sqm R2: `0.969`, MAE `655 AED/sqm`
- estimated value R2: `0.897`, MAE `8.83M AED`
- development potential R2: `-0.226`, MAE `10.08 pts`

The synthetic gated pipeline writes:

- `data/raw/synthetic_external_listings_raw.csv`
- `data/processed/synthetic_external_listings_clean.csv`
- `data/processed/synthetic_listing_features.csv`
- `outputs/synthetic_listing_predictions.csv`
- `outputs/synthetic_top_opportunities.csv`
- `outputs/synthetic_data_quality_report.json`
- `outputs/synthetic_gated_model_metrics.json`

For backwards compatibility, `python ml_pipeline/api_predict_and_score.py`
runs the synthetic gated scorer and ignores live-API-only flags. It does not
require `UAE_DATA_API_KEY`.

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
