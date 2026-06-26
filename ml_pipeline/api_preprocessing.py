from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
DEFAULT_MAPPING_PATH = ROOT_DIR / "ml_pipeline" / "area_district_mapping.csv"


def _first_present(columns: pd.Index, candidates: tuple[str, ...]) -> str | None:
    normalized = {column.strip().lower(): column for column in columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    return None


def _ensure_column(
    frame: pd.DataFrame,
    target: str,
    candidates: tuple[str, ...],
    default: object = pd.NA,
) -> pd.DataFrame:
    source = _first_present(frame.columns, candidates)
    if source is not None and source != target:
        frame[target] = frame[source]
    elif source is None and target not in frame.columns:
        frame[target] = default
    return frame


def _clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return " ".join(str(value).strip().split())


def _normalize_transaction_type(value: object) -> str:
    cleaned = _clean_text(value).lower()
    if cleaned in {"buy", "sale", "sell", "sales", "for sale"}:
        return "sale"
    if cleaned in {"rent", "rental", "lease", "for rent"}:
        return "rent"
    return cleaned or "unknown"


def _maybe_enrich_area(raw: pd.DataFrame, areas: pd.DataFrame | None) -> pd.DataFrame:
    if areas is None or areas.empty or "area" in raw.columns or "area_id" not in raw.columns:
        return raw

    area_id_column = _first_present(areas.columns, ("id", "area_id"))
    area_name_column = _first_present(areas.columns, ("area", "name", "title"))
    if area_id_column is None or area_name_column is None:
        return raw

    lookup = areas[[area_id_column, area_name_column]].drop_duplicates()
    lookup = lookup.rename(columns={area_id_column: "area_id", area_name_column: "area"})
    return raw.merge(lookup, on="area_id", how="left")


def clean_api_listings(
    raw: pd.DataFrame,
    areas: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Clean raw external API rows without changing the starter-kit pipeline."""

    frame = raw.copy()
    frame.columns = frame.columns.str.strip()
    frame = _maybe_enrich_area(frame, areas)

    frame = _ensure_column(frame, "price", ("price", "amount", "listing_price"))
    frame = _ensure_column(
        frame,
        "built_up_area_sqm",
        ("built_up_area_sqm", "size_sqm", "area_sqm", "builtup_area_sqm"),
    )
    frame = _ensure_column(
        frame,
        "transaction_type",
        ("transaction_type", "listing_type", "purpose"),
        default="unknown",
    )
    frame = _ensure_column(frame, "area", ("area", "area_name", "community"))
    frame = _ensure_column(frame, "bathrooms", ("bathrooms", "baths"))
    frame = _ensure_column(frame, "building_id", ("building_id", "building"))

    frame["price"] = pd.to_numeric(frame["price"], errors="coerce")
    frame["built_up_area_sqm"] = pd.to_numeric(
        frame["built_up_area_sqm"],
        errors="coerce",
    )

    frame = frame[(frame["price"] > 0) & (frame["built_up_area_sqm"] > 0)].copy()
    frame["price_per_sqm_observed"] = frame["price"] / frame["built_up_area_sqm"]

    frame["price_looks_like_sale"] = frame["price"] > 1_000_000
    normalized_transaction_type = frame["transaction_type"].apply(
        _normalize_transaction_type
    )
    frame["transaction_type_clean"] = normalized_transaction_type.where(
        ~frame["price_looks_like_sale"],
        "sale",
    )

    frame["missing_area"] = frame["area"].isna() | (frame["area"].astype(str).str.strip() == "")
    frame["missing_bathrooms"] = frame["bathrooms"].isna()
    frame["missing_building_id"] = frame["building_id"].isna() | (
        frame["building_id"].astype(str).str.strip() == ""
    )
    frame["source"] = "live_api"
    frame["is_api_data"] = True

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    frame.to_csv(PROCESSED_DIR / "api_listings_clean.csv", index=False)
    return frame


def map_area_to_district(
    df: pd.DataFrame,
    mapping_path: str = "ml_pipeline/area_district_mapping.csv",
) -> pd.DataFrame:
    """Map messy API area values to model-compatible district names."""

    frame = df.copy()
    path = Path(mapping_path)
    if not path.is_absolute():
        path = ROOT_DIR / path

    mapping = pd.read_csv(path)
    mapping["area_key"] = mapping["area"].fillna("").astype(str).str.strip().str.lower()
    mapping = mapping.drop_duplicates(subset=["area_key"], keep="first")

    if "area" not in frame.columns:
        frame["area"] = pd.NA

    frame["area_key"] = frame["area"].fillna("").astype(str).str.strip().str.lower()
    mapping = mapping.rename(columns={"district": "mapped_district"})
    mapped = frame.merge(
        mapping[["area_key", "mapped_district", "confidence"]],
        on="area_key",
        how="left",
    )

    mapped["district"] = mapped["mapped_district"].where(
        mapped["mapped_district"].notna(),
        pd.NA,
    )
    mapped["district_mapping_confidence"] = pd.to_numeric(
        mapped["confidence"],
        errors="coerce",
    ).fillna(0.0)
    mapped["district_unmapped"] = mapped["district_mapping_confidence"] <= 0
    mapped = mapped.drop(columns=["area_key", "mapped_district", "confidence"])

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    mapped.to_csv(PROCESSED_DIR / "api_listings_clean.csv", index=False)
    return mapped
