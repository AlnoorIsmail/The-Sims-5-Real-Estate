from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT_DIR / "Kaggle_Data"
DEFAULT_PROCESSED_DIR = ROOT_DIR / "data" / "processed"
DEFAULT_REPORT_PATH = ROOT_DIR / "outputs" / "kaggle_data_quality_report.json"

SQM_PER_SQFT = 0.09290304


DATASET_SPECS = {
    "transactions_2023_h1": {
        "filename": "transactions-2023-07-02.csv",
        "source_url": "https://www.kaggle.com/datasets/austinpowers/dubai-real-estate-transaction-first-semester-2023",
        "license": "CC0: Public Domain",
        "market": "Dubai",
        "best_use": "price_per_sqm training candidate",
    },
    "dubai_properties_apartments": {
        "filename": "properties_data.csv",
        "source_url": "https://www.kaggle.com/datasets/dataregress/dubai-properties-dataset",
        "license": "CC0: Public Domain",
        "market": "Dubai",
        "best_use": "listing-style gated inference and validation",
    },
    "uae_real_estate_2024": {
        "filename": "uae_real_estate_2024.xls",
        "source_url": "https://www.kaggle.com/datasets/kanchana1990/uae-real-estate-2024-dataset",
        "license": "ODC Attribution License (ODC-By)",
        "market": "Dubai",
        "best_use": "listing-style gated inference and validation",
    },
}


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing Kaggle dataset: {path}")
    return pd.read_csv(path, low_memory=False)


def _to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return " ".join(str(value).strip().split())


def _normalize_key(value: object) -> str:
    return _clean_text(value).lower()


def _parse_bedrooms(value: object) -> float:
    text = _normalize_key(value)
    if not text:
        return np.nan
    if "studio" in text:
        return 0.0
    digits = "".join(character for character in text if character.isdigit() or character == ".")
    if not digits:
        return np.nan
    return float(digits)


def _parse_size_sqft(value: object) -> float:
    text = _clean_text(value).replace(",", "")
    digits = "".join(character for character in text if character.isdigit() or character == ".")
    if not digits:
        return np.nan
    return float(digits)


def _parse_listing_area(address: object) -> str:
    parts = [
        part.strip()
        for part in _clean_text(address).split(",")
        if part.strip()
    ]
    if len(parts) >= 3:
        return parts[-2]
    if len(parts) >= 2:
        return parts[0]
    return parts[0] if parts else ""


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.where(denominator > 0)
    return numerator / denominator


def _quantiles(series: pd.Series) -> dict[str, float | None]:
    values = pd.to_numeric(series, errors="coerce").dropna()
    if values.empty:
        return {"p01": None, "p50": None, "p99": None}
    quantiles = values.quantile([0.01, 0.50, 0.99])
    return {
        "p01": float(quantiles.loc[0.01]),
        "p50": float(quantiles.loc[0.50]),
        "p99": float(quantiles.loc[0.99]),
    }


def _value_counts(series: pd.Series, limit: int = 12) -> dict[str, int]:
    counts = series.fillna("missing").astype(str).value_counts().head(limit)
    return {str(key): int(value) for key, value in counts.items()}


