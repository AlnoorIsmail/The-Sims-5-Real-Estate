"""Generate a messy-but-model-aligned synthetic external listing feed.

The hidden fair-price label follows the same district, asset-type, date, and
appreciation structure as the starter-kit transaction data. Raw listing prices
still include portal-style noise and quality issues so the gated pipeline has
real cleaning work to do. Rows also carry parcel-compatible synthetic fields so
the gated scorer can run all three existing model artifacts.
"""

from __future__ import annotations

import argparse
import math
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT_DIR / "data" / "raw" / "synthetic_external_listings_raw.csv"

DISTRICTS = [
    ("Saadiyat Island", "island", "premium", 19000, 6.0, 92, 24.5450, 54.4310),
    ("Al Maryah Island", "island", "premium", 22000, 6.0, 96, 24.5000, 54.3900),
    ("Yas Island", "island", "leisure", 14000, 7.0, 88, 24.4900, 54.6030),
    ("Al Reem Island", "island", "mid_high", 13000, 7.5, 86, 24.4930, 54.4060),
    ("Al Raha Beach", "waterfront", "high", 14500, 7.0, 87, 24.4600, 54.6100),
    ("Al Bateen", "waterfront", "premium", 16000, 6.0, 90, 24.4520, 54.3320),
    ("Corniche", "central", "established", 15000, 6.5, 93, 24.4720, 54.3380),
    ("Al Khalidiyah", "central", "established", 13500, 6.8, 89, 24.4660, 54.3490),
    ("Al Zahiyah", "central", "mid", 11000, 7.5, 80, 24.4900, 54.3720),
    ("Danet Abu Dhabi", "central", "mid_high", 12000, 7.0, 82, 24.4310, 54.3900),
    ("Masdar City", "mainland", "innovation", 12000, 7.0, 90, 24.4300, 54.6140),
    ("Khalifa City", "mainland", "mid", 9500, 7.5, 72, 24.4200, 54.5800),
    ("Mohammed Bin Zayed City", "mainland", "mid_affordable", 8500, 8.0, 68, 24.3200, 54.5400),
    ("Zayed City", "mainland", "emerging", 9000, 7.5, 70, 24.3300, 54.5500),
    ("Al Maqta", "mainland", "mid", 9000, 7.5, 74, 24.4000, 54.5100),
    ("Al Shamkha", "mainland", "affordable", 7500, 8.5, 63, 24.3400, 54.7200),
    ("Al Reef", "mainland", "affordable", 7000, 8.5, 65, 24.4300, 54.7000),
    ("Al Ghadeer", "border", "affordable", 6500, 9.0, 60, 24.3000, 54.7800),
    ("Al Bahia", "coastal", "mid", 8000, 8.0, 67, 24.5500, 54.6600),
    ("Mussafah", "mainland", "industrial", 6000, 8.5, 66, 24.3500, 54.5000),
]

AREA_ALIASES = {
    "Saadiyat Island": ["Saadiyat Island", "Saadiyat"],
    "Al Maryah Island": ["Al Maryah Island", "Maryah Island"],
    "Yas Island": ["Yas Island", "Yas"],
    "Al Reem Island": ["Al Reem Island", "Reem Island", "Al Reem"],
    "Al Raha Beach": ["Al Raha Beach", "Raha Beach"],
    "Al Bateen": ["Al Bateen"],
    "Corniche": ["Corniche"],
    "Al Khalidiyah": ["Al Khalidiyah", "Khalidiyah"],
    "Al Zahiyah": ["Al Zahiyah"],
    "Danet Abu Dhabi": ["Danet Abu Dhabi"],
    "Masdar City": ["Masdar City"],
    "Khalifa City": ["Khalifa City"],
    "Mohammed Bin Zayed City": ["Mohammed Bin Zayed City"],
    "Zayed City": ["Zayed City"],
    "Al Maqta": ["Al Maqta", "Maqta"],
    "Al Shamkha": ["Al Shamkha", "Shamkha"],
    "Al Reef": ["Al Reef"],
    "Al Ghadeer": ["Al Ghadeer"],
    "Al Bahia": ["Al Bahia"],
    "Mussafah": ["Mussafah", "Mussafah Industrial"],
}

