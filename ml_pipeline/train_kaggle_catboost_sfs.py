from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.kaggle_price_model import KagglePricePerSqmModel
from ml_pipeline.prepare_kaggle_datasets import run as prepare_kaggle_datasets


PROCESSED_DIR = ROOT_DIR / "data" / "processed"
OUTPUT_DIR = ROOT_DIR / "outputs"
MODEL_DIR = ROOT_DIR / "models"

DEFAULT_INPUT_PATH = PROCESSED_DIR / "kaggle_transactions_normalized.csv"
MODEL_PATH = MODEL_DIR / "kaggle_price_per_sqm_catboost_sfs.joblib"
TABLE_PATH = OUTPUT_DIR / "kaggle_price_model_table.csv"
METRICS_PATH = OUTPUT_DIR / "kaggle_price_model_metrics.json"
FEATURE_SELECTION_PATH = OUTPUT_DIR / "kaggle_price_model_feature_selection.json"
TEST_PREDICTIONS_PATH = OUTPUT_DIR / "kaggle_price_model_test_predictions.csv"

TARGET_COLUMN = "price_per_sqm"
LOG_TARGET_COLUMN = "log_price_per_sqm"
RANDOM_STATE = 42

LEAKAGE_COLUMNS = [
    "amount_aed",
    "price_per_sqm",
    "transaction_id",
    "transaction_date",
    "source_dataset",
    "source_url",
    "source_license",
    "market",
]

MANDATORY_FEATURES = ["area_grouped", "asset_type_grouped", "log_size_sqm"]

CANDIDATE_FEATURES = [
    "area_grouped",
    "property_type_grouped",
    "property_sub_type_grouped",
    "asset_type_grouped",
    "transaction_sub_type_grouped",
    "registration_type",
    "is_freehold",
    "size_sqm",
    "log_size_sqm",
    "size_bucket",
    "bedrooms",
    "bedroom_bucket",
    "parking_count_clean",
    "has_parking",
    "buyer_count",
    "seller_count",
    "transaction_month",
    "transaction_quarter",
    "nearest_metro_grouped",
    "nearest_mall_grouped",
    "nearest_landmark_grouped",
    "project_grouped",
]

MODE_CONFIGS = {
    "smoke": {
        "sfs_sample_rows": 2500,
        "sfs_iterations": 80,
        "final_iterations": 250,
        "max_features": 7,
        "min_improvement": 0.0005,
        "early_stopping_rounds": 40,
    },
    "balanced": {
        "sfs_sample_rows": 20_000,
        "sfs_iterations": 300,
        "final_iterations": 3000,
        "max_features": 16,
        "min_improvement": 0.001,
        "early_stopping_rounds": 100,
    },
    "full": {
        "sfs_sample_rows": None,
        "sfs_iterations": 500,
        "final_iterations": 5000,
        "max_features": 20,
        "min_improvement": 0.0005,
        "early_stopping_rounds": 150,
    },
}


def _resolve(path: Path) -> Path:
    return path if path.is_absolute() else ROOT_DIR / path


def _clean_text(value: object, default: str = "missing") -> str:
    if pd.isna(value):
        return default
    cleaned = " ".join(str(value).strip().split())
    return cleaned if cleaned else default


def _category(frame: pd.DataFrame, column: str, default: str = "missing") -> pd.Series:
    if column not in frame.columns:
        return pd.Series(default, index=frame.index)
    return frame[column].map(lambda value: _clean_text(value, default=default))


def _number(frame: pd.DataFrame, column: str, default: float = 0.0) -> pd.Series:
    if column not in frame.columns:
        return pd.Series(default, index=frame.index, dtype="float64")
    return pd.to_numeric(frame[column], errors="coerce").fillna(default)


def _group_rare(series: pd.Series, min_count: int) -> pd.Series:
    cleaned = series.fillna("missing").astype(str).str.strip().replace("", "missing")
    counts = cleaned.value_counts()
    rare_values = set(counts[counts < min_count].index)
    return cleaned.where(~cleaned.isin(rare_values), "__rare__")


