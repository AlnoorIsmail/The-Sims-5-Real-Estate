from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.data_loader import load_all_data
from ml_pipeline.feature_builder import (
    DEVELOPMENT_TARGET,
    PARCEL_FEATURE_COLUMNS,
    PARCEL_VALUE_TARGET,
    TRANSACTION_FEATURE_COLUMNS,
    build_parcel_table,
    build_transaction_table,
)
from ml_pipeline.roi_logic import calculate_real_estate_feasibility


MODEL_DIR = ROOT_DIR / "models"
OUTPUT_DIR = ROOT_DIR / "outputs"


def _load_or_build_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    transaction_path = OUTPUT_DIR / "transaction_model_table.csv"
    parcel_path = OUTPUT_DIR / "parcel_model_table.csv"

    if transaction_path.exists() and parcel_path.exists():
        return pd.read_csv(transaction_path), pd.read_csv(parcel_path)

    data = load_all_data()
    transaction_table = build_transaction_table(data)
    parcel_table = build_parcel_table(data)
    OUTPUT_DIR.mkdir(exist_ok=True)
    transaction_table.to_csv(transaction_path, index=False)
    parcel_table.to_csv(parcel_path, index=False)
    return transaction_table, parcel_table


def _expected_features(model: object, fallback: list[str], table: pd.DataFrame) -> list[str]:
    if hasattr(model, "feature_names_in_"):
        return list(model.feature_names_in_)

    preprocessor = getattr(model, "named_steps", {}).get("preprocessor")
    if preprocessor is not None and hasattr(preprocessor, "feature_names_in_"):
        return list(preprocessor.feature_names_in_)
    return [column for column in fallback if column in table.columns]


def _model_input(row: pd.Series, feature_columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame([row]).reindex(columns=feature_columns)


def _numeric(row: pd.Series, column: str, default: float = 0.0) -> float:
    value = pd.to_numeric(row.get(column, default), errors="coerce")
    if pd.isna(value):
        return default
    return float(value)


def main() -> None:
    price_model = joblib.load(MODEL_DIR / "price_per_sqm_catboost_regressor.joblib")
    value_model = joblib.load(MODEL_DIR / "estimated_value_aed_xgb_regressor.joblib")
    potential_model = joblib.load(
        MODEL_DIR / "development_potential_score_catboost_regressor.joblib"
    )

    transaction_table, parcel_table = _load_or_build_tables()

    if DEVELOPMENT_TARGET in parcel_table.columns:
        selected_parcel = parcel_table.sort_values(
            by=DEVELOPMENT_TARGET,
            ascending=False,
        ).iloc[0]
    else:
        selected_parcel = parcel_table.iloc[0]

    district = str(selected_parcel.get("district", "Unknown"))
    matching_transactions = transaction_table[
        transaction_table.get("district", pd.Series(dtype=str)).astype(str) == district
    ]
    price_source = (
        matching_transactions.iloc[0].copy()
        if not matching_transactions.empty
        else transaction_table.iloc[0].copy()
    )
    price_source["district"] = district

    if "size_sqm" in transaction_table.columns and "parcel_size_sqm" in selected_parcel:
        price_source["size_sqm"] = selected_parcel["parcel_size_sqm"]

    for context_column in (
        "area_type",
        "profile",
        "base_sale_aed_sqm",
        "gross_yield_pct",
        "infrastructure_score",
        "established_year",
    ):
        if context_column in selected_parcel:
            price_source[context_column] = selected_parcel[context_column]

    price_features = _expected_features(
        price_model,
        TRANSACTION_FEATURE_COLUMNS,
        transaction_table,
    )
    parcel_features = _expected_features(value_model, PARCEL_FEATURE_COLUMNS, parcel_table)
    potential_features = _expected_features(
        potential_model,
        PARCEL_FEATURE_COLUMNS,
        parcel_table,
    )

    predicted_price_per_sqm = float(
        price_model.predict(_model_input(price_source, price_features))[0]
    )
    predicted_estimated_value_aed = float(
        value_model.predict(_model_input(selected_parcel, parcel_features))[0]
    )
    predicted_development_potential_score = float(
        potential_model.predict(_model_input(selected_parcel, potential_features))[0]
    )

    acquisition_cost_aed = predicted_estimated_value_aed * 0.70
    development_cost_aed = predicted_estimated_value_aed * 0.20

    decision = calculate_real_estate_feasibility(
        predicted_price_per_sqm=predicted_price_per_sqm,
        predicted_estimated_value_aed=predicted_estimated_value_aed,
        predicted_development_potential_score=predicted_development_potential_score,
        district_profile=str(selected_parcel.get("profile", "unknown")),
        district_gross_yield_pct=_numeric(selected_parcel, "gross_yield_pct"),
        district_infrastructure_score=_numeric(selected_parcel, "infrastructure_score"),
        acquisition_cost_aed=acquisition_cost_aed,
        development_cost_aed=development_cost_aed,
    )

    decision.update(
        {
            "district": district,
            "parcel_id": selected_parcel.get("parcel_id", selected_parcel.get("id", "sample")),
            "land_use": selected_parcel.get("land_use", "unknown"),
            "current_status": selected_parcel.get("current_status", "unknown"),
            "acquisition_cost_aed": round(acquisition_cost_aed, 2),
            "development_cost_aed": round(development_cost_aed, 2),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_source": "Hugging Face starter-kit CSVs or matching local data/ CSVs",
        }
    )

    OUTPUT_DIR.mkdir(exist_ok=True)
    output_path = OUTPUT_DIR / "sample_roi_decision.json"
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(decision, file, indent=2)

    print("Sample ROI decision")
    print(f"District: {decision['district']}")
    print(f"Parcel: {decision['parcel_id']}")
    print(f"Recommendation: {decision['recommendation']}")
    print(f"Success score: {decision['success_score']}/100")
    print(f"Margin: {decision['margin_pct']}%")
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
