from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.engine import run_valuation, run_single_method


def test_pre_revenue_company():
    company = CompanyInput(
        name="Early AI",
        stage=CompanyStage.SEED,
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(
            date=date(2025, 6, 1),
            pre_money_valuation=Decimal("10000000"),
            amount_raised=Decimal("3000000"),
        ),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.LAST_ROUND_ADJUSTED
    assert result.fair_value > 0
    assert result.fair_value_low < result.fair_value < result.fair_value_high
    assert result.explanation != ""
    assert result.audit_trail is not None
    assert result.audit_trail.input_snapshot["name"] == "Early AI"
    assert len(result.method_results) >= 1


def test_revenue_company_with_comps():
    company = CompanyInput(
        name="SaaS Co",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.GROWING_REVENUE,
        current_revenue=Decimal("5000000"),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.COMPS


def test_series_c_company_with_dcf():
    company = CompanyInput(
        name="Growth Fintech",
        stage=CompanyStage.SERIES_C_PLUS,
        sector="financials",
        revenue_status=RevenueStatus.SCALED_REVENUE,
        current_revenue=Decimal("20000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("30000000"), ebitda=Decimal("5000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("42000000"), ebitda=Decimal("10000000")),
            ProjectionPeriod(year=2028, revenue=Decimal("55000000"), ebitda=Decimal("16000000")),
        ]),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.DCF
    assert len(result.method_results) >= 2  # DCF + Comps at minimum


def test_no_data_falls_back_to_manual():
    company = CompanyInput(
        name="Mystery Co",
        stage=CompanyStage.PRE_SEED,
        sector="communication_services",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.MANUAL
    assert result.fair_value == Decimal("0")


def test_audit_trail_completeness():
    company = CompanyInput(
        name="Audit Test",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.GROWING_REVENUE,
        current_revenue=Decimal("8000000"),
        last_round=FundingRound(
            date=date(2025, 3, 1),
            pre_money_valuation=Decimal("40000000"),
            amount_raised=Decimal("10000000"),
        ),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    trail = result.audit_trail
    assert trail.input_snapshot is not None
    assert trail.method_selection_rationale != ""
    assert len(trail.recommendations) >= 1
    assert len(trail.method_results) >= 1
    assert trail.engine_version == "0.1.0"
    assert trail.timestamp is not None


def test_run_single_method_dcf():
    company = CompanyInput(
        name="DCF Test",
        stage=CompanyStage.SERIES_C_PLUS,
        sector="financials",
        revenue_status=RevenueStatus.SCALED_REVENUE,
        current_revenue=Decimal("20000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("30000000"), ebitda=Decimal("5000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("42000000"), ebitda=Decimal("10000000")),
            ProjectionPeriod(year=2028, revenue=Decimal("55000000"), ebitda=Decimal("16000000")),
        ]),
    )
    result = run_single_method(MethodType.DCF, company, valuation_date=date(2026, 1, 1))
    assert result is not None
    assert result.method == MethodType.DCF
    assert result.value > 0


def test_run_single_method_insufficient_data():
    company = CompanyInput(
        name="No Data",
        stage=CompanyStage.SEED,
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    result = run_single_method(MethodType.DCF, company)
    assert result is None
