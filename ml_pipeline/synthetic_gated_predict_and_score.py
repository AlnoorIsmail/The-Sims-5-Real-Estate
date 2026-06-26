from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.api_feature_builder import build_api_listing_features
from ml_pipeline.api_gates import (
    DataGateError,
    gate_district_mapping_coverage,
    gate_min_valid_rows,
    gate_model_feature_contract,
    gate_non_empty,
    gate_required_columns,
    record_error,
    record_metric,
    record_warning,
    reset_quality_report,
    save_quality_report,
)
from ml_pipeline.api_preprocessing import clean_api_listings, map_area_to_district
from ml_pipeline.data_loader import load_csv
from ml_pipeline.feature_builder import (
    PARCEL_FEATURE_COLUMNS,
    TRANSACTION_FEATURE_COLUMNS,
)


RAW_PATH = ROOT_DIR / "data" / "raw" / "synthetic_external_listings_raw.csv"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
OUTPUT_DIR = ROOT_DIR / "outputs"
MODEL_DIR = ROOT_DIR / "models"

CLEAN_PATH = PROCESSED_DIR / "synthetic_external_listings_clean.csv"
FEATURES_PATH = PROCESSED_DIR / "synthetic_listing_features.csv"
PREDICTIONS_PATH = OUTPUT_DIR / "synthetic_listing_predictions.csv"
TOP_OPPORTUNITIES_PATH = OUTPUT_DIR / "synthetic_top_opportunities.csv"
REPORT_PATH = OUTPUT_DIR / "synthetic_data_quality_report.json"
METRICS_PATH = OUTPUT_DIR / "synthetic_gated_model_metrics.json"

PRICE_MODEL_PATH = MODEL_DIR / "price_per_sqm_catboost_regressor.joblib"
VALUE_MODEL_PATH = MODEL_DIR / "estimated_value_aed_xgb_regressor.joblib"
POTENTIAL_MODEL_PATH = MODEL_DIR / "development_potential_score_catboost_regressor.joblib"


