from __future__ import annotations

import os

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor


def _use_gpu() -> bool:
    return os.environ.get("PROPTECH_USE_GPU", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric_features = X.select_dtypes(include=[np.number, "bool"]).columns.tolist()
    categorical_features = [
        column for column in X.columns if column not in numeric_features
    ]

    transformers = []
    if numeric_features:
        transformers.append(
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="mean")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_features,
            )
        )

    if categorical_features:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            )
        )

    if not transformers:
        raise ValueError("Cannot build a preprocessor without feature columns.")

    return ColumnTransformer(transformers=transformers)


def build_xgb_regressor() -> XGBRegressor:
    params: dict[str, object] = {
        "n_estimators": 300,
        "max_depth": 4,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": 42,
        "objective": "reg:squarederror",
    }
    if _use_gpu():
        params.update(
            {
                "device": "cuda",
                "tree_method": "hist",
            }
        )

    return XGBRegressor(**params)


class CatBoostFrameRegressor:
    """Small DataFrame wrapper so CatBoost can use categorical columns directly."""

    def __init__(self, **model_params: object) -> None:
        params = {
            "iterations": 300,
            "depth": 4,
            "learning_rate": 0.05,
            "l2_leaf_reg": 3.0,
            "loss_function": "RMSE",
            "random_seed": 42,
            "verbose": False,
            "allow_writing_files": False,
        }
        if _use_gpu():
            params.update(
                {
                    "task_type": "GPU",
                }
            )
        params.update(model_params)
        self.model = CatBoostRegressor(**params)

    def _prepare(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = pd.DataFrame(X).copy()
        frame = frame.reindex(columns=list(self.feature_names_in_))
        for column in self.categorical_features_:
            frame[column] = frame[column].fillna("missing").astype(str)
        return frame

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "CatBoostFrameRegressor":
        frame = pd.DataFrame(X).copy()
        self.feature_names_in_ = np.array(frame.columns, dtype=object)
        self.categorical_features_ = [
            column
            for column in frame.columns
            if not pd.api.types.is_numeric_dtype(frame[column])
        ]
        categorical_indices = [
            frame.columns.get_loc(column) for column in self.categorical_features_
        ]
        self.model.fit(
            self._prepare(frame),
            y,
            cat_features=categorical_indices,
        )
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict(self._prepare(pd.DataFrame(X)))


def build_catboost_regressor(**model_params: object) -> CatBoostFrameRegressor:
    return CatBoostFrameRegressor(**model_params)


def build_model_pipeline(
    X: pd.DataFrame,
    model_family: str = "xgboost",
    model_params: dict | None = None,
) -> object:
    if model_family == "catboost":
        return build_catboost_regressor(**(model_params or {}))

    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(X)),
            ("model", build_xgb_regressor()),
        ]
    )
