from datetime import date
from decimal import Decimal
from valuation_engine.models import CompanyInput, CompanyStage, RevenueStatus, FundingRound, MethodType
from valuation_engine.methods.last_round import LastRoundAdjusted

def _make_company(round_date: date, pre_money: Decimal, raised: Decimal) -> CompanyInput:
    return CompanyInput(
        name="Test Co", stage=CompanyStage.SEED, sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=round_date, pre_money_valuation=pre_money, amount_raised=raised),
    )

def test_recent_round_no_decay():
    company = _make_company(date(2025, 6, 1), Decimal("30000000"), Decimal("10000000"))
    result = LastRoundAdjusted().compute(company, valuation_date=date(2026, 1, 1))
    assert result.method == MethodType.LAST_ROUND_ADJUSTED
    expected_base = Decimal("40000000")
    assert result.value > expected_base * Decimal("0.95")
    assert result.value < expected_base * Decimal("1.15")
    assert len(result.steps) >= 3
    assert len(result.assumptions) >= 2

def test_old_round_has_decay():
    company = _make_company(date(2023, 1, 1), Decimal("20000000"), Decimal("5000000"))
    result = LastRoundAdjusted().compute(company, valuation_date=date(2026, 1, 1))
    assert result.value < Decimal("25000000")

def test_range_is_plus_minus_15_percent():
    company = _make_company(date(2025, 6, 1), Decimal("30000000"), Decimal("10000000"))
    result = LastRoundAdjusted().compute(company, valuation_date=date(2026, 1, 1))
    expected_low = result.value * Decimal("0.85")
    expected_high = result.value * Decimal("1.15")
    assert abs(result.value_low - expected_low) < Decimal("1")
    assert abs(result.value_high - expected_high) < Decimal("1")

def test_steps_are_traceable():
    company = _make_company(date(2025, 6, 1), Decimal("30000000"), Decimal("10000000"))
    result = LastRoundAdjusted().compute(company, valuation_date=date(2026, 1, 1))
    step_descriptions = [s.description for s in result.steps]
    assert "Calculate post-money valuation" in step_descriptions
    assert "Apply time adjustment" in step_descriptions
    assert "Apply market/sector adjustment" in step_descriptions
