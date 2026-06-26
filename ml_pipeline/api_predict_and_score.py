from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from ml_pipeline.api_gates import DataGateError, record_error, save_quality_report
from ml_pipeline.synthetic_gated_predict_and_score import (
    REPORT_PATH,
    run_pipeline as run_synthetic_pipeline,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compatibility wrapper. The live API path is disabled for now; this "
            "runs the synthetic gated listings scorer instead."
        ),
    )
    parser.add_argument("--input", default=None)
    parser.add_argument("--min-rows", type=int, default=50)
    parser.add_argument("--min-mapping-coverage", type=float, default=0.60)
    parser.add_argument("--top-n", type=int, default=10)

    parser.add_argument("--refresh", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--transaction-type", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--emirate", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--max-pages", type=int, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--page-size", type=int, default=None, help=argparse.SUPPRESS)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    ignored = [
        name
        for name in ("refresh", "transaction_type", "emirate", "max_pages", "page_size")
        if getattr(args, name)
    ]
    if ignored:
        print(
            "Ignoring live-API flags for the synthetic gated pipeline: "
            + ", ".join(ignored)
        )

    print(
        "Live API scoring is disabled for this branch. Running "
        "ml_pipeline/synthetic_gated_predict_and_score.py instead."
    )

    synthetic_args = argparse.Namespace(
        input=args.input or "data/raw/synthetic_external_listings_raw.csv",
        min_rows=args.min_rows,
        min_mapping_coverage=args.min_mapping_coverage,
        top_n=args.top_n,
    )
    try:
        run_synthetic_pipeline(synthetic_args)
    except (DataGateError, RuntimeError) as exc:
        record_error(str(exc), "api_predict_and_score")
        save_quality_report(path=REPORT_PATH, status="failed")
        print(f"Synthetic gated pipeline failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
