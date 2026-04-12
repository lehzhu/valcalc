from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.rules import recommend_methods


def test_pre_revenue_with_round():
    company = CompanyInput(
        name="Early Co",
        stage=CompanyStage.SEED,
        sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=date(2025, 6, 1), pre_money_valuation=Decimal("10000000"), amount_raised=Decimal("3000000")),
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.LAST_ROUND_ADJUSTED
    assert recs[0].is_primary is True


def test_pre_revenue_no_round():
    company = CompanyInput(
        name="Very Early Co",
        stage=CompanyStage.PRE_SEED,
        sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.MANUAL
    assert recs[0].is_primary is True


def test_early_revenue_with_benchmarks():
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="b2b_saas",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3000000"),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.COMPS


def test_revenue_with_round_gets_secondary():
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="b2b_saas",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("20000000"), amount_raised=Decimal("5000000")),
    )
    recs = recommend_methods(company)
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods
    assert MethodType.LAST_ROUND_ADJUSTED in methods


def test_growth_with_projections_gets_dcf():
    company = CompanyInput(
        name="Growth Co",
        stage=CompanyStage.GROWTH,
        sector="fintech",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("20000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("30000000"), ebitda=Decimal("5000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("42000000"), ebitda=Decimal("10000000")),
        ]),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.DCF
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods


def test_recommendations_have_rationales():
    company = CompanyInput(
        name="Test Co",
        stage=CompanyStage.SEED,
        sector="b2b_saas",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=date(2025, 6, 1), pre_money_valuation=Decimal("10000000"), amount_raised=Decimal("3000000")),
    )
    recs = recommend_methods(company)
    for rec in recs:
        assert rec.rationale != ""
