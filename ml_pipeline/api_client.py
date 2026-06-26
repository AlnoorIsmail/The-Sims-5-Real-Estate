from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT_DIR / "data" / "raw"
API_BASE_URL = "https://uae-data-api.evoost-ai.workers.dev/v1"
API_KEY_ENV = "UAE_DATA_API_KEY"


def _api_key() -> str:
    key = os.environ.get(API_KEY_ENV, "").strip()
    if not key:
        raise RuntimeError(
            f"{API_KEY_ENV} is not set. Export it before fetching live UAE API "
            f"data, for example: export {API_KEY_ENV}=\"uae_...\""
        )
    return key


def _get_json(path: str, params: dict[str, object] | None = None) -> Any:
    query = f"?{urlencode(params or {})}" if params else ""
    request = Request(
        f"{API_BASE_URL}{path}{query}",
        headers={
            "accept": "application/json",
            "x-api-key": _api_key(),
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"UAE data API request failed with HTTP {exc.code}: {body}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"UAE data API request failed: {exc.reason}") from exc


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if not isinstance(payload, dict):
        return []

    for key in ("listings", "areas", "data", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = _extract_rows(value)
            if nested:
                return nested

    return []


def _write_rows(rows: list[dict[str, Any]], json_path: Path, csv_path: Path) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8") as file:
        json.dump(rows, file, indent=2)
    pd.json_normalize(rows).to_csv(csv_path, index=False)


def fetch_listings(
    transaction_type: str | None = None,
    emirate: str = "Abu Dhabi",
    max_pages: int = 5,
    page_size: int = 100,
) -> pd.DataFrame:
    """Fetch raw live listings from the external UAE data API."""

    rows: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        params: dict[str, object] = {
            "emirate": emirate,
            "limit": page_size,
            "page": page,
        }
        if transaction_type:
            params["transaction_type"] = transaction_type

        page_rows = _extract_rows(_get_json("/listings/search", params))
        if not page_rows:
            break

        rows.extend(page_rows)
        if len(page_rows) < page_size:
            break

    _write_rows(
        rows,
        RAW_DIR / "api_listings_raw.json",
        RAW_DIR / "api_listings_raw.csv",
    )
    return pd.json_normalize(rows)


def fetch_areas() -> pd.DataFrame:
    """Fetch raw area metadata from the external UAE data API."""

    rows = _extract_rows(_get_json("/areas"))
    _write_rows(
        rows,
        RAW_DIR / "api_areas_raw.json",
        RAW_DIR / "api_areas_raw.csv",
    )
    return pd.json_normalize(rows)
