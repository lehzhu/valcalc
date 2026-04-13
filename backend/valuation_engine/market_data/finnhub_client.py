"""Finnhub client for market data and valuation metrics.

Requires FINNHUB_API_KEY environment variable.
Free tier: 60 calls/minute.
Docs: https://finnhub.io/docs/api

All functions return None or empty dicts on failure.
"""
from __future__ import annotations

import logging
import os
import time
import json
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

_BASE = "https://finnhub.io/api/v1"
_LAST_REQUEST = 0.0


def _api_key() -> str | None:
    return os.environ.get("FINNHUB_API_KEY")


def _get(path: str, params: dict[str, str] | None = None) -> dict | list | None:
    """HTTP GET with rate limiting (free tier: 60/min = 1/sec)."""
    key = _api_key()
    if not key:
        return None

    global _LAST_REQUEST
    elapsed = time.time() - _LAST_REQUEST
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    _LAST_REQUEST = time.time()

    query = "&".join(f"{k}={v}" for k, v in (params or {}).items())
    url = f"{_BASE}{path}?token={key}" + (f"&{query}" if query else "")

    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.debug("Finnhub request failed: %s -> %s", path, e)
        return None


def is_available() -> bool:
    """Check if Finnhub API key is configured."""
    return bool(_api_key())


def get_basic_financials(ticker: str) -> dict[str, Any]:
    """Fetch key financial metrics for a ticker.

    Returns dict with keys like evToSalesTTM, evToEbitdaTTM,
    revenueGrowthTTMYoy, marketCapitalization, etc.
    Returns empty dict on failure.
    """
    data = _get("/stock/metric", {"symbol": ticker, "metric": "all"})
    if not data or "metric" not in data:
        return {}
    return data["metric"]


def get_quote(ticker: str) -> dict[str, float]:
    """Fetch current price quote. Returns {c: current, pc: previous_close} or empty."""
    data = _get("/quote", {"symbol": ticker})
    if not data or "c" not in data:
        return {}
    return data


def get_sector_etf_performance(etf_ticker: str, period_days: int = 90) -> float | None:
    """Compute ETF price change over the given period.

    Returns fractional change (e.g., 0.05 for +5%) or None.
    """
    from datetime import datetime, timedelta

    end = datetime.now()
    start = end - timedelta(days=period_days)

    data = _get("/stock/candle", {
        "symbol": etf_ticker,
        "resolution": "D",
        "from": str(int(start.timestamp())),
        "to": str(int(end.timestamp())),
    })

    if not data or data.get("s") != "ok" or not data.get("c"):
        return None

    closes = data["c"]
    if len(closes) < 2:
        return None

    start_price = closes[0]
    end_price = closes[-1]
    if start_price <= 0:
        return None

    return (end_price - start_price) / start_price
