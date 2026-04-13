"""Benchmark refresh: pull from EDGAR, Finnhub, Alpha Vantage, and Kaggle
to produce a new benchmark JSON file.

Sources are tried in order; missing API keys or failures are silently
skipped and the next source fills the gap. If all external sources fail,
the existing benchmark file is left untouched.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from statistics import median, quantiles

from valuation_engine.market_data import edgar, finnhub_client, alphavantage, kaggle_loader
from valuation_engine.market_data.sector_map import (
    SECTOR_TICKERS, SECTOR_ETFS, SECTOR_DISPLAY_NAMES,
)
from valuation_engine.benchmarks.loader import clear_cache

logger = logging.getLogger(__name__)
_BENCHMARKS_DIR = Path(__file__).parent.parent / "benchmarks" / "data"


def refresh_benchmarks(output_path: Path | None = None) -> dict:
    """Pull market data from all available sources and write a benchmark file.

    Returns the benchmark dict (same shape as benchmarks-v2025-Q1.json).
    """
    today = date.today()
    version = f"v{today.year}-Q{(today.month - 1) // 3 + 1}"

    sources_used: list[str] = []

    # --- 1. Kaggle private-market data (always available) ----------------
    kaggle = kaggle_loader.load_kaggle_stats()
    if kaggle:
        sources_used.append("Kaggle investment dataset")
        logger.info("Loaded Kaggle data for %d sectors", len(kaggle))

    # --- 2. Finnhub: public company multiples ----------------------------
    finnhub_multiples: dict[str, dict] = {}
    if finnhub_client.is_available():
        sources_used.append("Finnhub")
        finnhub_multiples = _fetch_finnhub_multiples()
        logger.info("Fetched Finnhub multiples for %d sectors", len(finnhub_multiples))
    else:
        logger.info("Finnhub: no API key, skipping")

    # --- 3. Sector trend factors -----------------------------------------
    sector_trends: dict[str, float] = {}

    # Try Finnhub sector ETFs first
    if finnhub_client.is_available():
        sector_trends = _fetch_finnhub_sector_trends()
        if sector_trends:
            logger.info("Fetched sector trends from Finnhub ETFs")

    # Fall back to Alpha Vantage
    if not sector_trends and alphavantage.is_available():
        sector_trends = alphavantage.get_sector_trends()
        if sector_trends:
            sources_used.append("Alpha Vantage")
            logger.info("Fetched sector trends from Alpha Vantage")
        else:
            logger.info("Alpha Vantage: no data returned")
    elif not sector_trends:
        logger.info("Alpha Vantage: no API key, skipping")

    # --- 4. EDGAR: revenue validation (always available) -----------------
    edgar_revenues = _fetch_edgar_revenues()
    if edgar_revenues:
        sources_used.append("SEC EDGAR")
        logger.info("Fetched EDGAR revenues for %d tickers", len(edgar_revenues))

    # --- 5. Assemble benchmark JSON --------------------------------------
    if not sources_used:
        logger.warning("No market data sources available. Keeping existing benchmarks.")
        return {}

    # Load existing benchmarks as baseline
    existing = _load_existing()

    sectors: dict[str, dict] = {}
    for sector_key, display_name in SECTOR_DISPLAY_NAMES.items():
        sector: dict = {"display_name": display_name}

        # Revenue multiples: prefer Finnhub, fall back to existing
        fm = finnhub_multiples.get(sector_key)
        if fm and fm.get("revenue_multiple"):
            sector["revenue_multiple"] = fm["revenue_multiple"]
            sector["ebitda_multiple"] = fm.get("ebitda_multiple", existing.get(sector_key, {}).get("ebitda_multiple", {"p25": 8, "median": 12, "p75": 18}))
        else:
            ex = existing.get(sector_key, {})
            sector["revenue_multiple"] = ex.get("revenue_multiple", {"p25": 4.0, "median": 7.0, "p75": 12.0})
            sector["ebitda_multiple"] = ex.get("ebitda_multiple", {"p25": 8, "median": 12, "p75": 18})

        # Growth rate: prefer Kaggle private-market signal, fall back
        kg = kaggle.get(sector_key)
        if kg:
            sector["median_growth_rate"] = round(kg["median_growth_rate"], 4)
        else:
            sector["median_growth_rate"] = existing.get(sector_key, {}).get("median_growth_rate", 0.20)

        # Sector trend: prefer live data, fall back to existing
        if sector_key in sector_trends:
            sector["sector_trend_factor"] = round(sector_trends[sector_key], 4)
        else:
            sector["sector_trend_factor"] = existing.get(sector_key, {}).get("sector_trend_factor", 0.0)

        sectors[sector_key] = sector

    benchmark = {
        "metadata": {
            "version": version,
            "source": f"Market data refresh ({', '.join(sources_used)})",
            "effective_date": today.isoformat(),
        },
        "sectors": sectors,
    }

    # Write to file
    out = output_path or _BENCHMARKS_DIR / f"benchmarks-{version}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as f:
        json.dump(benchmark, f, indent=2)
    logger.info("Wrote benchmarks to %s", out)

    # Clear the loader cache so the new data is picked up
    clear_cache()

    return benchmark


def _fetch_finnhub_multiples() -> dict[str, dict]:
    """Fetch EV/Sales and EV/EBITDA from Finnhub for representative tickers."""
    result: dict[str, dict] = {}

    for sector_key, tickers in SECTOR_TICKERS.items():
        ev_sales: list[float] = []
        ev_ebitda: list[float] = []

        for ticker in tickers:
            metrics = finnhub_client.get_basic_financials(ticker)
            if not metrics:
                continue

            evs = metrics.get("evToSalesTTM") or metrics.get("psTTM")
            if evs and evs > 0:
                ev_sales.append(evs)

            eve = metrics.get("evToEbitdaTTM") or metrics.get("peNormalizedAnnual")
            if eve and eve > 0:
                ev_ebitda.append(eve)

        sector: dict = {}
        if len(ev_sales) >= 3:
            q = quantiles(ev_sales, n=4)
            sector["revenue_multiple"] = {
                "p25": round(q[0], 1),
                "median": round(q[1], 1),
                "p75": round(q[2], 1),
            }
        if len(ev_ebitda) >= 3:
            q = quantiles(ev_ebitda, n=4)
            sector["ebitda_multiple"] = {
                "p25": round(q[0], 1),
                "median": round(q[1], 1),
                "p75": round(q[2], 1),
            }

        if sector:
            result[sector_key] = sector

    return result


def _fetch_finnhub_sector_trends() -> dict[str, float]:
    """Fetch sector ETF price changes from Finnhub."""
    result: dict[str, float] = {}
    for sector_key, etf in SECTOR_ETFS.items():
        change = finnhub_client.get_sector_etf_performance(etf, period_days=90)
        if change is not None:
            result[sector_key] = change
    return result


def _fetch_edgar_revenues() -> dict[str, float]:
    """Fetch latest annual revenue from EDGAR for representative tickers."""
    result: dict[str, float] = {}
    for tickers in SECTOR_TICKERS.values():
        for ticker in tickers[:2]:  # Only fetch first 2 per sector to limit requests
            rev = edgar.get_latest_annual_revenue(ticker)
            if rev:
                result[ticker] = rev
    return result


def _load_existing() -> dict[str, dict]:
    """Load the current benchmark sectors as a fallback baseline."""
    try:
        files = sorted(_BENCHMARKS_DIR.glob("benchmarks-*.json"))
        if files:
            with open(files[-1]) as f:
                data = json.load(f)
            return data.get("sectors", {})
    except Exception:
        pass
    return {}