def _write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def normalize_transactions(input_dir: Path, processed_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    spec = DATASET_SPECS["transactions_2023_h1"]
    raw = _read_csv(input_dir / spec["filename"])

    transaction_date = pd.to_datetime(raw["Transaction Date"], errors="coerce")
    amount_aed = _to_number(raw["Amount"])
    size_sqm = _to_number(raw["Property Size (sq.m)"]).combine_first(
        _to_number(raw["Transaction Size (sq.m)"])
    )

    normalized = pd.DataFrame(
        {
            "source_dataset": "kaggle_transactions_2023_h1",
            "source_url": spec["source_url"],
            "source_license": spec["license"],
            "market": spec["market"],
            "transaction_id": raw["Transaction Number"],
            "transaction_date": transaction_date,
            "transaction_year": transaction_date.dt.year,
            "transaction_month": transaction_date.dt.month,
            "transaction_quarter": transaction_date.dt.quarter,
            "transaction_type": raw["Transaction Type"].map(_clean_text),
            "transaction_sub_type": raw["Transaction sub type"].map(_clean_text),
            "registration_type": raw["Registration type"].map(_clean_text),
            "is_freehold": raw["Is Free Hold?"].map(_clean_text),
            "usage": raw["Usage"].map(_clean_text),
            "area": raw["Area"].map(_clean_text),
            "property_type": raw["Property Type"].map(_clean_text),
            "property_sub_type": raw["Property Sub Type"].map(_clean_text),
            "asset_type": raw["Property Sub Type"].fillna(raw["Property Type"]).map(_clean_text),
            "amount_aed": amount_aed,
            "size_sqm": size_sqm,
            "price_per_sqm": _safe_divide(amount_aed, size_sqm),
            "bedrooms": raw["Room(s)"].apply(_parse_bedrooms),
            "parking": raw["Parking"].map(_clean_text),
            "nearest_metro": raw["Nearest Metro"].map(_clean_text),
            "nearest_mall": raw["Nearest Mall"].map(_clean_text),
            "nearest_landmark": raw["Nearest Landmark"].map(_clean_text),
            "project": raw["Project"].map(_clean_text),
            "master_project": raw["Master Project"].map(_clean_text),
            "buyer_count": _to_number(raw["No. of Buyer"]),
            "seller_count": _to_number(raw["No. of Seller"]),
        }
    )

    valid = (
        normalized["amount_aed"].notna()
        & (normalized["amount_aed"] > 0)
        & normalized["size_sqm"].notna()
        & (normalized["size_sqm"] > 0)
        & normalized["price_per_sqm"].notna()
    )
    normalized = normalized.loc[valid].copy()

    output_path = processed_dir / "kaggle_transactions_normalized.csv"
    _write_csv(normalized, output_path)

    sale_mask = normalized["transaction_type"].str.lower().eq("sales")
    report = {
        **spec,
        "raw_rows": int(len(raw)),
        "normalized_rows": int(len(normalized)),
        "sales_rows": int(sale_mask.sum()),
        "residential_rows": int(normalized["usage"].str.lower().eq("residential").sum()),
        "area_count": int(normalized["area"].nunique()),
        "property_sub_type_count": int(normalized["property_sub_type"].nunique()),
        "price_per_sqm_aed_summary": _quantiles(normalized["price_per_sqm"]),
        "transaction_type_counts": _value_counts(normalized["transaction_type"]),
        "usage_counts": _value_counts(normalized["usage"]),
        "output_path": str(output_path.relative_to(ROOT_DIR)),
        "recommendation": (
            "Best Kaggle source for real price-per-sqm training or benchmarking. "
            "Use as Dubai market data; do not label it Abu Dhabi accuracy."
        ),
    }
    return normalized, report


def normalize_dataregress_properties(
    input_dir: Path,
    processed_dir: Path,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    spec = DATASET_SPECS["dubai_properties_apartments"]
    raw = _read_csv(input_dir / spec["filename"])

    size_sqm = _to_number(raw["size_in_sqft"]) * SQM_PER_SQFT
    price = _to_number(raw["price"])
    normalized = pd.DataFrame(
        {
            "source_dataset": "kaggle_dubai_properties_apartments",
            "source_url": spec["source_url"],
            "source_license": spec["license"],
            "market": spec["market"],
            "listing_id": raw["id"].astype(str),
            "area": raw["neighborhood"].map(_clean_text),
            "city": "Dubai",
            "transaction_type": "sale",
            "property_type": "Apartment",
            "price": price,
            "size_sqm": size_sqm,
            "price_per_sqm_observed": _safe_divide(price, size_sqm),
            "bedrooms": _to_number(raw["no_of_bedrooms"]),
            "bathrooms": _to_number(raw["no_of_bathrooms"]),
            "latitude": _to_number(raw["latitude"]),
            "longitude": _to_number(raw["longitude"]),
            "quality": raw["quality"].map(_clean_text),
            "verified": pd.NA,
            "furnishing": np.where(raw["unfurnished"], "unfurnished", "unknown"),
            "title": "",
            "description": "",
        }
    )

    amenity_columns = [
        column
        for column in raw.columns
        if raw[column].dtype == bool and column not in {"unfurnished"}
    ]
    for column in amenity_columns:
        normalized[f"amenity_{column}"] = raw[column]

    valid = (
        normalized["price"].notna()
        & (normalized["price"] > 0)
        & normalized["size_sqm"].notna()
        & (normalized["size_sqm"] > 0)
    )
    normalized = normalized.loc[valid].copy()

    output_path = processed_dir / "kaggle_dubai_properties_normalized.csv"
    _write_csv(normalized, output_path)

    report = {
        **spec,
        "raw_rows": int(len(raw)),
        "normalized_rows": int(len(normalized)),
        "area_count": int(normalized["area"].nunique()),
        "price_per_sqm_aed_summary": _quantiles(normalized["price_per_sqm_observed"]),
        "bedroom_counts": _value_counts(normalized["bedrooms"]),
        "quality_counts": _value_counts(normalized["quality"]),
        "output_path": str(output_path.relative_to(ROOT_DIR)),
        "recommendation": (
            "Clean listing-style validation source with amenities and coordinates. "
            "Small and apartment-only, so keep it out of headline accuracy claims."
        ),
    }
    return normalized, report


def normalize_uae_2024(input_dir: Path, processed_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    spec = DATASET_SPECS["uae_real_estate_2024"]
    raw = _read_csv(input_dir / spec["filename"])

    size_sqft = raw["sizeMin"].apply(_parse_size_sqft)
    size_sqm = size_sqft * SQM_PER_SQFT
    price = _to_number(raw["price"])
    added_on = pd.to_datetime(raw["addedOn"], errors="coerce", utc=True)

    normalized = pd.DataFrame(
        {
            "source_dataset": "kaggle_uae_real_estate_2024",
            "source_url": spec["source_url"],
            "source_license": spec["license"],
            "market": spec["market"],
            "listing_id": "uae2024-" + raw.index.astype(str),
            "listed_at": added_on,
            "area": raw["displayAddress"].apply(_parse_listing_area),
            "display_address": raw["displayAddress"].map(_clean_text),
            "city": "Dubai",
            "transaction_type": raw["priceDuration"].map(_clean_text).str.lower(),
            "property_type": raw["type"].map(_clean_text),
            "price": price,
            "size_sqm": size_sqm,
            "price_per_sqm_observed": _safe_divide(price, size_sqm),
            "bedrooms": _to_number(raw["bedrooms"]),
            "bathrooms": _to_number(raw["bathrooms"]),
            "latitude": pd.NA,
            "longitude": pd.NA,
            "quality": "",
            "verified": raw["verified"],
            "furnishing": raw["furnishing"].map(_clean_text),
            "title": raw["title"].map(_clean_text),
            "description": raw["description"].map(_clean_text),
        }
    )

    valid = (
        normalized["price"].notna()
        & (normalized["price"] > 0)
        & normalized["size_sqm"].notna()
        & (normalized["size_sqm"] > 0)
    )
    normalized = normalized.loc[valid].copy()

    output_path = processed_dir / "kaggle_uae_2024_listings_normalized.csv"
    _write_csv(normalized, output_path)

    report = {
        **spec,
        "raw_rows": int(len(raw)),
        "normalized_rows": int(len(normalized)),
        "area_count": int(normalized["area"].nunique()),
        "price_per_sqm_aed_summary": _quantiles(normalized["price_per_sqm_observed"]),
        "transaction_type_counts": _value_counts(normalized["transaction_type"]),
        "property_type_counts": _value_counts(normalized["property_type"]),
        "verified_counts": _value_counts(normalized["verified"]),
        "output_path": str(output_path.relative_to(ROOT_DIR)),
        "recommendation": (
            "Useful real listing-style feed for gated scoring demos. It is scraped "
            "listing data, so treat observed prices as asking prices, not truth."
        ),
    }
    return normalized, report


def build_report(
    reports: dict[str, dict[str, Any]],
    combined_listing_rows: int,
    combined_listing_path: Path,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "passed",
        "source_directory": str(DEFAULT_INPUT_DIR.relative_to(ROOT_DIR)),
        "datasets": reports,
        "combined_listing_rows": combined_listing_rows,
        "combined_listing_output_path": str(combined_listing_path.relative_to(ROOT_DIR)),
        "overall_recommendation": {
            "train_price_per_sqm_with": "transactions_2023_h1",
            "score_or_validate_listings_with": [
                "dubai_properties_apartments",
                "uae_real_estate_2024",
            ],
            "not_supported_by_these_sources": [
                "Abu Dhabi parcel estimated value accuracy",
                "development potential score accuracy",
                "true ROI labels",
            ],
            "integration_note": (
                "These are Dubai market datasets. They can improve price and listing "
                "workflows, but the ROI contract should keep market/source metadata "
                "explicit and should not present these as Abu Dhabi ground truth."
            ),
        },
    }


def run(input_dir: Path, processed_dir: Path, report_path: Path) -> dict[str, Any]:
    processed_dir.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    transactions, transaction_report = normalize_transactions(input_dir, processed_dir)
    dataregress, dataregress_report = normalize_dataregress_properties(input_dir, processed_dir)
    uae_2024, uae_2024_report = normalize_uae_2024(input_dir, processed_dir)

    common_listing_columns = sorted(set(dataregress.columns).union(uae_2024.columns))
    combined_listings = pd.concat(
        [
            dataregress.reindex(columns=common_listing_columns),
            uae_2024.reindex(columns=common_listing_columns),
        ],
        ignore_index=True,
        sort=False,
    )
    combined_path = processed_dir / "kaggle_external_listings_normalized.csv"
    _write_csv(combined_listings, combined_path)

    report = build_report(
        {
            "transactions_2023_h1": transaction_report,
            "dubai_properties_apartments": dataregress_report,
            "uae_real_estate_2024": uae_2024_report,
        },
        combined_listing_rows=int(len(combined_listings)),
        combined_listing_path=combined_path,
    )
    report["source_directory"] = str(input_dir.relative_to(ROOT_DIR)) if input_dir.is_relative_to(ROOT_DIR) else str(input_dir)

    with report_path.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    print("Prepared Kaggle datasets")
    print(f"- transactions: {len(transactions):,} rows")
    print(f"- DataRegress listings: {len(dataregress):,} rows")
    print(f"- UAE 2024 listings: {len(uae_2024):,} rows")
    print(f"- combined listings: {len(combined_listings):,} rows")
    print(f"Saved report to {report_path}")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Normalize local Kaggle real-estate datasets for ROI ML exploration.",
    )
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--processed-dir", type=Path, default=DEFAULT_PROCESSED_DIR)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    input_dir = args.input_dir if args.input_dir.is_absolute() else ROOT_DIR / args.input_dir
    processed_dir = (
        args.processed_dir
        if args.processed_dir.is_absolute()
        else ROOT_DIR / args.processed_dir
    )
    report_path = args.report if args.report.is_absolute() else ROOT_DIR / args.report
    run(input_dir=input_dir, processed_dir=processed_dir, report_path=report_path)


if __name__ == "__main__":
    main()
