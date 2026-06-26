from __future__ import annotations

import numpy as np
import pandas as pd


DEVELOPMENT_ENGINEERED_FEATURE_COLUMNS = [
    "log_parcel_size_sqm",
    "amenity_density_per_10k_sqm",
    "amenity_retail_share",
    "amenity_mobility_share",
    "amenity_community_share",
    "service_demand_minus_mobility",
    "service_demand_x_occupancy",
    "infrastructure_x_mobility",
    "yield_x_base_price",
    "zone_family",
    "land_use_status",
    "recommended_use_family",
]


def _numeric(frame: pd.DataFrame, column: str, default: float = 0.0) -> pd.Series:
    if column not in frame.columns:
        return pd.Series(default, index=frame.index, dtype="float64")
    return pd.to_numeric(frame[column], errors="coerce").fillna(default)


def _text(frame: pd.DataFrame, column: str, default: str = "unknown") -> pd.Series:
    if column not in frame.columns:
        return pd.Series(default, index=frame.index, dtype="object")
    return (
        frame[column]
        .fillna(default)
        .astype(str)
        .str.strip()
        .replace("", default)
    )


def _ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.where(denominator > 0)
    return (numerator / denominator).replace([np.inf, -np.inf], np.nan).fillna(0.0)


def _clamp(series: pd.Series, lower: float = 0.0, upper: float = 100.0) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0.0).clip(lower, upper)


def _scale(series: pd.Series, denominator: float) -> pd.Series:
    return _clamp(series / denominator * 100.0)


def _zone_family(zone: object) -> str:
    value = str(zone or "unknown").strip().upper()
    parts = [part for part in value.split("-") if part]
    if len(parts) >= 2:
        return parts[1].lower()
    return value.lower() or "unknown"


def _recommended_use_family(value: object) -> str:
    normalized = str(value or "unknown").strip().lower()
    if not normalized:
        return "unknown"
    if "residential" in normalized or "housing" in normalized:
        return "residential"
    if any(token in normalized for token in ("retail", "market", "mall")):
        return "retail"
    if any(token in normalized for token in ("office", "coworking")):
        return "office"
    if any(token in normalized for token in ("hotel", "hospitality")):
        return "hospitality"
    if any(token in normalized for token in ("warehouse", "assembly", "industrial")):
        return "industrial"
    if any(token in normalized for token in ("clinic", "school", "community")):
        return "community"
    return normalized.split("_")[0]


def add_development_potential_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add non-leaky development-potential features for ML and rule fallback."""

    features = frame.copy()
    parcel_size = _numeric(features, "parcel_size_sqm")
    amenity_total = _numeric(features, "amenity_count_total")
    retail = _numeric(features, "amenity_count_retail")
    mobility = _numeric(features, "amenity_count_mobility")
    community = _numeric(features, "amenity_count_community")
    service_demand = _numeric(features, "avg_service_demand_index")
    mobility_score = _numeric(features, "avg_mobility_score")
    occupancy = _numeric(features, "avg_occupancy_rate")
    infrastructure = _numeric(features, "infrastructure_score")
    gross_yield = _numeric(features, "gross_yield_pct")
    base_price = _numeric(features, "base_sale_aed_sqm")

    features["log_parcel_size_sqm"] = np.log1p(parcel_size.clip(lower=0))
    features["amenity_density_per_10k_sqm"] = _ratio(
        amenity_total,
        parcel_size,
    ) * 10_000
    features["amenity_retail_share"] = _ratio(retail, amenity_total)
    features["amenity_mobility_share"] = _ratio(mobility, amenity_total)
    features["amenity_community_share"] = _ratio(community, amenity_total)
    features["service_demand_minus_mobility"] = service_demand - mobility_score
    features["service_demand_x_occupancy"] = service_demand * occupancy
    features["infrastructure_x_mobility"] = infrastructure * mobility_score / 100.0
    features["yield_x_base_price"] = gross_yield * base_price
    features["zone_family"] = _text(features, "zone").map(_zone_family)
    features["land_use_status"] = (
        _text(features, "land_use").str.lower()
        + "__"
        + _text(features, "current_status").str.lower()
    )
    features["recommended_use_family"] = _text(
        features,
        "recommended_use",
    ).map(_recommended_use_family)
    return features


def calculate_rule_based_development_potential(frame: pd.DataFrame) -> pd.Series:
    """Transparent 0-100 development-potential fallback score."""

    features = add_development_potential_features(frame)
    infrastructure = _clamp(_numeric(features, "infrastructure_score"))
    service_demand = _clamp(_numeric(features, "avg_service_demand_index"))
    mobility = _clamp(_numeric(features, "avg_mobility_score"))
    resident_experience = _clamp(_numeric(features, "avg_resident_experience_score"))
    yield_score = _scale(_numeric(features, "gross_yield_pct"), 8.0)
    amenity_score = _scale(_numeric(features, "amenity_density_per_10k_sqm"), 450.0)

    occupancy = _numeric(features, "avg_occupancy_rate", default=0.85).clip(0, 1)
    occupancy_opportunity = _clamp((1.0 - (occupancy - 0.82).abs() / 0.35) * 100.0)

    status = _text(features, "current_status").str.lower()
    status_score = pd.Series(55.0, index=features.index)
    status_score = status_score.where(status != "vacant", 92.0)
    status_score = status_score.where(status != "under_development", 82.0)
    status_score = status_score.where(status != "reserved", 45.0)
    status_score = status_score.where(status != "developed", 62.0)

    land_use = _text(features, "land_use").str.lower()
    land_use_adjustment = pd.Series(0.0, index=features.index)
    land_use_adjustment = land_use_adjustment.where(land_use != "mixed_use", 5.0)
    land_use_adjustment = land_use_adjustment.where(land_use != "commercial", 4.0)
    land_use_adjustment = land_use_adjustment.where(land_use != "hospitality", 4.0)
    land_use_adjustment = land_use_adjustment.where(land_use != "community", 3.0)
    land_use_adjustment = land_use_adjustment.where(land_use != "residential", 2.0)
    land_use_adjustment = land_use_adjustment.where(land_use != "industrial", 1.0)

    profile = _text(features, "profile").str.lower()
    profile_adjustment = pd.Series(0.0, index=features.index)
    profile_adjustment = profile_adjustment.where(~profile.isin(["premium", "high"]), 4.0)
    profile_adjustment = profile_adjustment.where(
        ~profile.isin(["established", "mid_high"]),
        2.0,
    )
    profile_adjustment = profile_adjustment.where(
        ~profile.isin(["industrial", "leisure"]),
        -2.0,
    )

    score = (
        0.22 * infrastructure
        + 0.18 * service_demand
        + 0.14 * mobility
        + 0.10 * resident_experience
        + 0.12 * amenity_score
        + 0.10 * yield_score
        + 0.08 * occupancy_opportunity
        + 0.06 * status_score
        + land_use_adjustment
        + profile_adjustment
    )
    return _clamp(score)


class RuleBasedDevelopmentPotentialRegressor:
    """Estimator-compatible fallback for weak development-potential ML fits."""

    method_name = "rule_based_development_potential_fallback"

    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series | None = None,
    ) -> "RuleBasedDevelopmentPotentialRegressor":
        self.feature_names_in_ = np.array(pd.DataFrame(X).columns, dtype=object)
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        frame = pd.DataFrame(X).copy()
        if hasattr(self, "feature_names_in_"):
            frame = frame.reindex(columns=list(self.feature_names_in_))
        return calculate_rule_based_development_potential(frame).to_numpy()