def _load_raw_listings(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise RuntimeError(
            f"Missing synthetic gated dataset at {path}. Generate it with: "
            "python ml_pipeline/generate_synthetic_external_listings.py "
            "--rows 50000 --seed 20260626"
        )
    record_metric("listings_source", "synthetic_external_csv")
    record_metric("listings_path", str(path))
    return pd.read_csv(path)


def _load_district_context() -> pd.DataFrame:
    local_districts = ROOT_DIR / "data" / "districts.csv"
    if local_districts.exists():
        return pd.read_csv(local_districts)

    for fallback in (
        OUTPUT_DIR / "parcel_model_table.csv",
        OUTPUT_DIR / "transaction_model_table.csv",
    ):
        if fallback.exists():
            frame = pd.read_csv(fallback)
            context_columns = [
                "district",
                "area_type",
                "profile",
                "base_sale_aed_sqm",
                "gross_yield_pct",
                "infrastructure_score",
                "established_year",
            ]
            present = [column for column in context_columns if column in frame.columns]
            return frame[present].drop_duplicates(subset=["district"], keep="first")

    return load_csv("districts.csv")


def _expected_features(model: object, fallback: list[str] | None = None) -> list[str]:
    if hasattr(model, "feature_names_in_"):
        return list(model.feature_names_in_)

    preprocessor = getattr(model, "named_steps", {}).get("preprocessor")
    if preprocessor is not None and hasattr(preprocessor, "feature_names_in_"):
        return list(preprocessor.feature_names_in_)

    return fallback or []


def check_model_compatibility(
    model: object,
    feature_row: pd.DataFrame,
) -> tuple[bool, list[str]]:
    frame = (
        feature_row.to_frame().T
        if isinstance(feature_row, pd.Series)
        else feature_row.copy()
    )
    expected_features = _expected_features(model)
    warnings: list[str] = []

    if not expected_features:
        return False, ["Model does not expose expected feature names."]

    missing = [feature for feature in expected_features if feature not in frame.columns]
    if missing:
        warnings.append(f"Missing model features: {', '.join(missing)}")

    all_null = [
        feature
        for feature in expected_features
        if feature in frame.columns and frame[feature].isna().all()
    ]
    if all_null:
        warnings.append(f"All-null model features: {', '.join(all_null)}")

    return not warnings, warnings


def _safe_float(value: object, default: float = 0.0) -> float:
    numeric = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(numeric):
        return default
    return float(numeric)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _deal_signal(price_gap_pct: float) -> str:
    if price_gap_pct >= 15:
        return "UNDERVALUED"
    if price_gap_pct <= -15:
        return "OVERPRICED"
    return "FAIR_VALUE"


def calculate_synthetic_opportunity_score(
    price_gap_pct: float,
    district_gross_yield_pct: float,
    district_infrastructure_score: float,
    district_profile: str,
    mapping_confidence: float,
) -> dict:
    deal_signal = _deal_signal(price_gap_pct)
    price_gap_score = _clamp(((price_gap_pct + 15) / 30) * 100)
    yield_score = _clamp((district_gross_yield_pct / 8) * 100)
    infrastructure_score = _clamp(district_infrastructure_score)
    mapping_confidence_score = _clamp(mapping_confidence * 100)

    score = (
        0.45 * price_gap_score
        + 0.25 * yield_score
        + 0.20 * infrastructure_score
        + 0.10 * mapping_confidence_score
    )

    profile = str(district_profile or "unknown").strip().lower()
    if profile in {"premium", "high", "high_value"}:
        score += 5
    elif profile in {"established", "mid_high"}:
        score += 3
    elif profile in {"industrial", "leisure", "innovation"}:
        score -= 2

    warnings: list[str] = []
    if mapping_confidence < 1.0:
        score *= max(mapping_confidence, 0.0)
        warnings.append("District mapping confidence downweighted the score.")
    if profile == "unknown":
        warnings.append("District profile is unknown.")

    score = round(_clamp(score), 2)
    if score >= 75 and deal_signal == "UNDERVALUED":
        recommendation = "BUY_CANDIDATE"
    elif score >= 55:
        recommendation = "WATCHLIST"
    else:
        recommendation = "SKIP"

    return {
        "synthetic_opportunity_score": score,
        "synthetic_recommendation": recommendation,
        "deal_signal": deal_signal,
        "reason": (
            f"{deal_signal}: price gap {price_gap_pct:.1f}%, "
            f"yield {district_gross_yield_pct:.1f}%, "
            f"infrastructure {district_infrastructure_score:.1f}, "
            f"profile {profile or 'unknown'}."
        ),
        "warnings": warnings,
    }


def _load_required_model(path: Path, model_name: str) -> object:
    if not path.exists():
        raise RuntimeError(
            f"Missing {model_name} model at {path}. Run "
            "python ml_pipeline/train_models.py first."
        )
    return joblib.load(path)


def _maybe_add_optional_model_predictions(
    predictions: pd.DataFrame,
    model_path: Path,
    output_column: str,
    fallback_features: list[str],
) -> pd.DataFrame:
    if not model_path.exists():
        predictions[f"{output_column}_status"] = "skipped_missing_model"
        record_warning(f"Skipped {output_column}; model file is missing: {model_path}")
        return predictions

    model = joblib.load(model_path)
    compatible, warnings = check_model_compatibility(model, predictions)
    if not compatible:
        predictions[f"{output_column}_status"] = "skipped_incompatible_listing_rows"
        for warning in warnings:
            record_warning(f"Skipped {output_column}; {warning}", "model_compatibility")
        return predictions

    model_features = _expected_features(model, fallback_features)
    predictions[output_column] = model.predict(predictions.reindex(columns=model_features))
    predictions[f"{output_column}_status"] = "predicted"
    return predictions


def _model_metrics(
    predictions: pd.DataFrame,
    raw_rows: int,
    cleaned_rows: int,
    mapped_coverage: float,
) -> dict[str, Any]:
    targets = {
        "price_per_sqm": {
            "label_column": "synthetic_fair_price_per_sqm",
            "prediction_column": "predicted_price_per_sqm",
            "model": "price_per_sqm_catboost_regressor.joblib",
        },
        "estimated_value_aed": {
            "label_column": "synthetic_estimated_value_aed",
            "prediction_column": "predicted_estimated_value_aed",
            "model": "estimated_value_aed_xgb_regressor.joblib",
        },
        "development_potential_score": {
            "label_column": "synthetic_development_potential_score",
            "prediction_column": "predicted_development_potential_score",
            "model": "development_potential_score_catboost_regressor.joblib",
        },
    }

    target_metrics: dict[str, dict[str, Any]] = {}
    for target, spec in targets.items():
        truth = pd.to_numeric(
            predictions.get(spec["label_column"]),
            errors="coerce",
        )
        predicted = pd.to_numeric(
            predictions.get(spec["prediction_column"]),
            errors="coerce",
        )
        valid = truth.notna() & predicted.notna() & (truth > 0)
        if valid.sum() == 0:
            target_metrics[target] = {
                "model": spec["model"],
                "label_column": spec["label_column"],
                "prediction_column": spec["prediction_column"],
                "metric_rows": 0,
                "status": "missing_prediction_or_label",
            }
            continue

        y_true = truth.loc[valid]
        y_pred = predicted.loc[valid]
        ape = ((y_pred - y_true).abs() / y_true) * 100
        target_metrics[target] = {
            "model": spec["model"],
            "label_column": spec["label_column"],
            "prediction_column": spec["prediction_column"],
            "metric_rows": int(valid.sum()),
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "r2": float(r2_score(y_true, y_pred)) if valid.sum() > 1 else None,
            "median_absolute_percentage_error_pct": float(ape.median()),
        }

    if target_metrics["price_per_sqm"].get("metric_rows", 0) == 0:
        raise DataGateError("No rows have synthetic fair price labels for metrics.")

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "synthetic_external_listings_raw.csv",
        "raw_rows": int(raw_rows),
        "cleaned_rows": int(cleaned_rows),
        "mapped_coverage": round(float(mapped_coverage), 4),
        "scored_rows": int(len(predictions)),
        "targets": target_metrics,
    }


