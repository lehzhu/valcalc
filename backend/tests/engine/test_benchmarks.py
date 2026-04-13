import pytest
from decimal import Decimal
from valuation_engine.benchmarks.loader import load_benchmarks, get_sector_benchmarks


def test_load_benchmarks_returns_dict():
    data = load_benchmarks()
    assert isinstance(data, dict)
    assert "metadata" in data
    assert "sectors" in data
    assert data["metadata"]["version"] == "v2025-Q1"


def test_get_sector_benchmarks_known_sector():
    sector = get_sector_benchmarks("information_technology")
    assert "revenue_multiple" in sector
    assert "median" in sector["revenue_multiple"]
    assert sector["revenue_multiple"]["median"] > 0


def test_get_sector_benchmarks_unknown_sector():
    with pytest.raises(KeyError, match="unknown_sector"):
        get_sector_benchmarks("unknown_sector")


def test_all_sectors_have_required_fields():
    data = load_benchmarks()
    required_fields = ["revenue_multiple", "median_growth_rate", "sector_trend_factor"]
    for sector_key, sector_data in data["sectors"].items():
        for field in required_fields:
            assert field in sector_data, f"{sector_key} missing {field}"
