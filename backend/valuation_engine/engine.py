from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, ValuationResult, MethodType, MethodResult,
)
from valuation_engine.rules import recommend_methods
from valuation_engine.methods.last_round import LastRoundAdjusted
from valuation_engine.methods.comps import ComparableCompanyMultiples
from valuation_engine.methods.dcf import DiscountedCashFlow
from valuation_engine.explanation import generate_explanation
from valuation_engine.audit_trail import build_audit_trail


def run_valuation(company: CompanyInput, valuation_date: date | None = None) -> ValuationResult:
    """Run a complete valuation for a company. Returns result with full audit trail."""
    if valuation_date is None:
        valuation_date = date.today()

    # Step 1: Get method recommendations
    recommendations = recommend_methods(company)

    # Step 2: Run each recommended method
    method_results: list[MethodResult] = []

    for rec in recommendations:
        result = _run_method(rec.method, company, valuation_date)
        if result is not None:
            result.is_primary = rec.is_primary
            method_results.append(result)

    # Step 3: Determine primary result
    primary_results = [r for r in method_results if r.is_primary]
    if primary_results:
        primary = primary_results[0]
    elif method_results:
        primary = method_results[0]
        primary.is_primary = True
    else:
        # No methods could run — return zero with manual flag
        primary = MethodResult(
            method=MethodType.MANUAL,
            value=Decimal("0"),
            value_low=Decimal("0"),
            value_high=Decimal("0"),
            steps=[],
            assumptions=[],
            sources=[],
            is_primary=True,
        )
        method_results = [primary]

    # Step 4: Build key inputs for explanation
    key_inputs = _extract_key_inputs(primary, company)

    # Step 5: Generate explanation
    explanation = generate_explanation(
        method=primary.method,
        fair_value=primary.value,
        sector=company.sector,
        key_inputs=key_inputs,
    )

    # Step 6: Build audit trail
    audit_trail = build_audit_trail(
        company=company,
        recommendations=recommendations,
        method_results=method_results,
    )

    return ValuationResult(
        primary_method=primary.method,
        fair_value=primary.value,
        fair_value_low=primary.value_low,
        fair_value_high=primary.value_high,
        explanation=explanation,
        method_results=method_results,
        audit_trail=audit_trail,
    )


def run_single_method(
    method: MethodType,
    company: CompanyInput,
    valuation_date: date | None = None,
    overrides: dict | None = None,
) -> MethodResult | None:
    """Run a single valuation method. Returns None if prerequisites aren't met."""
    if valuation_date is None:
        valuation_date = date.today()
    return _run_method(method, company, valuation_date, overrides=overrides)


def _run_method(method_type: MethodType, company: CompanyInput, valuation_date: date, overrides: dict | None = None) -> MethodResult | None:
    """Run a single valuation method. Returns None if prerequisites aren't met."""
    if method_type == MethodType.LAST_ROUND_ADJUSTED:
        if company.last_round is None:
            return None
        return LastRoundAdjusted().compute(company, valuation_date, overrides=overrides)

    if method_type == MethodType.COMPS:
        if company.current_revenue is None or company.current_revenue <= 0:
            return None
        return ComparableCompanyMultiples().compute(company, valuation_date, overrides=overrides)

    if method_type == MethodType.DCF:
        if (
            company.projections is None
            or len(company.projections.periods) < 2
            or not any(p.ebitda and p.ebitda > 0 for p in company.projections.periods)
        ):
            return None
        return DiscountedCashFlow().compute(company, valuation_date, overrides=overrides)

    if method_type == MethodType.MANUAL:
        return None  # Manual is handled via override endpoint, not auto-run

    return None


def _extract_key_inputs(primary: MethodResult, company: CompanyInput) -> dict[str, str]:
    """Extract key inputs from method result for the explanation generator."""
    inputs: dict[str, str] = {}

    if primary.method == MethodType.COMPS:
        if company.current_revenue:
            if company.current_revenue >= 1_000_000:
                inputs["revenue"] = f"${company.current_revenue / 1_000_000:.1f}M"
            else:
                inputs["revenue"] = f"${company.current_revenue:,.0f}"
        for step in primary.steps:
            if "multiple" in step.description.lower() and "median" in step.output:
                inputs["multiple"] = step.output.replace(" (median)", "")
                break

    elif primary.method == MethodType.LAST_ROUND_ADJUSTED:
        for step in primary.steps:
            if "post-money" in step.description.lower():
                inputs["post_money"] = step.output
            if "time" in step.description.lower():
                inputs["months_elapsed"] = step.inputs.get("months_elapsed", "N/A")

    elif primary.method == MethodType.DCF:
        for assumption in primary.assumptions:
            if "discount" in assumption.name.lower():
                inputs["discount_rate"] = assumption.value
                break
        if company.projections:
            inputs["projection_years"] = str(len(company.projections.periods))

    return inputs
