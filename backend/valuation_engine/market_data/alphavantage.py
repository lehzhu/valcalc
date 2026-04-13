"""Alpha Vantage client for sector performance data.

Requires ALPHAVANTAGE_API_KEY environment variable.
Free tier: 25 requests/day.
Docs: https://www.alphavantage.co/documentation/

All functions return None or empty dicts on failure.
"""
from __future__ import annotations

import logging
import os
import json
import urllib.request

logger = logging.getLogger(__name__)

_BASE = "https://www.alphavantage.co/query"


def _api_key() -> str | None:
    return os.environ.get("ALPHAVANTAGE_API_KEY")


def _get(params: dict[str, str]) -> dict | None:
    key = _api_key()
    if not key:
        return None

    params["apikey"] = key
    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{_BASE}?{query}"

    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            # Alpha Vantage returns error messages in the response body
            if "Error Message" in data or "Note" in data:
                logger.debug("Alpha Vantage error: %s", data.get("Error Message") or data.get("Note"))
                return None
            return data
    except Exception as e:
        logger.debug("Alpha Vantage request failed: %s", e)
        return None


def is_available() -> bool:
    """Check if Alpha Vantage API key is configured."""
    return bool(_api_key())


def get_sector_performance() -> dict[str, dict[str, str]]:
    """Fetch real-time sector performance.

    Returns a dict keyed by time period (e.g., "Rank A: Real-Time Performance",
    "Rank F: Year-to-Date (YTD) Performance"), each containing sector -> pct strings.

    Sector names are like "Information Technology", "Health Care", etc.
    Returns empty dict on failure.
    """
    data = _get({"function": "SECTOR"})
    if not data:
        return {}
    # Remove metadata key
    return {k: v for k, v in data.items() if k.startswith("Rank")}


# Alpha Vantage sector names -> our GICS keys
_AV_SECTOR_MAP = {
    "Information Technology": "information_technology",
    "Health Care": "healthcare",
    "Financials": "financials",
    "Consumer Discretionary": "consumer_discretionary",
    "Industrials": "industrials",
    "Communication Services": "communication_services",
    "Energy": "energy",
    "Materials": "materials",
    "Real Estate": "real_estate",
    "Consumer Staples": "consumer_staples",
    "Utilities": "utilities",
}


def get_sector_trends(period_key: str = "Rank E: Year-to-Date (YTD) Performance") -> dict[str, float]:
    """Get sector trend factors as fractional changes.

    Returns dict of our_sector_key -> float (e.g., 0.05 for +5%).
    Returns empty dict on failure.
    """
    perf = get_sector_performance()
    if not perf:
        return {}

    period_data = perf.get(period_key, {})
    if not period_data:
        # Try any available period
        for key in ("Rank D: Month-to-Date Performance", "Rank C: 1 Month Performance"):
            period_data = perf.get(key, {})
            if period_data:
                break

    result: dict[str, float] = {}
    for av_name, our_key in _AV_SECTOR_MAP.items():
        pct_str = period_data.get(av_name, "")
        if pct_str:
            try:
                result[our_key] = float(pct_str.rstrip("%")) / 100
            except ValueError:
                pass

    return result
