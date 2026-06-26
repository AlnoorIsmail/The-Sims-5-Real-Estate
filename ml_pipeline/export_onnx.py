from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
from catboost import CatBoostRegressor
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.data_loader import load_all_data
from ml_pipeline.feature_builder import (
    DEVELOPMENT_TARGET,
    PARCEL_FEATURE_COLUMNS,
    PARCEL_VALUE_TARGET,
    TRANSACTION_FEATURE_COLUMNS,
    TRANSACTION_TARGET,
    build_parcel_table,
    build_transaction_table,
)
from ml_pipeline.train_models import _prepare_training_data


OUTPUT_DIR = ROOT_DIR / "outputs"
PUBLIC_MODEL_DIR = ROOT_DIR / "public" / "models" / "roi"
ONNX_OPSET = 15

ONNX_MODEL_SPECS = [
    {
        "name": "price_per_sqm",
        "target": TRANSACTION_TARGET,
        "feature_columns": TRANSACTION_FEATURE_COLUMNS,
        "table": "transaction",
        "onnx_path": PUBLIC_MODEL_DIR / "price_per_sqm_catboost.onnx",
        "onnx_family": "catboost",
        "model_params": {
            "iterations": 500,
            "depth": 6,
            "learning_rate": 0.03,
            "l2_leaf_reg": 10.0,
        },
    },
    {
        "name": "estimated_value_aed",
        "target": PARCEL_VALUE_TARGET,
        "feature_columns": PARCEL_FEATURE_COLUMNS,
        "table": "parcel",
        "onnx_path": PUBLIC_MODEL_DIR / "estimated_value_aed_xgb.onnx",
        "onnx_family": "xgboost",
        "model_params": {},
    },
    {
        "name": "development_potential_score",
        "target": DEVELOPMENT_TARGET,
        "feature_columns": PARCEL_FEATURE_COLUMNS,
        "table": "parcel",
        "onnx_path": PUBLIC_MODEL_DIR / "development_potential_score_catboost.onnx",
        "onnx_family": "catboost",
        "model_params": {
            "iterations": 300,
            "depth": 4,
            "learning_rate": 0.05,
            "l2_leaf_reg": 3.0,
        },
    },
]


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


def _schema_from_training_frame(X: pd.DataFrame) -> dict:
    numeric_columns = [
        column for column in X.columns if pd.api.types.is_numeric_dtype(X[column])
    ]
    categorical_columns = [column for column in X.columns if column not in numeric_columns]

    numeric_means = {
        column: float(pd.to_numeric(X[column], errors="coerce").mean())
        for column in numeric_columns
    }
    categorical_values = {
        column: sorted(
            str(value)
            for value in X[column].dropna().astype(str).unique().tolist()
        )
        for column in categorical_columns
    }

    input_features = list(numeric_columns)
    for column in categorical_columns:
        input_features.extend(f"{column}={value}" for value in categorical_values[column])
        input_features.append(f"{column}=__missing__")
        input_features.append(f"{column}=__unknown__")

    return {
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "numeric_means": numeric_means,
        "categorical_values": categorical_values,
        "input_tensor_name": "features",
        "input_features": input_features,
    }


def _encode_with_schema(X: pd.DataFrame, schema: dict) -> np.ndarray:
    columns: list[np.ndarray] = []

    for column in schema["numeric_columns"]:
        mean = schema["numeric_means"][column]
        values = pd.to_numeric(X[column], errors="coerce").fillna(mean)
        columns.append(values.to_numpy(dtype=np.float32).reshape(-1, 1))

    for column in schema["categorical_columns"]:
        values = X[column].astype("object")
        is_missing = values.isna()
        normalized = values.fillna("").astype(str)
        known = set(schema["categorical_values"][column])

        for category in schema["categorical_values"][column]:
            columns.append((normalized == category).to_numpy(dtype=np.float32).reshape(-1, 1))

        columns.append(is_missing.to_numpy(dtype=np.float32).reshape(-1, 1))
        is_unknown = (~is_missing) & (~normalized.isin(known))
        columns.append(is_unknown.to_numpy(dtype=np.float32).reshape(-1, 1))

    if not columns:
        raise ValueError("Cannot encode an empty feature set.")

    return np.concatenate(columns, axis=1).astype(np.float32)


def _build_xgb_regressor() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        objective="reg:squarederror",
    )


