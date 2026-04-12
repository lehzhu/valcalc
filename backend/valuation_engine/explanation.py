from decimal import Decimal

from valuation_engine.models import MethodType, ConfidenceLevel


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
    confidence: ConfidenceLevel,
    data_completeness: float,
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
            f"to current revenue of {revenue}, with adjustments for growth rate and stage. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.LAST_ROUND_ADJUSTED:
        post_money = key_inputs.get("post_money", "N/A")
        months = key_inputs.get("months_elapsed", "N/A")
        return (
            f"Valued at {value_str} based on the most recent funding round. "
            f"Starting from post-money valuation of {post_money} ({months} months ago), "
            f"adjusted for time elapsed and {sector_display} sector market conditions. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.DCF:
        discount_rate = key_inputs.get("discount_rate", "N/A")
        years = key_inputs.get("projection_years", "N/A")
        return (
            f"Valued at {value_str} using a discounted cash flow analysis. "
            f"Projected free cash flows over {years} years discounted at {discount_rate}, "
            f"plus terminal value. Sector: {sector_display}. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.MANUAL:
        return (
            f"Fair value of {value_str} determined by auditor manual assessment. "
            f"See justification in audit trail for detailed rationale. "
            f"Confidence: {confidence.value} (manual override)."
        )

    return f"Valued at {value_str}. Confidence: {confidence.value}."
