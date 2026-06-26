# The Sims 5 Real Estate

An AI-assisted real estate investment simulator that scores Abu Dhabi districts and parcels using market, land, community, and amenity signals.

This prototype is built for the Abu Dhabi AI PropTech Challenge, Investment Intelligence track. It uses the Hugging Face / starter-kit dataset as the main data source, trains three row-level regressors, and turns their predictions into a transparent rule-based investment recommendation.

No bonus live API is used. `districts.csv` is used as district context only because it has 20 rows, not as a standalone training set.

## What It Does

- Loads starter-kit CSVs from `data/` or Hugging Face.
- Trains a transaction `price_per_sqm` CatBoost model because it slightly improved the same-split XGBoost baseline.
- Trains a parcel `estimated_value_aed` XGBoost model.
- Trains a parcel `development_potential_score` CatBoost model because it performed better than the same-split XGBoost baseline for that target.
- Uses district yield, infrastructure, predicted value, predicted price, and development potential in a transparent ROI calculator.
- Displays the prepared recommendation through a local Next.js dashboard.

The final `BUY`, `CONSIDER`, or `DO NOT BUY` result is rule-based business logic. It is not a trained ROI model.

## Quick Start

```bash
pip install -r requirements.txt
python ml_pipeline/train_models.py
python ml_pipeline/predict_and_score.py
npm install
npm run dev
```

Open <http://localhost:3000> and click **Fetch recommendation**.

## Verification

```bash
python ml_pipeline/train_models.py
python ml_pipeline/predict_and_score.py
npm run build
```

The Python scripts write:

- `models/price_per_sqm_catboost_regressor.joblib`
- `models/estimated_value_aed_xgb_regressor.joblib`
- `models/development_potential_score_catboost_regressor.joblib`
- `outputs/model_metrics.json`
- `outputs/transaction_model_table.csv`
- `outputs/parcel_model_table.csv`
- `outputs/sample_predictions.csv`
- `outputs/sample_roi_decision.json`

## Data

Required CSVs:

- `districts.csv`
- `sample_transactions.csv`
- `sample_parcels.csv`
- `sample_communities.csv`
- `osm_amenities.csv`

The loader prefers local files in `data/`. If a file is missing locally, it loads from:

```text
https://huggingface.co/datasets/eVoost/abu-dhabi-ai-proptech-challenge/resolve/main/
```

## Project Structure

```text
app/
  page.tsx
  api/
    recommend/
      route.ts
components/
  Hero.tsx
  DemoPanel.tsx
  TrackBadge.tsx
lib/
  sampleData.ts
ml_pipeline/
  data_loader.py
  feature_builder.py
  preprocessing.py
  train_models.py
  predict_and_score.py
  roi_logic.py
  README.md
data/
models/
outputs/
requirements.txt
```

## Notes And Limitations

- The starter-kit data is synthetic challenge data, not live Abu Dhabi market data.
- The bonus live API is intentionally not implemented.
- No TabM or deep learning models are used.
- CatBoost is used for `price_per_sqm` and `development_potential_score`.
  `estimated_value_aed` remains XGBoost because CatBoost performed worse on the
  same split.
- The Next.js route reads `outputs/sample_roi_decision.json`; it does not run Python from the request path.
- District-only context fields such as `profile`, `base_sale_aed_sqm`, `gross_yield_pct`, and `infrastructure_score` are features, not model targets.
