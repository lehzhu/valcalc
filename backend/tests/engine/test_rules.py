from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FundingRound,
)
from valuation_engine.rules import recommend_methods


def test_pre_revenue_with_round():
    company = CompanyInput(
        name="Early Co",
        stage=CompanyStage.SEED,
        sector="information_technology",
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
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.MANUAL
    assert recs[0].is_primary is True


def test_revenue_no_round_gets_comps_primary():
    """Without a round, comps is primary when revenue exists."""
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("800000"),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.COMPS


def test_revenue_with_round_gets_last_round_primary():
    """With a round, last round calibration is always primary; comps is secondary."""
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.GROWING_REVENUE,
        current_revenue=Decimal("3000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("20000000"), amount_raised=Decimal("5000000")),
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.LAST_ROUND_ADJUSTED
    assert recs[0].is_primary is True
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods


def test_series_c_with_round_and_revenue():
    """At Series C+ with revenue, last round is primary; comps is secondary."""
    company = CompanyInput(
        name="Growth Co",
        stage=CompanyStage.SERIES_C_PLUS,
        sector="financials",
        revenue_status=RevenueStatus.SCALED_REVENUE,
        current_revenue=Decimal("20000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("100000000"), amount_raised=Decimal("30000000")),
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.LAST_ROUND_ADJUSTED
    assert recs[0].is_primary is True
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods


def test_series_c_no_round_gets_comps_primary():
    """Without a round, comps is primary."""
    company = CompanyInput(
        name="Growth Co",
        stage=CompanyStage.SERIES_C_PLUS,
        sector="financials",
        revenue_status=RevenueStatus.SCALED_REVENUE,
        current_revenue=Decimal("20000000"),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.COMPS


def test_recommendations_have_rationales():
    company = CompanyInput(
        name="Test Co",
        stage=CompanyStage.SEED,
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=date(2025, 6, 1), pre_money_valuation=Decimal("10000000"), amount_raised=Decimal("3000000")),
    )
    recs = recommend_methods(company)
    for rec in recs:
        assert rec.rationale != ""
