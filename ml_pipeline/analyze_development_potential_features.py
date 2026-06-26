from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.feature_selection import mutual_info_regression

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.data_loader import load_all_data
from ml_pipeline.development_potential import add_development_potential_features
from ml_pipeline.feature_builder import DEVELOPMENT_TARGET, build_parcel_table


OUTPUT_DIR = ROOT_DIR / "outputs"
REPORT_PATH = OUTPUT_DIR / "development_potential_feature_report.json"


def _load_or_build_parcel_table() -> pd.DataFrame:
    path = OUTPUT_DIR / "parcel_model_table.csv"
    if path.exists():
        return add_development_potential_features(pd.read_csv(path))

    data = load_all_data()
    table = build_parcel_table(data)
    OUTPUT_DIR.mkdir(exist_ok=True)
    table.to_csv(path, index=False)
    return table


def _safe_float(value: object) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def _top_correlations(frame: pd.DataFrame, method: str) -> list[dict[str, Any]]:
    numeric = frame.select_dtypes(include=[np.number, "bool"]).copy()
    correlations = (
        numeric.corr(method=method, numeric_only=True)[DEVELOPMENT_TARGET]
        .drop(DEVELOPMENT_TARGET, errors="ignore")
        .dropna()
    )
    ordered = correlations.reindex(correlations.abs().sort_values(ascending=False).index)
    return [
        {"feature": feature, f"{method}_correlation": _safe_float(value)}
        for feature, value in ordered.head(30).items()
    ]


def _mutual_information(frame: pd.DataFrame) -> list[dict[str, Any]]:
    numeric = frame.select_dtypes(include=[np.number, "bool"]).copy()
    y = pd.to_numeric(numeric.pop(DEVELOPMENT_TARGET), errors="coerce")
    X = numeric.replace([np.inf, -np.inf], np.nan).fillna(0)
    valid = y.notna()
    if valid.sum() < 5 or X.empty:
        return []

    scores = mutual_info_regression(X.loc[valid], y.loc[valid], random_state=42)
    ordered = pd.Series(scores, index=X.columns).sort_values(ascending=False)
    return [
        {"feature": feature, "mutual_information": _safe_float(value)}
        for feature, value in ordered.head(30).items()
    ]


def _categorical_eta2(frame: pd.DataFrame) -> list[dict[str, Any]]:
    categorical_columns = [
        column
        for column in frame.columns
        if column != DEVELOPMENT_TARGET
        and not pd.api.types.is_numeric_dtype(frame[column])
    ]
    y = pd.to_numeric(frame[DEVELOPMENT_TARGET], errors="coerce")
    overall = y.mean()
    ss_total = float(((y - overall) ** 2).sum())
    if ss_total <= 0:
        return []

    results: list[dict[str, Any]] = []
    for column in categorical_columns:
        grouped = frame.groupby(column, dropna=False)[DEVELOPMENT_TARGET].agg(
            ["count", "mean"],
        )
        ss_between = float(
            sum(row["count"] * (row["mean"] - overall) ** 2 for _, row in grouped.iterrows())
        )
        results.append(
            {
                "feature": column,
                "eta_squared": ss_between / ss_total,
                "unique_values": int(frame[column].nunique(dropna=True)),
                "top_groups_by_mean": [
                    {
                        "value": str(index),
                        "count": int(row["count"]),
                        "mean": _safe_float(row["mean"]),
                    }
                    for index, row in grouped.sort_values("mean", ascending=False)
                    .head(8)
                    .iterrows()
                ],
            }
        )
    return sorted(results, key=lambda item: item["eta_squared"], reverse=True)


def build_report(frame: pd.DataFrame) -> dict[str, Any]:
    if DEVELOPMENT_TARGET not in frame.columns:
        raise ValueError(f"Missing target column: {DEVELOPMENT_TARGET}")

    target = pd.to_numeric(frame[DEVELOPMENT_TARGET], errors="coerce")
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rows": int(len(frame)),
        "target": DEVELOPMENT_TARGET,
        "target_summary": {
            key: _safe_float(value)
            for key, value in target.describe().items()
        },
        "pearson_top": _top_correlations(frame, "pearson"),
        "spearman_top": _top_correlations(frame, "spearman"),
        "mutual_information_top": _mutual_information(frame),
        "categorical_eta2_top": _categorical_eta2(frame)[:30],
        "note": (
            "Low correlation or mutual information means feature engineering may not "
            "recover an ML signal from the current target. In that case the "
            "rule-based fallback is the safer model-facing output."
        ),
    }


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    frame = _load_or_build_parcel_table()
    report = build_report(frame)
    with REPORT_PATH.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
    print(f"Saved development-potential feature report to {REPORT_PATH}")


if __name__ == "__main__":
    main()