UNMAPPED_AREAS = [
    "Aljada",
    "Tilal City",
    "Dubai Marina",
    "Jumeirah Village Circle",
    "Unknown Waterfront",
    "Northern Emirates Area",
]

PROPERTY_TYPES = [
    ("studio", 2, (60, 80), (0, 0), "apartment", 1.0),
    ("apartment", 7, (60, 260), (1, 4), "apartment", 1.0),
    ("townhouse", 2, (180, 360), (2, 5), "townhouse", 1.05),
    ("villa", 2, (250, 700), (3, 7), "villa", 1.12),
    ("penthouse", 1, (190, 520), (3, 5), "apartment", 1.0),
]

LAND_USES = [
    ("residential", 5),
    ("mixed_use", 3),
    ("commercial", 3),
    ("hospitality", 2),
    ("community", 2),
    ("industrial", 2),
]
ZONE_PREFIX = {
    "residential": "RES",
    "mixed_use": "MIX",
    "commercial": "COM",
    "hospitality": "HOS",
    "community": "CMU",
    "industrial": "IND",
}
CURRENT_STATUS = [
    ("vacant", 4),
    ("under_development", 3),
    ("developed", 4),
    ("reserved", 1),
]
LANDUSE_SQM = {
    "residential": (6000, 26000),
    "mixed_use": (6000, 30000),
    "commercial": (3500, 12000),
    "hospitality": (5000, 22000),
    "community": (8000, 18000),
    "industrial": (12000, 45000),
}
LAND_VALUE_FACTOR = 0.35

QUALITY_CASES = [
    ("clean", 68),
    ("missing_area", 5),
    ("unmapped_area", 5),
    ("missing_bathrooms", 4),
    ("missing_building_id", 4),
    ("rent_sale_mislabel", 4),
    ("price_outlier_high", 3),
    ("price_outlier_low", 3),
    ("missing_price", 2),
    ("invalid_price", 1),
    ("missing_size", 1),
    ("invalid_size", 1),
]

LISTING_TYPES = [("sale", 7), ("rent", 3)]
BUYER_TYPES = [("individual", 5), ("corporate", 3), ("fund", 2), ("developer", 2)]
MODEL_START_DATE = date(2023, 1, 1)
LISTING_START_DATE = date(2023, 1, 1)
LISTING_END_DATE = date(2026, 5, 31)
APPRECIATION_PER_MONTH = 0.006


def _weighted_value(rng: random.Random, choices: list[tuple[object, int]]) -> object:
    items, weights = zip(*choices)
    return rng.choices(items, weights=weights, k=1)[0]


def _weighted_record(rng: random.Random, choices: list[tuple]) -> tuple:
    return rng.choices(choices, weights=[choice[1] for choice in choices], k=1)[0]


def _noise(rng: random.Random, pct: float) -> float:
    return max(0.35, math.exp(rng.gauss(0, pct)))


def _jitter(rng: random.Random, value: float, amount: float) -> float:
    return round(value + rng.uniform(-amount, amount), 5)


def _listed_date(rng: random.Random) -> date:
    return LISTING_START_DATE + timedelta(
        days=rng.randint(0, (LISTING_END_DATE - LISTING_START_DATE).days)
    )


def _months_from_model_start(value: date) -> int:
    return (value.year - MODEL_START_DATE.year) * 12 + (
        value.month - MODEL_START_DATE.month
    )


def _appreciation(months_from_start: int) -> float:
    return (1 + APPRECIATION_PER_MONTH) ** months_from_start


def _price_multiplier(rng: random.Random, quality_case: str) -> float:
    if quality_case == "price_outlier_high":
        return round(rng.uniform(1.45, 2.25), 4)
    if quality_case == "price_outlier_low":
        return round(rng.uniform(0.45, 0.78), 4)
    return round(_noise(rng, 0.13), 4)


