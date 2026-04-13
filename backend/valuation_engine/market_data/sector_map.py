"""Mapping of GICS sectors to representative public tickers and sector ETFs.

Used by the benchmark refresh to compute sector-level multiples from a
curated set of large-cap public companies.
"""

# Sector ETF tickers for computing sector_trend_factor
SECTOR_ETFS: dict[str, str] = {
    "information_technology": "XLK",
    "healthcare": "XLV",
    "financials": "XLF",
    "consumer_discretionary": "XLY",
    "industrials": "XLI",
    "communication_services": "XLC",
    "energy": "XLE",
    "materials": "XLB",
    "real_estate": "XLRE",
    "consumer_staples": "XLP",
    "utilities": "XLU",
}

# Representative public companies per sector for computing multiples.
# Intentionally a small, stable set: large-cap names unlikely to delist.
SECTOR_TICKERS: dict[str, list[str]] = {
    "information_technology": ["AAPL", "MSFT", "CRM", "NOW", "ADBE", "PANW"],
    "healthcare": ["UNH", "JNJ", "LLY", "ABBV", "TMO", "ISRG"],
    "financials": ["JPM", "GS", "V", "MA", "BLK", "SCHW"],
    "consumer_discretionary": ["AMZN", "TSLA", "NKE", "SBUX", "BKNG", "LULU"],
    "industrials": ["CAT", "HON", "UPS", "GE", "DE", "LMT"],
    "communication_services": ["GOOG", "META", "NFLX", "DIS", "SPOT"],
    "energy": ["XOM", "CVX", "COP", "SLB", "EOG"],
    "materials": ["LIN", "APD", "ECL", "SHW", "NEM"],
    "real_estate": ["AMT", "PLD", "EQIX", "SPG", "O"],
    "consumer_staples": ["PG", "KO", "PEP", "COST", "WMT"],
    "utilities": ["NEE", "DUK", "SO", "AEP", "D"],
}

# Kaggle industry -> our GICS sector key
KAGGLE_INDUSTRY_MAP: dict[str, str] = {
    "AI": "information_technology",
    "SaaS": "information_technology",
    "Biotech": "healthcare",
    "HealthTech": "healthcare",
    "Fintech": "financials",
    "Blockchain": "information_technology",
    "E-commerce": "consumer_discretionary",
    "EdTech": "communication_services",
}

SECTOR_DISPLAY_NAMES: dict[str, str] = {
    "information_technology": "Information Technology",
    "healthcare": "Healthcare",
    "financials": "Financials",
    "consumer_discretionary": "Consumer Discretionary",
    "industrials": "Industrials",
    "communication_services": "Communication Services",
    "energy": "Energy",
    "materials": "Materials",
    "real_estate": "Real Estate",
    "consumer_staples": "Consumer Staples",
    "utilities": "Utilities",
}