def run_pipeline(args: argparse.Namespace) -> pd.DataFrame:
    reset_quality_report()
    raw_path = Path(args.input)
    if not raw_path.is_absolute():
        raw_path = ROOT_DIR / raw_path

    raw = _load_raw_listings(raw_path)
    gate_non_empty(raw, "synthetic_external_listings_raw")
    gate_required_columns(raw, ["price", "built_up_area_sqm"])

    cleaned = clean_api_listings(
        raw,
        areas=None,
        source_label="synthetic_external_listings",
        is_api_data=False,
        output_path=CLEAN_PATH,
    )
    gate_non_empty(cleaned, "synthetic_external_listings_clean")
    gate_min_valid_rows(cleaned, min_rows=args.min_rows)

    mapped = map_area_to_district(cleaned, output_path=CLEAN_PATH)
    gate_district_mapping_coverage(mapped, min_coverage=args.min_mapping_coverage)
    mapping_coverage = float(
        (
            pd.to_numeric(
                mapped["district_mapping_confidence"],
                errors="coerce",
            ).fillna(0)
            >= 0.80
        ).mean()
    )

    districts = _load_district_context()
    features = build_api_listing_features(
        mapped,
        districts,
        output_path=FEATURES_PATH,
    )

    price_model = _load_required_model(PRICE_MODEL_PATH, "transaction price")
    price_features = _expected_features(price_model, TRANSACTION_FEATURE_COLUMNS)
    gate_model_feature_contract(features, price_features)

    valid_mask = (
        (~features["district_unmapped"])
        & (
            pd.to_numeric(
                features["district_mapping_confidence"],
                errors="coerce",
            ).fillna(0)
            >= 0.80
        )
        & (features["transaction_type_clean"].astype(str).str.lower() == "sale")
        & (
            pd.to_numeric(
                features["price_per_sqm_observed"],
                errors="coerce",
            ).fillna(0)
            >= 2500
        )
    )
    valid_features = features.loc[valid_mask].copy()
    record_metric("sale_compatible_scoring_rows", int(len(valid_features)))
    if valid_features.empty:
        message = "No synthetic rows passed mapping and sale-compatibility gates."
        record_error(message, "scoring_rows")
        raise DataGateError(message)

    compatible, warnings = check_model_compatibility(price_model, valid_features)
    if not compatible:
        for warning in warnings:
            record_error(f"Transaction price model is incompatible: {warning}")
        raise DataGateError("Transaction price model cannot score synthetic rows.")

    predictions = valid_features.copy()
    predictions["predicted_price_per_sqm"] = price_model.predict(
        valid_features.reindex(columns=price_features)
    )
    predictions["price_gap_pct"] = (
        (
            predictions["predicted_price_per_sqm"]
            - predictions["price_per_sqm_observed"]
        )
        / predictions["price_per_sqm_observed"]
        * 100
    )

    score_rows = predictions.apply(
        lambda row: calculate_synthetic_opportunity_score(
            price_gap_pct=_safe_float(row.get("price_gap_pct")),
            district_gross_yield_pct=_safe_float(row.get("gross_yield_pct")),
            district_infrastructure_score=_safe_float(row.get("infrastructure_score")),
            district_profile=str(row.get("profile", "unknown")),
            mapping_confidence=_safe_float(row.get("district_mapping_confidence")),
        ),
        axis=1,
    )
    score_frame = pd.DataFrame(score_rows.tolist(), index=predictions.index)
    predictions = pd.concat([predictions, score_frame], axis=1)

    predictions = _maybe_add_optional_model_predictions(
        predictions,
        VALUE_MODEL_PATH,
        "predicted_estimated_value_aed",
        PARCEL_FEATURE_COLUMNS,
    )
    predictions = _maybe_add_optional_model_predictions(
        predictions,
        POTENTIAL_MODEL_PATH,
        "predicted_development_potential_score",
        PARCEL_FEATURE_COLUMNS,
    )

    top_opportunities = predictions.sort_values(
        by=["synthetic_opportunity_score", "price_gap_pct"],
        ascending=[False, False],
    ).head(args.top_n)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(PREDICTIONS_PATH, index=False)
    top_opportunities.to_csv(TOP_OPPORTUNITIES_PATH, index=False)

    metrics = _model_metrics(
        predictions=predictions,
        raw_rows=len(raw),
        cleaned_rows=len(cleaned),
        mapped_coverage=mapping_coverage,
    )
    with METRICS_PATH.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    record_metric("scored_rows", int(len(predictions)))
    for target, target_metrics in metrics["targets"].items():
        if "r2" in target_metrics:
            record_metric(f"synthetic_{target}_r2", target_metrics["r2"])
    record_metric(
        "top_synthetic_opportunity_score",
        _safe_float(top_opportunities["synthetic_opportunity_score"].iloc[0])
        if not top_opportunities.empty
        else None,
    )
    save_quality_report(path=REPORT_PATH)

    print("Top synthetic gated listing opportunities")
    display_columns = [
        "area",
        "district",
        "price",
        "price_per_sqm_observed",
        "synthetic_fair_price_per_sqm",
        "predicted_price_per_sqm",
        "synthetic_estimated_value_aed",
        "predicted_estimated_value_aed",
        "synthetic_development_potential_score",
        "predicted_development_potential_score",
        "price_gap_pct",
        "deal_signal",
        "synthetic_opportunity_score",
        "synthetic_recommendation",
    ]
    present_columns = [
        column for column in display_columns if column in top_opportunities.columns
    ]
    print(top_opportunities[present_columns].to_string(index=False))
    print(f"Saved predictions to {PREDICTIONS_PATH}")
    print(f"Saved top opportunities to {TOP_OPPORTUNITIES_PATH}")
    print(f"Saved data quality report to {REPORT_PATH}")
    print(f"Saved synthetic metrics to {METRICS_PATH}")

    return predictions


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the gated synthetic external listings scoring pipeline.",
    )
    parser.add_argument("--input", type=Path, default=RAW_PATH)
    parser.add_argument("--min-rows", type=int, default=50)
    parser.add_argument("--min-mapping-coverage", type=float, default=0.60)
    parser.add_argument("--top-n", type=int, default=10)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        run_pipeline(args)
    except (DataGateError, RuntimeError) as exc:
        record_error(str(exc), "synthetic_gated_predict_and_score")
        save_quality_report(path=REPORT_PATH, status="failed")
        print(f"Synthetic gated pipeline failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