def _build_catboost_regressor(model_params: dict) -> CatBoostRegressor:
    params = {
        "loss_function": "RMSE",
        "random_seed": 42,
        "verbose": False,
        "allow_writing_files": False,
    }
    params.update(model_params)
    return CatBoostRegressor(**params)


def _train_and_export(spec: dict, table: pd.DataFrame) -> tuple[dict, dict]:
    X, y, selected_features = _prepare_training_data(
        table,
        spec["feature_columns"],
        spec["target"],
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    schema = _schema_from_training_frame(X_train)
    X_train_encoded = _encode_with_schema(X_train, schema)
    X_test_encoded = _encode_with_schema(X_test, schema)

    if spec["onnx_family"] == "catboost":
        model = _build_catboost_regressor(spec["model_params"])
    else:
        model = _build_xgb_regressor()

    model.fit(X_train_encoded, y_train)

    predictions = model.predict(X_test_encoded)
    metrics = {
        "target": spec["target"],
        "model_family": spec["onnx_family"],
        "model_params": spec["model_params"],
        "rows": int(len(X)),
        "raw_features": selected_features,
        "encoded_feature_count": int(X_train_encoded.shape[1]),
        "mae": float(mean_absolute_error(y_test, predictions)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
        "r2": float(r2_score(y_test, predictions)) if len(y_test) > 1 else None,
    }

    if spec["onnx_family"] == "catboost":
        model.save_model(str(spec["onnx_path"]), format="onnx")
    else:
        onnx_model = convert_xgboost(
            model,
            initial_types=[
                (
                    schema["input_tensor_name"],
                    FloatTensorType([None, X_train_encoded.shape[1]]),
                )
            ],
            target_opset=ONNX_OPSET,
        )
        spec["onnx_path"].write_bytes(onnx_model.SerializeToString())

    session = ort.InferenceSession(
        str(spec["onnx_path"]),
        providers=["CPUExecutionProvider"],
    )
    output_tensor_name = session.get_outputs()[0].name
    onnx_predictions = session.run(
        [output_tensor_name],
        {schema["input_tensor_name"]: X_test_encoded[:20]},
    )[0].reshape(-1)
    metrics["max_abs_onnx_diff"] = float(
        np.max(np.abs(onnx_predictions - predictions[:20]))
    )

    schema.update(
        {
            "name": spec["name"],
            "target": spec["target"],
            "model_family": spec["onnx_family"],
            "model_params": spec["model_params"],
            "onnx_path": str(spec["onnx_path"].relative_to(ROOT_DIR)),
            "output_tensor_name": output_tensor_name,
            "opset": ONNX_OPSET if spec["onnx_family"] == "xgboost" else None,
            "raw_features": selected_features,
        }
    )
    return metrics, schema


def main() -> None:
    PUBLIC_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    transaction_table, parcel_table = _load_or_build_tables()
    tables = {
        "transaction": transaction_table,
        "parcel": parcel_table,
    }

    metrics: dict[str, dict] = {}
    schemas: dict[str, dict] = {}

    for spec in ONNX_MODEL_SPECS:
        model_metrics, model_schema = _train_and_export(spec, tables[spec["table"]])
        metrics[spec["name"]] = model_metrics
        schemas[spec["name"]] = model_schema
        print(f"Exported {spec['name']} to {spec['onnx_path']}")

    bundle_schema = {
        "schema_version": "roi_onnx_bundle.v1",
        "runtime": "onnxruntime-web",
        "input_encoding": "manual_numeric_tensor",
        "models": schemas,
        "notes": [
            "Native CatBoost models with categorical features cannot be exported to ONNX-ML by CatBoost.",
            "This bundle uses numeric one-hot preprocessing so CatBoost can be exported where it improves ONNX metrics.",
            "XGBoost remains in the bundle where it performs better than ONNX-compatible CatBoost.",
            "The app-facing ROI decision contract remains roi_prediction.v1.",
        ],
    }

    schema_path = PUBLIC_MODEL_DIR / "model_schema.json"
    with schema_path.open("w", encoding="utf-8") as file:
        json.dump(bundle_schema, file, indent=2)

    metrics_path = OUTPUT_DIR / "onnx_model_metrics.json"
    with metrics_path.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    print(f"Saved ONNX schema to {schema_path}")
    print(f"Saved ONNX metrics to {metrics_path}")


if __name__ == "__main__":
    main()
