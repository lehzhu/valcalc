from decimal import Decimal
from datetime import date

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, FundingRound,
    FinancialProjections, ProjectionPeriod, ConfidenceLevel, MethodType,
)
from valuation_engine.confidence import compute_completeness, compute_confidence


def test_minimal_input_completeness():
    company = CompanyInput(
        name="Test", stage=CompanyStage.SEED, sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    score = compute_completeness(company)
    assert 0.45 <= score <= 0.55  # name + stage + sector + revenue_status


def test_full_input_completeness():
    company = CompanyInput(
        name="Test", stage=CompanyStage.GROWTH, sector="b2b_saas",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("10000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("50000000"), amount_raised=Decimal("10000000")),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("15000000"), ebitda=Decimal("3000000")),
        ]),
        auditor_notes="Some notes",
    )
    score = compute_completeness(company)
    assert score >= 0.95


def test_high_confidence():
    assert compute_confidence(0.85, MethodType.COMPS) == ConfidenceLevel.HIGH


def test_medium_confidence():
    assert compute_confidence(0.60, MethodType.COMPS) == ConfidenceLevel.MEDIUM


def test_low_confidence_from_incomplete_data():
    assert compute_confidence(0.40, MethodType.COMPS) == ConfidenceLevel.LOW


def test_manual_method_always_low():
    assert compute_confidence(0.90, MethodType.MANUAL) == ConfidenceLevel.LOW
