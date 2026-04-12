from datetime import date
from decimal import Decimal
from valuation_engine.models import CompanyInput, CompanyStage, RevenueStatus, MethodType, FinancialProjections, ProjectionPeriod
from valuation_engine.methods.dcf import DiscountedCashFlow

def _make_company(stage=CompanyStage.GROWTH, discount_rate=None):
    return CompanyInput(name="Test Co", stage=stage, sector="b2b_saas", revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("10000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("14000000"), ebitda=Decimal("2000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("20000000"), ebitda=Decimal("4000000")),
            ProjectionPeriod(year=2028, revenue=Decimal("28000000"), ebitda=Decimal("7000000")),
            ProjectionPeriod(year=2029, revenue=Decimal("35000000"), ebitda=Decimal("10000000")),
            ProjectionPeriod(year=2030, revenue=Decimal("42000000"), ebitda=Decimal("14000000")),
        ], discount_rate=discount_rate))

def test_basic_dcf_valuation():
    result = DiscountedCashFlow().compute(_make_company(), valuation_date=date(2026, 1, 1))
    assert result.method == MethodType.DCF
    assert result.value > 0
    assert result.value_low < result.value < result.value_high

def test_steps_include_all_dcf_phases():
    result = DiscountedCashFlow().compute(_make_company(), valuation_date=date(2026, 1, 1))
    step_descriptions = [s.description for s in result.steps]
    assert any("free cash flow" in s.lower() for s in step_descriptions)
    assert any("discount" in s.lower() for s in step_descriptions)
    assert any("terminal" in s.lower() for s in step_descriptions)

def test_custom_discount_rate_overrides_default():
    result_default = DiscountedCashFlow().compute(_make_company(), valuation_date=date(2026, 1, 1))
    result_custom = DiscountedCashFlow().compute(_make_company(discount_rate=0.10), valuation_date=date(2026, 1, 1))
    assert result_custom.value > result_default.value

def test_earlier_stage_higher_discount():
    result_growth = DiscountedCashFlow().compute(_make_company(stage=CompanyStage.GROWTH), valuation_date=date(2026, 1, 1))
    result_seed = DiscountedCashFlow().compute(_make_company(stage=CompanyStage.SEED), valuation_date=date(2026, 1, 1))
    assert result_growth.value > result_seed.value

def test_sensitivity_range():
    result = DiscountedCashFlow().compute(_make_company(), valuation_date=date(2026, 1, 1))
    spread = (result.value_high - result.value_low) / result.value
    assert spread > Decimal("0.1")
