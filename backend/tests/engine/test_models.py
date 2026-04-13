from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput,
    CompanyStage,
    RevenueStatus,
    MethodType,
    FundingRound,
    ProjectionPeriod,
    FinancialProjections,
    ComputationStep,
    Assumption,
    Source,
    MethodResult,
    MethodRecommendation,
    ValuationResult,
    AuditTrail,
)


def test_company_input_minimal():
    company = CompanyInput(
        name="Acme Corp",
        stage=CompanyStage.SEED,
        sector="information_technology",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    assert company.name == "Acme Corp"
    assert company.last_round is None
    assert company.projections is None


def test_company_input_full():
    company = CompanyInput(
        name="Beta Inc",
        stage=CompanyStage.SERIES_A,
        sector="financials",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3400000"),
        last_round=FundingRound(
            date=date(2025, 6, 15),
            pre_money_valuation=Decimal("30000000"),
            amount_raised=Decimal("10000000"),
            lead_investor="Sequoia",
        ),
        projections=FinancialProjections(
            periods=[
                ProjectionPeriod(year=2026, revenue=Decimal("5000000"), ebitda=Decimal("500000"), growth_rate=0.47),
                ProjectionPeriod(year=2027, revenue=Decimal("8000000"), ebitda=Decimal("1200000"), growth_rate=0.60),
            ]
        ),
        auditor_notes="Strong product-market fit signals",
    )
    assert company.last_round.lead_investor == "Sequoia"
    assert len(company.projections.periods) == 2


def test_method_result_construction():
    result = MethodResult(
        method=MethodType.COMPS,
        value=Decimal("42000000"),
        value_low=Decimal("36000000"),
        value_high=Decimal("48000000"),
        steps=[
            ComputationStep(
                description="Apply sector revenue multiple",
                formula="revenue × multiple",
                inputs={"revenue": "$3.4M", "multiple": "12.5x"},
                output="$42.5M",
            )
        ],
        assumptions=[
            Assumption(
                name="Revenue multiple",
                value="12.5x",
                rationale="B2B SaaS median",
                source="Benchmark v2025-Q1",
                overrideable=True,
            )
        ],
        sources=[
            Source(name="Sector Benchmark", version="v2025-Q1", effective_date=date(2025, 3, 31))
        ],
        is_primary=True,
    )
    assert result.value == Decimal("42000000")
    assert result.steps[0].formula == "revenue × multiple"


def test_enum_values():
    assert CompanyStage.PRE_SEED.value == "pre_seed"
    assert CompanyStage.SERIES_C_PLUS.value == "series_c_plus"
    assert RevenueStatus.SCALED_REVENUE.value == "scaled_revenue"
    assert MethodType.LAST_ROUND_ADJUSTED.value == "last_round_adjusted"
