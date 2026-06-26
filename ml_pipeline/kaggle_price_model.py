from __future__ import annotations

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor


class KagglePricePerSqmModel:
    """CatBoost wrapper that trains on log1p target and predicts AED/sqm."""

    def __init__(
        self,
        model: CatBoostRegressor,
        feature_columns: list[str],
        categorical_features: list[str],
        metadata: dict | None = None,
    ) -> None:
        self.model = model
        self.feature_names_in_ = np.array(feature_columns, dtype=object)
        self.categorical_features_ = list(categorical_features)
        self.metadata = metadata or {}

    def _prepare(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = pd.DataFrame(X).copy().reindex(columns=list(self.feature_names_in_))
        for column in self.categorical_features_:
            frame[column] = frame[column].fillna("missing").astype(str)
        return frame

    def predict_log(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict(self._prepare(X))

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return np.clip(np.expm1(self.predict_log(X)), a_min=0, a_max=None)
