from __future__ import annotations

from collections.abc import Mapping

import pandas as pd

from ml_pipeline.development_potential import (
    DEVELOPMENT_ENGINEERED_FEATURE_COLUMNS,
    add_development_potential_features,
)


TRANSACTION_FEATURE_COLUMNS = [
    "district",
    "asset_type",
    "size_sqm",
    "buyer_type",
    "area_type",
    "profile",
    "base_sale_aed_sqm",
    "gross_yield_pct",
    "infrastructure_score",
    "established_year",
    "transaction_year",
    "transaction_month",
    "transaction_quarter",
]

PARCEL_FEATURE_COLUMNS = [
    "district",
    "zone",
    "land_use",
    "parcel_size_sqm",
    "current_status",
    "area_type",
    "profile",
    "base_sale_aed_sqm",
    "gross_yield_pct",
    "infrastructure_score",
    "established_year",
    "avg_population_estimate",
    "avg_occupancy_rate",
    "avg_service_demand_index",
    "avg_mobility_score",
    "avg_resident_experience_score",
    "amenity_count_total",
    "amenity_count_education",
    "amenity_count_healthcare",
    "amenity_count_retail",
    "amenity_count_services",
    "amenity_count_community",
    "amenity_count_mobility",
    *DEVELOPMENT_ENGINEERED_FEATURE_COLUMNS,
]

TRANSACTION_TARGET = "price_per_sqm"
PARCEL_VALUE_TARGET = "estimated_value_aed"
DEVELOPMENT_TARGET = "development_potential_score"

DISTRICT_CONTEXT_COLUMNS = [
    "area_type",
    "profile",
    "base_sale_aed_sqm",
    "gross_yield_pct",
    "infrastructure_score",
    "established_year",
]

COMMUNITY_AGGREGATIONS = {
    "population_estimate": "avg_population_estimate",
    "occupancy_rate": "avg_occupancy_rate",
    "service_demand_index": "avg_service_demand_index",
    "mobility_score": "avg_mobility_score",
    "resident_experience_score": "avg_resident_experience_score",
}

AMENITY_BUCKETS = {
    "education": ("education", "school", "university", "college", "kindergarten"),
    "healthcare": ("healthcare", "health", "hospital", "clinic", "pharmacy"),
    "retail": ("retail", "shop", "mall", "market", "supermarket", "restaurant", "cafe"),
    "services": ("services", "service", "bank", "government", "police", "post"),
    "community": ("community", "park", "mosque", "sports", "leisure", "culture", "library"),
    "mobility": ("mobility", "transport", "bus", "parking", "metro", "taxi"),
}


def _get_table(data: Mapping[str, pd.DataFrame], filename: str) -> pd.DataFrame:
    stem = filename.removesuffix(".csv")
    for key in (filename, stem):
        if key in data:
            frame = data[key].copy()
            frame.columns = frame.columns.str.strip()
            return frame
    raise KeyError(f"Missing required table: {filename}")


def _require_columns(frame: pd.DataFrame, columns: list[str], table_name: str) -> None:
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        raise ValueError(f"{table_name} is missing required columns: {', '.join(missing)}")


def _merge_district_context(frame: pd.DataFrame, districts: pd.DataFrame) -> pd.DataFrame:
    merged = frame.merge(districts, on="district", how="left", suffixes=("", "_district"))

    for column in DISTRICT_CONTEXT_COLUMNS:
        district_column = f"{column}_district"
        if district_column not in merged.columns:
            continue

        if column in merged.columns:
            merged[column] = merged[district_column].combine_first(merged[column])
        else:
            merged[column] = merged[district_column]

        merged = merged.drop(columns=[district_column])

    return merged


