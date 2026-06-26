from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
HUGGING_FACE_BASE_URL = (
    "https://huggingface.co/datasets/eVoost/abu-dhabi-ai-proptech-challenge/"
    "resolve/main/"
)

REQUIRED_CSVS = [
    "districts.csv",
    "sample_transactions.csv",
    "sample_parcels.csv",
    "sample_communities.csv",
    "osm_amenities.csv",
]


def load_csv(filename: str) -> pd.DataFrame:
    """Load a challenge CSV from data/ first, then Hugging Face."""
    normalized_name = filename if filename.endswith(".csv") else f"{filename}.csv"
    local_path = DATA_DIR / normalized_name

    if local_path.exists():
        print(f"Loaded {normalized_name} from local data/")
        return pd.read_csv(local_path)

    remote_url = f"{HUGGING_FACE_BASE_URL}{normalized_name}"
    try:
        frame = pd.read_csv(remote_url)
    except Exception as exc:
        raise RuntimeError(
            "Failed to load "
            f"{normalized_name}. Tried local path {local_path} and remote URL "
            f"{remote_url}. Original error: {exc}"
        ) from exc

    print(f"Loaded {normalized_name} from Hugging Face")
    return frame


def load_all_data() -> dict[str, pd.DataFrame]:
    """Load all CSVs required for the local ML prototype."""
    return {filename: load_csv(filename) for filename in REQUIRED_CSVS}
