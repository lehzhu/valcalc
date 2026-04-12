from datetime import date
from decimal import Decimal
from valuation_engine.models import CompanyInput, CompanyStage, RevenueStatus, MethodType
from valuation_engine.methods.comps import ComparableCompanyMultiples

def _make_company(sector="b2b_saas", revenue=Decimal("3400000"), stage=CompanyStage.SERIES_A, revenue_status=RevenueStatus.GROWING_REVENUE):
    return CompanyInput(name="Test Co", stage=stage, sector=sector, revenue_status=revenue_status, current_revenue=revenue)

def test_basic_comps_valuation():
    result = ComparableCompanyMultiples().compute(_make_company(), valuation_date=date(2026, 1, 1))
    assert result.method == MethodType.COMPS
    assert Decimal("20000000") < result.value < Decimal("80000000")

def test_range_uses_percentiles():
    result = ComparableCompanyMultiples().compute(_make_company(), valuation_date=date(2026, 1, 1))
    assert result.value_low < result.value < result.value_high

def test_steps_include_benchmark_lookup():
    result = ComparableCompanyMultiples().compute(_make_company(), valuation_date=date(2026, 1, 1))
    step_descriptions = [s.description for s in result.steps]
    assert "Look up sector revenue multiple" in step_descriptions
    assert "Calculate base valuation" in step_descriptions
    assert "Apply DLOM (illiquidity discount)" in step_descriptions

def test_higher_revenue_higher_valuation():
    low = _make_company(revenue=Decimal("1000000"))
    high = _make_company(revenue=Decimal("10000000"))
    method = ComparableCompanyMultiples()
    assert method.compute(high, date(2026, 1, 1)).value > method.compute(low, date(2026, 1, 1)).value

def test_accepts_custom_multiples():
    custom = {"p25": 5.0, "median": 8.0, "p75": 12.0}
    result = ComparableCompanyMultiples().compute(_make_company(), valuation_date=date(2026, 1, 1), custom_multiples=custom)
    assert result.value < Decimal("40000000")

def test_early_revenue_higher_dlom():
    co_early = _make_company(revenue_status=RevenueStatus.EARLY_REVENUE)
    co_scaled = _make_company(revenue_status=RevenueStatus.SCALED_REVENUE)
    method = ComparableCompanyMultiples()
    # Early revenue adds +5% DLOM, scaled subtracts 2% — early should have lower value
    assert method.compute(co_early, date(2026, 1, 1)).value < method.compute(co_scaled, date(2026, 1, 1)).value

def test_later_stage_lower_dlom():
    co_seed = _make_company(stage=CompanyStage.SEED)
    co_late = _make_company(stage=CompanyStage.LATE_PRE_IPO)
    method = ComparableCompanyMultiples()
    # Late stage has much lower DLOM — higher valuation
    assert method.compute(co_late, date(2026, 1, 1)).value > method.compute(co_seed, date(2026, 1, 1)).value
