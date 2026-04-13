"""SEC EDGAR client for public company fundamentals.

Uses the free XBRL companyfacts API (no key required).
Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

All functions return None or empty dicts on failure.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import urllib.request
import json

logger = logging.getLogger(__name__)

_BASE = "https://data.sec.gov"
_HEADERS = {"User-Agent": "ValCalc/1.0 audit-tool@example.com", "Accept": "application/json"}
_TICKER_MAP: dict[str, str] | None = None
_LAST_REQUEST = 0.0


def _get(url: str) -> dict | None:
    """HTTP GET with rate limiting (EDGAR asks for max 10 req/sec)."""
    global _LAST_REQUEST
    elapsed = time.time() - _LAST_REQUEST
    if elapsed < 0.12:
        time.sleep(0.12 - elapsed)
    _LAST_REQUEST = time.time()

    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.debug("EDGAR request failed: %s -> %s", url, e)
        return None


def _load_ticker_map() -> dict[str, str]:
    """Load ticker -> CIK mapping from EDGAR."""
    global _TICKER_MAP
    if _TICKER_MAP is not None:
        return _TICKER_MAP

    data = _get("https://www.sec.gov/files/company_tickers.json")
    if not data:
        _TICKER_MAP = {}
        return _TICKER_MAP

    mapping: dict[str, str] = {}
    for entry in data.values():
        ticker = str(entry.get("ticker", "")).upper()
        cik = str(entry.get("cik_str", ""))
        if ticker and cik:
            mapping[ticker] = cik.zfill(10)

    _TICKER_MAP = mapping
    return _TICKER_MAP


def get_company_facts(ticker: str) -> dict[str, Any] | None:
    """Fetch XBRL facts for a ticker. Returns the full companyfacts JSON or None."""
    ticker_map = _load_ticker_map()
    cik = ticker_map.get(ticker.upper())
    if not cik:
        logger.debug("EDGAR: no CIK found for %s", ticker)
        return None

    return _get(f"{_BASE}/api/xbrl/companyfacts/CIK{cik}.json")


def get_latest_annual_revenue(ticker: str) -> float | None:
    """Extract the most recent annual revenue from EDGAR filings."""
    facts = get_company_facts(ticker)
    if not facts:
        return None

    us_gaap = facts.get("facts", {}).get("us-gaap", {})

    # Try common revenue tags in order of preference
    for tag in (
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        "Revenue",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
    ):
        concept = us_gaap.get(tag)
        if not concept:
            continue

        units = concept.get("units", {})
        usd = units.get("USD", [])
        if not usd:
            continue

        # Filter for annual (10-K) filings
        annuals = [
            e for e in usd
            if e.get("form") == "10-K" and e.get("val") is not None
        ]
        if not annuals:
            continue

        # Most recent by end date
        annuals.sort(key=lambda e: e.get("end", ""), reverse=True)
        return float(annuals[0]["val"])

    return None


def get_latest_annual_metrics(ticker: str) -> dict[str, float | None]:
    """Extract revenue and operating income from the most recent 10-K."""
    facts = get_company_facts(ticker)
    if not facts:
        return {"revenue": None, "operating_income": None}

    us_gaap = facts.get("facts", {}).get("us-gaap", {})

    def _latest_annual(tags: list[str]) -> float | None:
        for tag in tags:
            concept = us_gaap.get(tag)
            if not concept:
                continue
            usd = concept.get("units", {}).get("USD", [])
            annuals = [e for e in usd if e.get("form") == "10-K" and e.get("val") is not None]
            if annuals:
                annuals.sort(key=lambda e: e.get("end", ""), reverse=True)
                return float(annuals[0]["val"])
        return None

    return {
        "revenue": _latest_annual([
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "Revenues", "Revenue", "SalesRevenueNet",
        ]),
        "operating_income": _latest_annual([
            "OperatingIncomeLoss", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        ]),
    }