def _community_profile(
    rng: random.Random,
    profile: str,
    infrastructure_score: int,
) -> dict[str, float]:
    demand_base = {
        "premium": 48,
        "established": 55,
        "mid_high": 60,
        "leisure": 58,
        "high": 57,
        "innovation": 45,
        "mid": 70,
        "emerging": 74,
        "mid_affordable": 80,
        "affordable": 84,
        "industrial": 86,
        "border": 82,
        "coastal": 67,
    }.get(profile, 65)
    demand = int(min(95, max(35, rng.gauss(demand_base, 7))))
    mobility = int(min(95, max(45, infrastructure_score - 5 + rng.gauss(0, 8))))
    resident_experience = int(
        min(
            95,
            max(
                50,
                150
                - demand
                + rng.gauss(0, 6)
                - (5 if profile == "industrial" else 0),
            ),
        )
    )
    return {
        "avg_population_estimate": round(max(4000, rng.gauss(60000, 45000)), 2),
        "avg_occupancy_rate": round(min(0.98, max(0.65, rng.gauss(0.88, 0.07))), 4),
        "avg_service_demand_index": float(demand),
        "avg_mobility_score": float(mobility),
        "avg_resident_experience_score": float(min(92, resident_experience)),
    }


def _amenity_profile(rng: random.Random, area_type: str, infrastructure_score: int) -> dict[str, int]:
    base = max(10, int(infrastructure_score * rng.uniform(1.0, 7.0)))
    if area_type in {"central", "island", "waterfront"}:
        base = int(base * rng.uniform(1.25, 1.8))
    elif area_type in {"border", "coastal"}:
        base = int(base * rng.uniform(0.55, 0.9))

    education = int(base * rng.uniform(0.04, 0.14))
    healthcare = int(base * rng.uniform(0.04, 0.18))
    retail = int(base * rng.uniform(0.08, 0.24))
    services = int(base * rng.uniform(0.05, 0.18))
    community = int(base * rng.uniform(0.10, 0.35))
    mobility = int(base * rng.uniform(0.06, 0.26))
    total = max(
        base,
        education + healthcare + retail + services + community + mobility,
    )
    return {
        "amenity_count_total": total,
        "amenity_count_education": education,
        "amenity_count_healthcare": healthcare,
        "amenity_count_retail": retail,
        "amenity_count_services": services,
        "amenity_count_community": community,
        "amenity_count_mobility": mobility,
    }


def _development_score(
    rng: random.Random,
    infrastructure_score: int,
    current_status: str,
    land_use: str,
    community: dict[str, float],
    amenities: dict[str, int],
) -> int:
    status_bonus = {
        "vacant": 12,
        "under_development": 8,
        "reserved": 3,
        "developed": -6,
    }[current_status]
    land_use_bonus = {
        "mixed_use": 6,
        "commercial": 4,
        "residential": 3,
        "hospitality": 2,
        "community": 1,
        "industrial": -4,
    }[land_use]
    score = (
        0.32 * infrastructure_score
        + 0.23 * community["avg_service_demand_index"]
        + 0.15 * community["avg_mobility_score"]
        + 0.10 * community["avg_resident_experience_score"]
        + 0.05 * min(100, amenities["amenity_count_total"] / 8)
        + status_bonus
        + land_use_bonus
        + rng.gauss(0, 6)
    )
    return int(min(100, max(30, round(score))))


