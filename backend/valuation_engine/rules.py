from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, MethodRecommendation,
)

_COMPS_ELIGIBLE_REVENUE = {
    RevenueStatus.EARLY_REVENUE, RevenueStatus.GROWING_REVENUE, RevenueStatus.SCALED_REVENUE,
}


def recommend_methods(company: CompanyInput) -> list[MethodRecommendation]:
    """Return ranked method recommendations.

    Primary method: Recent Financing + Calibration (when a round exists).
    Secondary: Comparable company multiples as cross-check when revenue data exists.
    """
    recommendations: list[MethodRecommendation] = []

    has_revenue = (
        company.revenue_status in _COMPS_ELIGIBLE_REVENUE
        and company.current_revenue is not None
        and company.current_revenue > 0
    )
    has_round = company.last_round is not None

    # Primary: Recent Financing + Calibration (always, when round data exists)
    if has_round:
        recommendations.append(MethodRecommendation(
            method=MethodType.LAST_ROUND_ADJUSTED,
            is_primary=True,
            rationale=(
                "Recent financing calibration is the primary method per ASC 820-10-35 — "
                "starts from an arm's-length transaction and calibrates for subsequent changes"
            ),
        ))

        # Secondary: Comps cross-check
        if has_revenue:
            recommendations.append(MethodRecommendation(
                method=MethodType.COMPS,
                is_primary=False,
                rationale="Comparable company multiples provide a market-approach cross-check",
            ))

        return recommendations

    # No round: fall back to comps as primary
    if has_revenue:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale="No recent financing data — comparable multiples used as primary method",
        ))
        return recommendations

    # No round, no revenue: manual review required
    recommendations.append(MethodRecommendation(
        method=MethodType.MANUAL,
        is_primary=True,
        rationale="Insufficient data for automated valuation — manual review required",
    ))
    return recommendations
