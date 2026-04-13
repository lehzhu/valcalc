from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FundingRound,
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


def test_series_c_company_no_round_gets_comps():
    """Without a round, Series C+ with revenue falls back to comps primary."""
    company = CompanyInput(
        name="Growth Fintech",
        stage=CompanyStage.SERIES_C_PLUS,
        sector="financials",
        revenue_status=RevenueStatus.SCALED_REVENUE,
        current_revenue=Decimal("20000000"),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.COMPS
    assert len(result.method_results) >= 1  # Comps


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


def test_run_single_method_comps():
    company = CompanyInput(
        name="Comps Test",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.GROWING_REVENUE,
        current_revenue=Decimal("5000000"),
    )
    result = run_single_method(MethodType.COMPS, company, valuation_date=date(2026, 1, 1))
    assert result is not None
    assert result.method == MethodType.COMPS
    assert result.value > 0


def test_run_single_method_insufficient_data():
    company = CompanyInput(
        name="No Data",
        stage=CompanyStage.SEED,
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    result = run_single_method(MethodType.COMPS, company)
    assert result is None


def test_reasoning_trace_present():
    """Reasoning trace should be included in engine output with all sections."""
    company = CompanyInput(
        name="Trace Test",
        stage=CompanyStage.SERIES_A,
        sector="information_technology",
        revenue_status=RevenueStatus.GROWING_REVENUE,
        current_revenue=Decimal("5000000"),
        last_round=FundingRound(
            date=date(2025, 6, 1),
            pre_money_valuation=Decimal("30000000"),
            amount_raised=Decimal("10000000"),
        ),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    trace = result.reasoning_trace
    assert trace is not None
    assert "conclusion" in trace
    assert "calibration_steps" in trace
    assert "assumptions_table" in trace
    assert "data_sources" in trace
    assert "method_selection" in trace

    # Conclusion has required fields
    assert trace["conclusion"]["fair_value_display"] != ""
    assert trace["conclusion"]["range"] != ""

    # Steps are in reverse order (conclusion first)
    steps = trace["calibration_steps"]
    assert len(steps) >= 3
    assert steps[0]["description"] == "Calibrated fair value conclusion"

    # Each step has equation and working separated
    for step in steps:
        assert "equation" in step
        assert "working" in step
        assert "result" in step

    # Assumptions have citations
    for a in trace["assumptions_table"]:
        assert a["source"] is not None
        assert a["source"] != ""