def _add_transaction_date_features(transactions: pd.DataFrame) -> pd.DataFrame:
    date_column = None
    for candidate in ("date", "transaction_date"):
        if candidate in transactions.columns:
            date_column = candidate
            break

    if date_column is None:
        return transactions

    dates = pd.to_datetime(transactions[date_column], errors="coerce")
    transactions["transaction_year"] = dates.dt.year
    transactions["transaction_month"] = dates.dt.month
    transactions["transaction_quarter"] = dates.dt.quarter
    return transactions


def _build_community_aggregates(communities: pd.DataFrame) -> pd.DataFrame:
    _require_columns(communities, ["district"], "sample_communities.csv")
    base = communities[["district"]].drop_duplicates().copy()

    present_aggregations = {
        source: "mean"
        for source in COMMUNITY_AGGREGATIONS
        if source in communities.columns
    }

    if present_aggregations:
        grouped = communities.groupby("district", as_index=False).agg(present_aggregations)
        grouped = grouped.rename(columns=COMMUNITY_AGGREGATIONS)
        base = base.merge(grouped, on="district", how="left")

    for output_column in COMMUNITY_AGGREGATIONS.values():
        if output_column not in base.columns:
            base[output_column] = 0.0

    return base


def _amenity_category_values(amenities: pd.DataFrame) -> pd.Series:
    category_column = next(
        (
            column
            for column in (
                "amenity_category",
                "category",
                "amenity_type",
                "type",
                "class",
            )
            if column in amenities.columns
        ),
        None,
    )

    if category_column is None:
        return pd.Series("", index=amenities.index)

    return amenities[category_column].fillna("").astype(str).str.lower()


def _build_amenity_aggregates(amenities: pd.DataFrame) -> pd.DataFrame:
    _require_columns(amenities, ["district"], "osm_amenities.csv")

    counts = (
        amenities.groupby("district")
        .size()
        .rename("amenity_count_total")
        .reset_index()
    )
    categories = _amenity_category_values(amenities)

    for bucket, keywords in AMENITY_BUCKETS.items():
        column_name = f"amenity_count_{bucket}"
        mask = categories.apply(lambda value: any(keyword in value for keyword in keywords))
        bucket_counts = (
            amenities.loc[mask]
            .groupby("district")
            .size()
            .rename(column_name)
            .reset_index()
        )
        counts = counts.merge(bucket_counts, on="district", how="left")
        counts[column_name] = counts[column_name].fillna(0).astype(int)

    return counts


def build_transaction_table(data: Mapping[str, pd.DataFrame]) -> pd.DataFrame:
    transactions = _get_table(data, "sample_transactions.csv")
    districts = _get_table(data, "districts.csv")

    _require_columns(transactions, ["district", TRANSACTION_TARGET], "sample_transactions.csv")
    _require_columns(districts, ["district"], "districts.csv")

    transactions = _add_transaction_date_features(transactions)
    return _merge_district_context(transactions, districts)


def build_parcel_table(data: Mapping[str, pd.DataFrame]) -> pd.DataFrame:
    parcels = _get_table(data, "sample_parcels.csv")
    districts = _get_table(data, "districts.csv")
    communities = _get_table(data, "sample_communities.csv")
    amenities = _get_table(data, "osm_amenities.csv")

    _require_columns(
        parcels,
        ["district", PARCEL_VALUE_TARGET, DEVELOPMENT_TARGET],
        "sample_parcels.csv",
    )
    _require_columns(districts, ["district"], "districts.csv")

    community_aggregates = _build_community_aggregates(communities)
    amenity_aggregates = _build_amenity_aggregates(amenities)

    table = _merge_district_context(parcels, districts)
    table = table.merge(community_aggregates, on="district", how="left")
    table = table.merge(amenity_aggregates, on="district", how="left")

    aggregate_columns = [
        *COMMUNITY_AGGREGATIONS.values(),
        "amenity_count_total",
        *(f"amenity_count_{bucket}" for bucket in AMENITY_BUCKETS),
    ]
    for column in aggregate_columns:
        if column not in table.columns:
            table[column] = 0
        table[column] = table[column].fillna(0)

    return add_development_potential_features(table)