def _parking_count(value: object) -> float:
    text = _clean_text(value, default="")
    if not text:
        return np.nan
    digits = []
    current = ""
    for character in text:
        if character.isdigit() or character == ".":
            current += character
        elif current:
            digits.append(current)
            current = ""
    if current:
        digits.append(current)
    if not digits:
        return np.nan
    try:
        return float(digits[0])
    except ValueError:
        return np.nan


def _bedroom_bucket(value: object) -> str:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return "missing"
    if numeric <= 0:
        return "studio"
    if numeric <= 1:
        return "1"
    if numeric <= 2:
        return "2"
    if numeric <= 3:
        return "3"
    return "4_plus"


def _size_bucket(size_sqm: object) -> str:
    numeric = pd.to_numeric(size_sqm, errors="coerce")
    if pd.isna(numeric):
        return "missing"
    if numeric < 50:
        return "micro"
    if numeric < 90:
        return "compact"
    if numeric < 150:
        return "mid"
    if numeric < 300:
        return "large"
    if numeric < 750:
        return "villa_scale"
    return "estate_scale"


def _strata(y: pd.Series, bins: int = 10) -> pd.Series | None:
    try:
        strata = pd.qcut(y, q=bins, labels=False, duplicates="drop")
    except ValueError:
        return None
    if strata.nunique(dropna=True) < 2 or strata.value_counts().min() < 2:
        return None
    return strata


def _split(
    X: pd.DataFrame,
    y_log: pd.Series,
    *,
    test_size: float,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    strata = _strata(y_log)
    return train_test_split(
        X,
        y_log,
        test_size=test_size,
        random_state=RANDOM_STATE,
        stratify=strata,
    )


def _sample_for_sfs(
    X: pd.DataFrame,
    y_log: pd.Series,
    max_rows: int | None,
) -> tuple[pd.DataFrame, pd.Series]:
    if max_rows is None or len(X) <= max_rows:
        return X, y_log
    strata = _strata(y_log)
    X_sample, _, y_sample, _ = train_test_split(
        X,
        y_log,
        train_size=max_rows,
        random_state=RANDOM_STATE,
        stratify=strata,
    )
    return X_sample, y_sample


def _prepare_for_catboost(
    X: pd.DataFrame,
    features: list[str],
) -> tuple[pd.DataFrame, list[str], list[int]]:
    frame = X.reindex(columns=features).copy()
    categorical_features = [
        column for column in frame.columns if not pd.api.types.is_numeric_dtype(frame[column])
    ]
    for column in categorical_features:
        frame[column] = frame[column].fillna("missing").astype(str)
    categorical_indices = [frame.columns.get_loc(column) for column in categorical_features]
    return frame, categorical_features, categorical_indices


def _catboost_params(iterations: int, threads: int, early_stopping_rounds: int) -> dict:
    return {
        "loss_function": "RMSE",
        "eval_metric": "RMSE",
        "iterations": iterations,
        "learning_rate": 0.03,
        "depth": 8,
        "l2_leaf_reg": 8.0,
        "random_seed": RANDOM_STATE,
        "thread_count": threads,
        "verbose": False,
        "allow_writing_files": False,
        "early_stopping_rounds": early_stopping_rounds,
    }


def _fit_catboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_eval: pd.DataFrame,
    y_eval: pd.Series,
    features: list[str],
    *,
    iterations: int,
    threads: int,
    early_stopping_rounds: int,
) -> tuple[CatBoostRegressor, list[str], float]:
    train_frame, categorical_features, categorical_indices = _prepare_for_catboost(
        X_train,
        features,
    )
    eval_frame, _, _ = _prepare_for_catboost(X_eval, features)
    model = CatBoostRegressor(
        **_catboost_params(
            iterations=iterations,
            threads=threads,
            early_stopping_rounds=early_stopping_rounds,
        )
    )
    model.fit(
        train_frame,
        y_train,
        cat_features=categorical_indices,
        eval_set=(eval_frame, y_eval),
        use_best_model=True,
    )
    predictions = model.predict(eval_frame)
    rmse = math.sqrt(mean_squared_error(y_eval, predictions))
    return model, categorical_features, rmse


