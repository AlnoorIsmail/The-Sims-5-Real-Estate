from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from ml_pipeline.feature_builder import (
    DISTRICT_CONTEXT_COLUMNS,
    TRANSACTION_FEATURE_COLUMNS,
)


ROOT_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"


def _first_present(columns: pd.Index, candidates: tuple[str, ...]) -> str | None:
    normalized = {column.strip().lower(): column for column in columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    return None


def _series_from_first_present(
    frame: pd.DataFrame,
    candidates: tuple[str, ...],
    default: object,
) -> pd.Series:
    column = _first_present(frame.columns, candidates)
    if column is None:
        return pd.Series(default, index=frame.index)
    return frame[column]


def _district_context(districts_df: pd.DataFrame) -> pd.DataFrame:
    districts = districts_df.copy()
    districts.columns = districts.columns.str.strip()
    if "district" not in districts.columns:
        raise ValueError("districts_df must include a district column")

    context_columns = [
        column for column in DISTRICT_CONTEXT_COLUMNS if column in districts.columns
    ]
    return (
        districts[["district", *context_columns]]
        .dropna(subset=["district"])
        .drop_duplicates(subset=["district"], keep="first")
    )


def _add_listing_date_features(features: pd.DataFrame) -> pd.DataFrame:
    date_column = _first_present(
        features.columns,
        ("date", "transaction_date", "listed_at", "created_at", "updated_at"),
    )
    if date_column is not None:
        dates = pd.to_datetime(features[date_column], errors="coerce", utc=True)
    else:
        now = datetime.now(timezone.utc)
        dates = pd.Series(pd.Timestamp(now), index=features.index)

    missing_dates = dates.isna()
    if missing_dates.any():
        dates = dates.fillna(pd.Timestamp(datetime.now(timezone.utc)))

    features["transaction_year"] = dates.dt.year
    features["transaction_month"] = dates.dt.month
    features["transaction_quarter"] = dates.dt.quarter
    return features


def build_api_listing_features(
    clean_api_df: pd.DataFrame,
    districts_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build transaction-model-compatible features from cleaned API listings."""

    features = clean_api_df.copy()
    district_context = _district_context(districts_df)
    features = features.merge(
        district_context,
        on="district",
        how="left",
        suffixes=("", "_district"),
    )

    for column in DISTRICT_CONTEXT_COLUMNS:
        district_column = f"{column}_district"
        if district_column in features.columns:
            features[column] = features[column].combine_first(features[district_column])
            features = features.drop(columns=[district_column])

    features["size_sqm"] = pd.to_numeric(
        features.get("built_up_area_sqm"),
        errors="coerce",
    )
    features["price_per_sqm_observed"] = pd.to_numeric(
        features.get("price_per_sqm_observed"),
        errors="coerce",
    )
    features["asset_type"] = _series_from_first_present(
        features,
        ("asset_type", "property_type", "property_subtype", "unit_type"),
        "listing",
    ).fillna("listing")
    features["buyer_type"] = _series_from_first_present(
        features,
        ("buyer_type", "buyer_category"),
        "unknown",
    ).fillna("unknown")

    features = _add_listing_date_features(features)

    context_defaults = {
        "area_type": "unknown",
        "profile": "unknown",
        "base_sale_aed_sqm": features["price_per_sqm_observed"],
        "gross_yield_pct": 0.0,
        "infrastructure_score": 0.0,
        "established_year": features["transaction_year"],
    }
    for column, default in context_defaults.items():
        if column not in features.columns:
            features[column] = default
        else:
            features[column] = features[column].fillna(default)

    for column in (
        "district",
        "area",
        "transaction_type_clean",
        "source",
        "is_api_data",
    ):
        if column not in features.columns:
            features[column] = "unknown"

    ordered_columns = [
        *[column for column in TRANSACTION_FEATURE_COLUMNS if column in features.columns],
        "price",
        "price_per_sqm_observed",
        "transaction_type_clean",
        "area",
        "source",
        "is_api_data",
        "district_mapping_confidence",
        "district_unmapped",
    ]
    remaining_columns = [
        column for column in features.columns if column not in ordered_columns
    ]
    features = features[[*ordered_columns, *remaining_columns]]

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    features.to_csv(PROCESSED_DIR / "api_listing_features.csv", index=False)
    return features