def _base_row(rng: random.Random, row_number: int) -> dict:
    district = rng.choice(DISTRICTS)
    (
        district_name,
        area_type,
        profile,
        base_sale_aed_sqm,
        gross_yield_pct,
        infrastructure_score,
        latitude,
        longitude,
    ) = district
    (
        property_type,
        _weight,
        size_range,
        bedroom_range,
        asset_type,
        asset_multiplier,
    ) = _weighted_record(rng, PROPERTY_TYPES)
    size = rng.randint(*size_range)
    bedrooms = 0 if property_type == "studio" else rng.randint(*bedroom_range)
    bathrooms = max(1, bedrooms + rng.choice([-1, 0, 0, 1]))
    listed_at = _listed_date(rng)
    transaction_months = _months_from_model_start(listed_at)
    fair_price_per_sqm = int(
        round(
            base_sale_aed_sqm
            * asset_multiplier
            * _appreciation(transaction_months)
            * _noise(rng, 0.04)
        )
    )
    quality_case = _weighted_value(rng, QUALITY_CASES)
    price_multiplier = _price_multiplier(rng, quality_case)
    listing_type = _weighted_value(rng, LISTING_TYPES)

    if listing_type == "sale":
        price = int(round(fair_price_per_sqm * size * price_multiplier, -3))
    else:
        annual_rent = (
            fair_price_per_sqm
            * size
            * (gross_yield_pct / 100)
            * price_multiplier
        )
        price = int(round(annual_rent, -3))

    transaction_type = listing_type
    if quality_case == "rent_sale_mislabel":
        transaction_type = "rent" if listing_type == "sale" else "sale"

    area = rng.choice(AREA_ALIASES[district_name])
    if quality_case == "missing_area":
        area = ""
    elif quality_case == "unmapped_area":
        area = rng.choice(UNMAPPED_AREAS)

    output_price: int | None = price
    output_size: int | None = size
    if quality_case == "missing_price":
        output_price = None
    elif quality_case == "invalid_price":
        output_price = rng.choice([0, -1, -abs(price)])
    elif quality_case == "missing_size":
        output_size = None
    elif quality_case == "invalid_size":
        output_size = rng.choice([0, -1, -abs(size)])

    output_bathrooms: int | None = bathrooms
    if quality_case == "missing_bathrooms":
        output_bathrooms = None

    building_id = f"BLD-{rng.randint(1, 9999):04d}"
    if quality_case == "missing_building_id":
        building_id = ""

    land_use = _weighted_value(rng, LAND_USES)
    parcel_size_min, parcel_size_max = LANDUSE_SQM[land_use]
    parcel_size_sqm = rng.randint(parcel_size_min, parcel_size_max)
    current_status = _weighted_value(rng, CURRENT_STATUS)
    parcel_infrastructure_score = int(
        min(100, max(35, infrastructure_score + rng.gauss(0, 6)))
    )
    community_profile = _community_profile(rng, profile, infrastructure_score)
    amenity_profile = _amenity_profile(rng, area_type, infrastructure_score)
    synthetic_estimated_value_aed = int(
        round(
            base_sale_aed_sqm
            * LAND_VALUE_FACTOR
            * parcel_size_sqm
            * _noise(rng, 0.12),
            -4,
        )
    )
    synthetic_development_potential_score = _development_score(
        rng,
        parcel_infrastructure_score,
        current_status,
        land_use,
        community_profile,
        amenity_profile,
    )

    return {
        "listing_id": f"SYN-LST-{row_number:06d}",
        "price": output_price,
        "built_up_area_sqm": output_size,
        "transaction_type": transaction_type,
        "area": area,
        "property_type": property_type,
        "asset_type": asset_type,
        "bedrooms": bedrooms,
        "bathrooms": output_bathrooms,
        "buyer_type": _weighted_value(rng, BUYER_TYPES),
        "building_id": building_id,
        "listed_at": listed_at.isoformat(),
        "latitude": _jitter(rng, latitude, 0.018),
        "longitude": _jitter(rng, longitude, 0.022),
        "zone": f"Z-{ZONE_PREFIX[land_use]}-{rng.randint(1, 5):02d}",
        "land_use": land_use,
        "parcel_size_sqm": parcel_size_sqm,
        "current_status": current_status,
        "infrastructure_score": parcel_infrastructure_score,
        **community_profile,
        **amenity_profile,
        "synthetic_true_district": district_name,
        "synthetic_fair_price_per_sqm": fair_price_per_sqm,
        "synthetic_estimated_value_aed": synthetic_estimated_value_aed,
        "synthetic_development_potential_score": synthetic_development_potential_score,
        "synthetic_quality_case": quality_case,
        "synthetic_price_multiplier": price_multiplier,
    }


def generate_synthetic_external_listings(rows: int, seed: int) -> pd.DataFrame:
    rng = random.Random(seed)
    return pd.DataFrame(_base_row(rng, index) for index in range(1, rows + 1))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a deterministic synthetic external-style listings feed.",
    )
    parser.add_argument("--rows", type=int, default=50_000)
    parser.add_argument("--seed", type=int, default=20260626)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    if args.rows <= 0:
        raise SystemExit("--rows must be greater than 0")

    output = args.output
    if not output.is_absolute():
        output = ROOT_DIR / output
    output.parent.mkdir(parents=True, exist_ok=True)

    frame = generate_synthetic_external_listings(rows=args.rows, seed=args.seed)
    frame.to_csv(output, index=False)
    print(f"Saved {len(frame):,} synthetic external listing rows to {output}")
    print("This dataset is synthetic and is not real UAE API data.")


if __name__ == "__main__":
    main()