def _evaluate_raw(
    y_true_log: pd.Series,
    predicted_log: np.ndarray,
) -> dict[str, float]:
    y_true = np.expm1(y_true_log)
    y_pred = np.clip(np.expm1(predicted_log), a_min=0, a_max=None)
    ape = (np.abs(y_pred - y_true) / y_true) * 100
    return {
        "log_rmse": float(math.sqrt(mean_squared_error(y_true_log, predicted_log))),
        "mae_aed_per_sqm": float(mean_absolute_error(y_true, y_pred)),
        "rmse_aed_per_sqm": float(math.sqrt(mean_squared_error(y_true, y_pred))),
        "r2_raw": float(r2_score(y_true, y_pred)),
        "median_absolute_percentage_error_pct": float(np.median(ape)),
        "p90_absolute_percentage_error_pct": float(np.percentile(ape, 90)),
    }


def build_training_table(raw: pd.DataFrame, rare_min_count: int) -> pd.DataFrame:
    frame = raw.copy()
    frame["transaction_type_clean"] = _category(frame, "transaction_type").str.lower()
    frame["usage_clean"] = _category(frame, "usage").str.lower()
    frame[TARGET_COLUMN] = _number(frame, TARGET_COLUMN)
    frame["size_sqm"] = _number(frame, "size_sqm")

    clean_mask = (
        frame["transaction_type_clean"].eq("sales")
        & frame["usage_clean"].eq("residential")
        & frame["size_sqm"].between(20, 2000)
        & frame[TARGET_COLUMN].between(1000, 100000)
    )
    frame = frame.loc[clean_mask].copy()
    frame[LOG_TARGET_COLUMN] = np.log1p(frame[TARGET_COLUMN])

    features = pd.DataFrame(index=frame.index)
    features["area_grouped"] = _group_rare(_category(frame, "area"), rare_min_count)
    features["property_type_grouped"] = _group_rare(
        _category(frame, "property_type"),
        rare_min_count,
    )
    features["property_sub_type_grouped"] = _group_rare(
        _category(frame, "property_sub_type"),
        rare_min_count,
    )
    features["asset_type_grouped"] = _group_rare(
        _category(frame, "asset_type"),
        rare_min_count,
    )
    features["transaction_sub_type_grouped"] = _group_rare(
        _category(frame, "transaction_sub_type"),
        rare_min_count,
    )
    features["registration_type"] = _category(frame, "registration_type")
    features["is_freehold"] = _category(frame, "is_freehold")
    features["size_sqm"] = frame["size_sqm"]
    features["log_size_sqm"] = np.log1p(frame["size_sqm"])
    features["size_bucket"] = frame["size_sqm"].map(_size_bucket)
    features["bedrooms"] = _number(frame, "bedrooms", default=np.nan)
    features["bedroom_bucket"] = features["bedrooms"].map(_bedroom_bucket)
    features["parking_count_clean"] = _category(frame, "parking", default="").map(_parking_count)
    features["has_parking"] = features["parking_count_clean"].fillna(0) > 0
    features["buyer_count"] = _number(frame, "buyer_count")
    features["seller_count"] = _number(frame, "seller_count")
    features["transaction_month"] = _number(frame, "transaction_month")
    features["transaction_quarter"] = _number(frame, "transaction_quarter")
    features["nearest_metro_grouped"] = _group_rare(
        _category(frame, "nearest_metro"),
        rare_min_count,
    )
    features["nearest_mall_grouped"] = _group_rare(
        _category(frame, "nearest_mall"),
        rare_min_count,
    )
    features["nearest_landmark_grouped"] = _group_rare(
        _category(frame, "nearest_landmark"),
        rare_min_count,
    )
    features["project_grouped"] = _group_rare(_category(frame, "project"), rare_min_count)

    table = pd.concat(
        [
            frame[
                [
                    "transaction_id",
                    "transaction_date",
                    "amount_aed",
                    TARGET_COLUMN,
                    LOG_TARGET_COLUMN,
                ]
            ].reset_index(drop=True),
            features.reset_index(drop=True),
        ],
        axis=1,
    )
    return table


