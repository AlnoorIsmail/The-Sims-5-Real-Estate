from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.api_client import fetch_areas, fetch_listings
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


RAW_DIR = ROOT_DIR / "data" / "raw"
OUTPUT_DIR = ROOT_DIR / "outputs"
MODEL_DIR = ROOT_DIR / "models"

RAW_LISTINGS_JSON = RAW_DIR / "api_listings_raw.json"
RAW_AREAS_CSV = RAW_DIR / "api_areas_raw.csv"

PRICE_MODEL_PATH = MODEL_DIR / "price_per_sqm_catboost_regressor.joblib"
VALUE_MODEL_PATH = MODEL_DIR / "estimated_value_aed_xgb_regressor.joblib"
POTENTIAL_MODEL_PATH = MODEL_DIR / "development_potential_score_catboost_regressor.joblib"


def _load_cached_json_rows(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, list):
        raise RuntimeError(f"Expected cached API rows to be a JSON list: {path}")
    return pd.json_normalize(payload)


def _load_or_fetch_listings(args: argparse.Namespace) -> pd.DataFrame:
    cached = None if args.refresh else _load_cached_json_rows(RAW_LISTINGS_JSON)
    if cached is not None:
        record_metric("listings_source", "cache")
        return cached

    record_metric("listings_source", "live_api")
    return fetch_listings(
        transaction_type=args.transaction_type,
        emirate=args.emirate,
        max_pages=args.max_pages,
        page_size=args.page_size,
    )


def _load_or_fetch_areas(refresh: bool) -> pd.DataFrame | None:
    if not refresh and RAW_AREAS_CSV.exists():
        record_metric("areas_source", "cache")
        return pd.read_csv(RAW_AREAS_CSV)

    try:
        record_metric("areas_source", "live_api")
        return fetch_areas()
    except RuntimeError as exc:
        record_metric("areas_source", "unavailable")
        record_warning(
            f"Area metadata was not fetched; continuing without area enrichment. {exc}",
            "raw_fetch",
        )
        return None


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


def calculate_api_opportunity_score(
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
        "api_opportunity_score": score,
        "api_recommendation": recommendation,
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
        predictions[f"{output_column}_status"] = "skipped_incompatible_api_rows"
        for warning in warnings:
            record_warning(f"Skipped {output_column}; {warning}", "model_compatibility")
        return predictions

    model_features = _expected_features(model, fallback_features)
    predictions[output_column] = model.predict(predictions.reindex(columns=model_features))
    predictions[f"{output_column}_status"] = "predicted"
    return predictions


def run_pipeline(args: argparse.Namespace) -> pd.DataFrame:
    reset_quality_report()

    raw = _load_or_fetch_listings(args)
    gate_non_empty(raw, "api_listings_raw")
    gate_required_columns(raw, ["price", "built_up_area_sqm"])

    areas = _load_or_fetch_areas(args.refresh)
    cleaned = clean_api_listings(raw, areas)
    gate_non_empty(cleaned, "api_listings_clean")
    gate_min_valid_rows(cleaned, min_rows=args.min_rows)

    mapped = map_area_to_district(cleaned)
    gate_district_mapping_coverage(mapped, min_coverage=args.min_mapping_coverage)

    districts = _load_district_context()
    features = build_api_listing_features(mapped, districts)

    price_model = _load_required_model(PRICE_MODEL_PATH, "transaction price")
    price_features = _expected_features(price_model, TRANSACTION_FEATURE_COLUMNS)
    gate_model_feature_contract(features, price_features)

    valid_mask = (~features["district_unmapped"]) & (
        pd.to_numeric(features["district_mapping_confidence"], errors="coerce").fillna(0)
        >= 0.80
    )
    valid_features = features.loc[valid_mask].copy()
    if valid_features.empty:
        message = "No API rows passed the district confidence gate for scoring."
        record_error(message, "scoring_rows")
        raise DataGateError(message)

    compatible, warnings = check_model_compatibility(price_model, valid_features)
    if not compatible:
        for warning in warnings:
            record_error(f"Transaction price model is incompatible: {warning}")
        raise DataGateError("Transaction price model cannot score API listing rows.")

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
        lambda row: calculate_api_opportunity_score(
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
        by=["api_opportunity_score", "price_gap_pct"],
        ascending=[False, False],
    ).head(10)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(OUTPUT_DIR / "api_listing_predictions.csv", index=False)
    top_opportunities.to_csv(OUTPUT_DIR / "api_top_opportunities.csv", index=False)

    record_metric("scored_rows", int(len(predictions)))
    record_metric(
        "top_api_opportunity_score",
        _safe_float(top_opportunities["api_opportunity_score"].iloc[0])
        if not top_opportunities.empty
        else None,
    )
    save_quality_report()

    print("Top API listing opportunities")
    display_columns = [
        "area",
        "district",
        "price",
        "price_per_sqm_observed",
        "predicted_price_per_sqm",
        "price_gap_pct",
        "deal_signal",
        "api_opportunity_score",
        "api_recommendation",
    ]
    present_columns = [
        column for column in display_columns if column in top_opportunities.columns
    ]
    print(top_opportunities[present_columns].to_string(index=False))
    print(f"Saved predictions to {OUTPUT_DIR / 'api_listing_predictions.csv'}")
    print(f"Saved top opportunities to {OUTPUT_DIR / 'api_top_opportunities.csv'}")
    print(f"Saved data quality report to {OUTPUT_DIR / 'api_data_quality_report.json'}")

    return predictions


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the gated external UAE listings API scoring pipeline.",
    )
    parser.add_argument("--refresh", action="store_true", help="Fetch live API data.")
    parser.add_argument("--transaction-type", default=None)
    parser.add_argument("--emirate", default="Abu Dhabi")
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--min-rows", type=int, default=50)
    parser.add_argument("--min-mapping-coverage", type=float, default=0.60)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    try:
        run_pipeline(args)
    except (DataGateError, RuntimeError) as exc:
        record_error(str(exc), "api_predict_and_score")
        save_quality_report(status="failed")
        print(f"API gated pipeline failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
