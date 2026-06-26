from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT_DIR / "outputs"
REPORT_PATH = OUTPUT_DIR / "api_data_quality_report.json"


class DataGateError(RuntimeError):
    """Raised when a gate determines the API data cannot be used at all."""


def _new_report() -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "gates": [],
        "warnings": [],
        "errors": [],
        "metrics": {},
    }


_REPORT: dict[str, Any] = _new_report()


def reset_quality_report() -> None:
    global _REPORT
    _REPORT = _new_report()


def record_metric(name: str, value: Any) -> None:
    _REPORT["metrics"][name] = value


def record_warning(message: str, gate: str | None = None) -> None:
    entry = {"message": message}
    if gate:
        entry["gate"] = gate
    _REPORT["warnings"].append(entry)


def record_error(message: str, gate: str | None = None) -> None:
    entry = {"message": message}
    if gate:
        entry["gate"] = gate
    _REPORT["errors"].append(entry)


def _record_gate(
    name: str,
    status: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> None:
    entry: dict[str, Any] = {
        "name": name,
        "status": status,
        "message": message,
    }
    if details:
        entry["details"] = details
    _REPORT["gates"].append(entry)


def get_quality_report() -> dict[str, Any]:
    return _REPORT


def save_quality_report(path: str | Path = REPORT_PATH, status: str | None = None) -> None:
    if status:
        _REPORT["status"] = status
    elif _REPORT["errors"]:
        _REPORT["status"] = "failed"
    elif _REPORT["warnings"]:
        _REPORT["status"] = "passed_with_warnings"
    else:
        _REPORT["status"] = "passed"

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(_REPORT, file, indent=2)


def gate_non_empty(df: pd.DataFrame, source_name: str) -> None:
    row_count = int(len(df))
    record_metric(f"{source_name}_rows", row_count)
    if df.empty:
        message = f"{source_name} returned no rows."
        record_error(message, "non_empty")
        _record_gate("non_empty", "failed", message, {"source_name": source_name})
        raise DataGateError(message)

    _record_gate(
        "non_empty",
        "passed",
        f"{source_name} contains {row_count} rows.",
        {"source_name": source_name, "row_count": row_count},
    )


def gate_required_columns(df: pd.DataFrame, required_columns: list[str]) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        message = f"Missing required columns: {', '.join(missing)}"
        record_error(message, "required_columns")
        _record_gate(
            "required_columns",
            "failed",
            message,
            {"missing_columns": missing},
        )
        raise DataGateError(message)

    _record_gate(
        "required_columns",
        "passed",
        "All required columns are present.",
        {"required_columns": required_columns},
    )


def gate_min_valid_rows(df: pd.DataFrame, min_rows: int = 50) -> None:
    row_count = int(len(df))
    record_metric("valid_rows_after_cleaning", row_count)
    if row_count < min_rows:
        message = (
            f"Only {row_count} valid rows remain after cleaning; "
            f"recommended minimum is {min_rows}."
        )
        record_warning(message, "min_valid_rows")
        _record_gate(
            "min_valid_rows",
            "warning",
            message,
            {"row_count": row_count, "min_rows": min_rows},
        )
        return

    _record_gate(
        "min_valid_rows",
        "passed",
        f"{row_count} valid rows remain after cleaning.",
        {"row_count": row_count, "min_rows": min_rows},
    )


def gate_district_mapping_coverage(
    df: pd.DataFrame,
    min_coverage: float = 0.60,
) -> None:
    required = {"district_unmapped", "district_mapping_confidence"}
    missing = sorted(required.difference(df.columns))
    if missing:
        message = (
            "Cannot calculate district mapping coverage; missing columns: "
            f"{', '.join(missing)}"
        )
        record_warning(message, "district_mapping_coverage")
        _record_gate(
            "district_mapping_coverage",
            "warning",
            message,
            {"missing_columns": missing},
        )
        return

    if df.empty:
        message = "No rows available for district mapping coverage."
        record_error(message, "district_mapping_coverage")
        _record_gate("district_mapping_coverage", "failed", message)
        raise DataGateError(message)

    usable = (~df["district_unmapped"]) & (
        pd.to_numeric(df["district_mapping_confidence"], errors="coerce").fillna(0)
        >= 0.80
    )
    coverage = float(usable.mean())
    record_metric("district_mapping_coverage", round(coverage, 4))

    if coverage <= 0:
        message = "No API rows have district mapping confidence >= 0.80."
        record_error(message, "district_mapping_coverage")
        _record_gate(
            "district_mapping_coverage",
            "failed",
            message,
            {"coverage": coverage, "min_coverage": min_coverage},
        )
        raise DataGateError(message)

    if coverage < min_coverage:
        message = (
            f"District mapping coverage is {coverage:.1%}; target is "
            f"{min_coverage:.1%}."
        )
        record_warning(message, "district_mapping_coverage")
        _record_gate(
            "district_mapping_coverage",
            "warning",
            message,
            {"coverage": coverage, "min_coverage": min_coverage},
        )
        return

    _record_gate(
        "district_mapping_coverage",
        "passed",
        f"District mapping coverage is {coverage:.1%}.",
        {"coverage": coverage, "min_coverage": min_coverage},
    )


def gate_model_feature_contract(
    df: pd.DataFrame,
    required_features: list[str],
) -> None:
    missing = [feature for feature in required_features if feature not in df.columns]
    if missing:
        message = f"Feature contract is missing: {', '.join(missing)}"
        record_error(message, "model_feature_contract")
        _record_gate(
            "model_feature_contract",
            "failed",
            message,
            {"missing_features": missing},
        )
        raise DataGateError(message)

    all_null = [feature for feature in required_features if df[feature].isna().all()]
    if all_null:
        message = f"Feature contract has all-null fields: {', '.join(all_null)}"
        record_warning(message, "model_feature_contract")
        _record_gate(
            "model_feature_contract",
            "warning",
            message,
            {"all_null_features": all_null},
        )
        return

    _record_gate(
        "model_feature_contract",
        "passed",
        "API rows satisfy the model feature contract.",
        {"required_features": required_features},
    )