def run_training(args: argparse.Namespace) -> dict[str, Any]:
    input_path = _resolve(args.input)
    if not input_path.exists():
        prepare_kaggle_datasets(
            input_dir=_resolve(args.kaggle_dir),
            processed_dir=PROCESSED_DIR,
            report_path=OUTPUT_DIR / "kaggle_data_quality_report.json",
        )
    if not input_path.exists():
        raise FileNotFoundError(f"Missing normalized Kaggle transactions: {input_path}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(input_path, low_memory=False)
    table = build_training_table(raw, rare_min_count=args.rare_min_count)
    if len(table) < 100:
        raise ValueError(f"Only {len(table)} clean rows available for training.")

    TABLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(TABLE_PATH, index=False)

    feature_columns = [column for column in CANDIDATE_FEATURES if column in table.columns]
    missing_mandatory = [column for column in MANDATORY_FEATURES if column not in feature_columns]
    if missing_mandatory:
        raise ValueError(f"Missing mandatory SFS features: {', '.join(missing_mandatory)}")

    X = table[feature_columns].copy()
    y_log = table[LOG_TARGET_COLUMN].copy()
    X_train_full, X_test, y_train_full, y_test = _split(X, y_log, test_size=0.2)
    X_fit, X_valid, y_fit, y_valid = _split(X_train_full, y_train_full, test_size=0.25)

    config = MODE_CONFIGS[args.mode].copy()
    if args.max_features is not None:
        config["max_features"] = args.max_features
    if args.sfs_sample_rows is not None:
        config["sfs_sample_rows"] = args.sfs_sample_rows

    X_sfs, y_sfs = _sample_for_sfs(X_fit, y_fit, config["sfs_sample_rows"])
    X_valid_sfs, y_valid_sfs = _sample_for_sfs(
        X_valid,
        y_valid,
        min(len(X_valid), int(config["sfs_sample_rows"] * 0.35))
        if config["sfs_sample_rows"]
        else None,
    )

    selected = [feature for feature in MANDATORY_FEATURES if feature in feature_columns]
    remaining = [feature for feature in feature_columns if feature not in selected]
    _, _, best_score = _fit_catboost(
        X_sfs,
        y_sfs,
        X_valid_sfs,
        y_valid_sfs,
        selected,
        iterations=config["sfs_iterations"],
        threads=args.threads,
        early_stopping_rounds=config["early_stopping_rounds"],
    )

    history: list[dict[str, Any]] = [
        {
            "round": 0,
            "selected_feature": None,
            "features": selected.copy(),
            "validation_log_rmse": float(best_score),
            "improvement": None,
        }
    ]
    weak_rounds = 0
    round_number = 1

    while remaining and len(selected) < int(config["max_features"]):
        candidates: list[tuple[str, float]] = []
        for feature in remaining:
            _, _, score = _fit_catboost(
                X_sfs,
                y_sfs,
                X_valid_sfs,
                y_valid_sfs,
                [*selected, feature],
                iterations=config["sfs_iterations"],
                threads=args.threads,
                early_stopping_rounds=config["early_stopping_rounds"],
            )
            candidates.append((feature, score))

        best_feature, candidate_score = min(candidates, key=lambda item: item[1])
        improvement = best_score - candidate_score
        selected.append(best_feature)
        remaining.remove(best_feature)

        if improvement < float(config["min_improvement"]):
            weak_rounds += 1
        else:
            weak_rounds = 0
            best_score = candidate_score

        history.append(
            {
                "round": round_number,
                "selected_feature": best_feature,
                "features": selected.copy(),
                "validation_log_rmse": float(candidate_score),
                "improvement": float(improvement),
                "weak_rounds": weak_rounds,
            }
        )
        print(
            f"SFS round {round_number}: add {best_feature}, "
            f"log RMSE {candidate_score:.5f}, improvement {improvement:.5f}"
        )
        round_number += 1

        if weak_rounds >= 2:
            break

    final_model, categorical_features, validation_log_rmse = _fit_catboost(
        X_fit,
        y_fit,
        X_valid,
        y_valid,
        selected,
        iterations=config["final_iterations"],
        threads=args.threads,
        early_stopping_rounds=config["early_stopping_rounds"],
    )

    test_frame, _, _ = _prepare_for_catboost(X_test, selected)
    test_pred_log = final_model.predict(test_frame)
    metrics = _evaluate_raw(y_test, test_pred_log)
    metrics.update(
        {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "raw_rows": int(len(raw)),
            "clean_rows": int(len(table)),
            "train_rows": int(len(X_fit)),
            "validation_rows": int(len(X_valid)),
            "test_rows": int(len(X_test)),
            "target": TARGET_COLUMN,
            "training_target": LOG_TARGET_COLUMN,
            "model_family": "catboost",
            "validation_log_rmse": float(validation_log_rmse),
            "selected_features": selected,
            "categorical_features": categorical_features,
            "rejected_or_leakage_columns": LEAKAGE_COLUMNS,
            "filters": {
                "transaction_type": "Sales",
                "usage": "Residential",
                "size_sqm": [20, 2000],
                "price_per_sqm": [1000, 100000],
            },
            "catboost_params": _catboost_params(
                iterations=config["final_iterations"],
                threads=args.threads,
                early_stopping_rounds=config["early_stopping_rounds"],
            ),
        }
    )

    wrapped_model = KagglePricePerSqmModel(
        model=final_model,
        feature_columns=selected,
        categorical_features=categorical_features,
        metadata=metrics,
    )
    joblib.dump(wrapped_model, MODEL_PATH)

    test_predictions = table.loc[X_test.index, ["transaction_id", TARGET_COLUMN]].copy()
    test_predictions["predicted_price_per_sqm"] = np.clip(
        np.expm1(test_pred_log),
        a_min=0,
        a_max=None,
    )
    test_predictions["absolute_percentage_error_pct"] = (
        (
            test_predictions["predicted_price_per_sqm"]
            - test_predictions[TARGET_COLUMN]
        ).abs()
        / test_predictions[TARGET_COLUMN]
        * 100
    )
    test_predictions.to_csv(TEST_PREDICTIONS_PATH, index=False)

    feature_selection = {
        "generated_at": metrics["generated_at"],
        "mode": args.mode,
        "sfs_sample_rows": int(len(X_sfs)),
        "sfs_validation_rows": int(len(X_valid_sfs)),
        "candidate_features": feature_columns,
        "mandatory_features": MANDATORY_FEATURES,
        "selected_features": selected,
        "history": history,
    }
    with FEATURE_SELECTION_PATH.open("w", encoding="utf-8") as file:
        json.dump(feature_selection, file, indent=2)
    with METRICS_PATH.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    print("Kaggle CatBoost SFS complete")
    print(f"Selected features: {', '.join(selected)}")
    print(f"Test MAE: {metrics['mae_aed_per_sqm']:.2f} AED/sqm")
    print(f"Test R2: {metrics['r2_raw']:.3f}")
    print(f"Saved model to {MODEL_PATH}")
    return metrics


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train a Kaggle Dubai price-per-sqm CatBoost model with SFS.",
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH)
    parser.add_argument("--kaggle-dir", type=Path, default=ROOT_DIR / "Kaggle_Data")
    parser.add_argument("--mode", choices=sorted(MODE_CONFIGS), default="balanced")
    parser.add_argument("--threads", type=int, default=-1)
    parser.add_argument("--rare-min-count", type=int, default=50)
    parser.add_argument("--max-features", type=int)
    parser.add_argument("--sfs-sample-rows", type=int)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    run_training(args)


if __name__ == "__main__":
    main()
