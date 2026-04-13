from decimal import Decimal

from valuation_engine.models import MethodType, MethodResult, ValuationResult


def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value:,.0f}"


def generate_explanation(
    method: MethodType,
    fair_value: Decimal,
    sector: str,
    key_inputs: dict[str, str],
) -> str:
    """Generate a plain English explanation of the valuation result."""
    value_str = _format_currency(fair_value)
    sector_display = sector.replace("_", " ").title()

    if method == MethodType.COMPS:
        revenue = key_inputs.get("revenue", "N/A")
        multiple = key_inputs.get("multiple", "N/A")
        return (
            f"Valued at {value_str} using public comparable company multiples. "
            f"Applied {sector_display} sector median revenue multiple of {multiple} "
            f"to current revenue of {revenue}, with adjustments for growth rate and stage."
        )

    if method == MethodType.LAST_ROUND_ADJUSTED:
        post_money = key_inputs.get("post_money", "N/A")
        months = key_inputs.get("months_elapsed", "N/A")
        return (
            f"Valued at {value_str} based on the most recent funding round. "
            f"Starting from post-money valuation of {post_money} ({months} months ago), "
            f"adjusted for time elapsed and {sector_display} sector market conditions."
        )

    if method == MethodType.DCF:
        discount_rate = key_inputs.get("discount_rate", "N/A")
        years = key_inputs.get("projection_years", "N/A")
        return (
            f"Valued at {value_str} using a discounted cash flow analysis. "
            f"Projected free cash flows over {years} years discounted at {discount_rate}, "
            f"plus terminal value. Sector: {sector_display}."
        )

    if method == MethodType.MANUAL:
        return (
            f"Fair value of {value_str} determined by auditor manual assessment. "
            f"See justification in audit trail for detailed rationale."
        )

    return f"Valued at {value_str}."


def generate_reasoning_trace(result: ValuationResult) -> dict:
    """Generate a structured reasoning trace for the valuation.

    Returns a dict with conclusion-first ordering, each calibration step
    showing the formula (equation) and working numbers separately,
    plus citations for every assumption.

    This is the authoritative reasoning output — the frontend simply renders it.
    """
    primary_results = [r for r in result.method_results if r.is_primary]
    primary = primary_results[0] if primary_results else result.method_results[0]

    trace: dict = {
        "conclusion": _build_conclusion(result, primary),
        "calibration_steps": _build_calibration_steps(primary),
        "assumptions_table": _build_assumptions_table(primary),
        "data_sources": _build_sources(primary),
        "method_selection": {
            "primary": result.primary_method.value,
            "rationale": result.audit_trail.method_selection_rationale,
            "secondary_methods": [
                {
                    "method": r.method.value,
                    "value": str(r.value),
                    "range": f"{_format_currency(r.value_low)} – {_format_currency(r.value_high)}",
                }
                for r in result.method_results if not r.is_primary
            ],
        },
    }

    return trace


def _build_conclusion(result: ValuationResult, primary: MethodResult) -> dict:
    """Conclusion block — shown first in the trace."""
    return {
        "fair_value": str(result.fair_value),
        "fair_value_display": _format_currency(result.fair_value),
        "range": f"{_format_currency(result.fair_value_low)} – {_format_currency(result.fair_value_high)}",
        "range_low": str(result.fair_value_low),
        "range_high": str(result.fair_value_high),
        "method": result.primary_method.value,
        "method_display": result.primary_method.value.replace("_", " ").title(),
        "summary": result.explanation,
    }


def _build_calibration_steps(primary: MethodResult) -> list[dict]:
    """Build calibration steps in reverse order (conclusion → anchor).

    Each step separates the equation (formula template) from the
    working numbers (actual values substituted in).
    """
    steps = list(primary.steps)
    # Reverse: conclusion first, anchor last
    steps_reversed = list(reversed(steps))

    calibration_steps = []
    for i, step in enumerate(steps_reversed):
        calibration_steps.append({
            "order": i + 1,
            "description": step.description,
            "equation": step.formula,
            "working": step.inputs,
            "result": step.output,
        })

    return calibration_steps


def _build_assumptions_table(primary: MethodResult) -> list[dict]:
    """Build a table of all assumptions with citations."""
    return [
        {
            "name": a.name,
            "value": a.value,
            "rationale": a.rationale,
            "source": a.source or "Auditor judgment",
            "overrideable": a.overrideable,
        }
        for a in primary.assumptions
    ]


def _build_sources(primary: MethodResult) -> list[dict]:
    """Build a deduplicated list of data sources."""
    seen = set()
    sources = []
    for s in primary.sources:
        key = f"{s.name}|{s.version}"
        if key not in seen:
            seen.add(key)
            sources.append({
                "name": s.name,
                "version": s.version,
                "effective_date": s.effective_date.isoformat() if hasattr(s.effective_date, "isoformat") else str(s.effective_date),
            })
    return sources
