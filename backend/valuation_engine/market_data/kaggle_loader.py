"""Load and process the Kaggle investment dataset for private-market signals.

The CSV at tests/fixtures/investment_data_kaggle.csv contains 5,000 startup
records with industry, investment amount, valuation, and growth rate.
We aggregate these per sector to derive private-market growth rate benchmarks.
"""
from __future__ import annotations

import csv
import logging
from collections import defaultdict
from pathlib import Path
from statistics import median, quantiles

from valuation_engine.market_data.sector_map import KAGGLE_INDUSTRY_MAP

logger = logging.getLogger(__name__)

_DEFAULT_PATH = Path(__file__).parent.parent.parent / "tests" / "fixtures" / "investment_data_kaggle.csv"


def load_kaggle_stats(csv_path: Path | None = None) -> dict[str, dict]:
    """Aggregate Kaggle data by GICS sector.

    Returns dict of sector_key -> {
        "median_growth_rate": float,  # fractional (0.30 = 30%)
        "investment_multiple": {"p25": float, "median": float, "p75": float},
        "sample_size": int,
    }

    Returns empty dict if the file is missing or unparseable.
    """
    path = csv_path or _DEFAULT_PATH
    if not path.exists():
        logger.debug("Kaggle CSV not found at %s", path)
        return {}

    sector_data: dict[str, list[dict]] = defaultdict(list)

    try:
        with open(path, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                industry = row.get("Industry", "").strip()
                sector_key = KAGGLE_INDUSTRY_MAP.get(industry)
                if not sector_key:
                    continue

                try:
                    valuation = float(row["Valuation (USD)"])
                    investment = float(row["Investment Amount (USD)"])
                    growth = float(row["Growth Rate (%)"])
                except (KeyError, ValueError):
                    continue

                if investment <= 0:
                    continue

                sector_data[sector_key].append({
                    "multiple": valuation / investment,
                    "growth": growth / 100,  # convert to fractional
                })
    except Exception as e:
        logger.debug("Failed to parse Kaggle CSV: %s", e)
        return {}

    result: dict[str, dict] = {}
    for sector_key, entries in sector_data.items():
        multiples = [e["multiple"] for e in entries]
        growths = [e["growth"] for e in entries]
        n = len(entries)

        if n < 3:
            continue

        q = quantiles(multiples, n=4)
        result[sector_key] = {
            "median_growth_rate": median(growths),
            "investment_multiple": {
                "p25": round(q[0], 2),
                "median": round(q[1], 2),
                "p75": round(q[2], 2),
            },
            "sample_size": n,
        }

    return result
