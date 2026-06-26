from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.data_loader import load_all_data
from ml_pipeline.development_potential import RuleBasedDevelopmentPotentialRegressor
from ml_pipeline.feature_builder import (
    DEVELOPMENT_TARGET,
    PARCEL_FEATURE_COLUMNS,
    PARCEL_VALUE_TARGET,
    TRANSACTION_FEATURE_COLUMNS,
    TRANSACTION_TARGET,
    build_parcel_table,
    build_transaction_table,
)
from ml_pipeline.preprocessing import build_model_pipeline


MODEL_DIR = ROOT_DIR / "models"
OUTPUT_DIR = ROOT_DIR / "outputs"

MODEL_SPECS = [
    {
        "name": "transaction_price_per_sqm",
        "target": TRANSACTION_TARGET,
        "feature_columns": TRANSACTION_FEATURE_COLUMNS,
        "model_path": MODEL_DIR / "price_per_sqm_catboost_regressor.joblib",
        "table": "transaction",
        "model_family": "catboost",
        "model_params": {
            "iterations": 500,
            "depth": 6,
            "learning_rate": 0.03,
            "l2_leaf_reg": 10.0,
        },
    },
    {
        "name": "parcel_estimated_value_aed",
        "target": PARCEL_VALUE_TARGET,
        "feature_columns": PARCEL_FEATURE_COLUMNS,
        "model_path": MODEL_DIR / "estimated_value_aed_xgb_regressor.joblib",
        "table": "parcel",
        "model_family": "xgboost",
        "model_params": {},
    },
    {
        "name": "parcel_development_potential_score",
        "target": DEVELOPMENT_TARGET,
        "feature_columns": PARCEL_FEATURE_COLUMNS,
        "model_path": MODEL_DIR / "development_potential_score_catboost_regressor.joblib",
        "table": "parcel",
        "model_family": "catboost",
        "model_params": {
            "iterations": 300,
            "depth": 4,
            "learning_rate": 0.05,
            "l2_leaf_reg": 3.0,
        },
        "fallback_min_r2": 0.05,
    },
]


def _prepare_training_data(
    table: pd.DataFrame,
    feature_columns: list[str],
    target: str,
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    if target not in table.columns:
        raise ValueError(f"Training target is missing: {target}")

    selected_features = [
        column
        for column in feature_columns
        if column in table.columns and column != target
    ]
    if not selected_features:
        raise ValueError(f"No usable feature columns found for target {target}")

    y = pd.to_numeric(table[target], errors="coerce")
    valid_rows = y.notna()
    X = table.loc[valid_rows, selected_features].copy()
    y = y.loc[valid_rows]

    if len(X) < 2:
        raise ValueError(f"Need at least 2 valid rows to train target {target}")

    return X, y, selected_features


def _train_model(
    name: str,
    table: pd.DataFrame,
    feature_columns: list[str],
    target: str,
    model_path: Path,
    model_family: str,
    model_params: dict | None = None,
    fallback_min_r2: float | None = None,
) -> tuple[object, dict, list[str], pd.DataFrame]:
    X, y, selected_features = _prepare_training_data(table, feature_columns, target)
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = build_model_pipeline(
        X_train,
        model_family=model_family,
        model_params=model_params,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    metrics = {
        "target": target,
        "model_family": model_family,
        "model_params": model_params or {},
        "rows": int(len(X)),
        "features": selected_features,
        "mae": float(mean_absolute_error(y_test, predictions)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
        "r2": float(r2_score(y_test, predictions)) if len(y_test) > 1 else None,
    }

    if fallback_min_r2 is not None and (
        metrics["r2"] is None or metrics["r2"] < fallback_min_r2
    ):
        ml_candidate_metrics = metrics.copy()
        fallback_model = RuleBasedDevelopmentPotentialRegressor().fit(X_train, y_train)
        fallback_predictions = fallback_model.predict(X_test)
        fallback_metrics = {
            "target": target,
            "model_family": "rule_based_fallback",
            "model_params": {
                "reason": (
                    f"{model_family} held-out R2 "
                    f"{ml_candidate_metrics['r2']} was below {fallback_min_r2}."
                ),
            },
            "rows": int(len(X)),
            "features": selected_features,
            "mae": float(mean_absolute_error(y_test, fallback_predictions)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, fallback_predictions))),
            "r2": (
                float(r2_score(y_test, fallback_predictions))
                if len(y_test) > 1
                else None
            ),
            "ml_candidate_metrics": ml_candidate_metrics,
            "fallback_method": fallback_model.method_name,
            "selection_reason": (
                "Using transparent development-potential formula because the "
                "trained ML fit did not clear the minimum held-out R2 gate."
            ),
        }
        model = fallback_model
        metrics = fallback_metrics
        print(
            f"Using rule-based fallback for {name}; "
            f"{model_family} R2 was {ml_candidate_metrics['r2']}"
        )

    joblib.dump(model, model_path)
    print(f"Saved {name} to {model_path}")

    preview = X.head(10).copy()
    preview[f"actual_{target}"] = y.head(10).to_numpy()
    preview[f"predicted_{target}"] = model.predict(X.head(10))
    preview.insert(0, "prediction_type", name)

    return model, metrics, selected_features, preview


def main() -> None:
    MODEL_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    data = load_all_data()
    transaction_table = build_transaction_table(data)
    parcel_table = build_parcel_table(data)

    transaction_table.to_csv(OUTPUT_DIR / "transaction_model_table.csv", index=False)
    parcel_table.to_csv(OUTPUT_DIR / "parcel_model_table.csv", index=False)
    print(f"Saved model tables to {OUTPUT_DIR}")

    tables = {
        "transaction": transaction_table,
        "parcel": parcel_table,
    }
    metrics: dict[str, dict] = {}
    previews: list[pd.DataFrame] = []

    for spec in MODEL_SPECS:
        model, model_metrics, _, preview = _train_model(
            name=spec["name"],
            table=tables[spec["table"]],
            feature_columns=spec["feature_columns"],
            target=spec["target"],
            model_path=spec["model_path"],
            model_family=spec["model_family"],
            model_params=spec["model_params"],
            fallback_min_r2=spec.get("fallback_min_r2"),
        )
        metrics[spec["name"]] = model_metrics
        previews.append(preview)

    with (OUTPUT_DIR / "model_metrics.json").open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    pd.concat(previews, ignore_index=True, sort=False).to_csv(
        OUTPUT_DIR / "sample_predictions.csv",
        index=False,
    )
    print(f"Saved metrics and sample predictions to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
