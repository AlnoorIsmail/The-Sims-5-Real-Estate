# The Sims 5 Real Estate Model Bundle

Generated from the Abu Dhabi PropTech ML pipeline.

## Python backend checkpoints

Use these with Python, joblib, and the code in `ml_pipeline/`:

- `python_checkpoints/price_per_sqm_catboost_regressor.joblib`
- `python_checkpoints/estimated_value_aed_xgb_regressor.joblib`
- `python_checkpoints/development_potential_score_catboost_regressor.joblib`

## Browser / Next.js UI models

Use these with `onnxruntime-web` and `integration/onnxRoiInference.ts`:

- `browser_onnx/price_per_sqm_catboost.onnx`
- `browser_onnx/estimated_value_aed_xgb.onnx`
- `browser_onnx/development_potential_score_catboost.onnx`
- `browser_onnx/model_schema.json`

## Reports

- `reports/model_metrics.json`
- `reports/onnx_model_metrics.json`
- `reports/sample_roi_decision.json`

## Notes

- The current repo uses CatBoost for price per sqm and development potential,
  and XGBoost for estimated value.
- For a UI-only integration, copy the `browser_onnx/` contents into a public
  assets path and call `predictRoiWithOnnx()` from `integration/onnxRoiInference.ts`.
- For a Python API integration, load the `.joblib` files with `joblib.load()`.
