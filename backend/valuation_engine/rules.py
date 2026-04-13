from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, MethodRecommendation,
)

_DCF_ELIGIBLE_STAGES = {CompanyStage.SERIES_B, CompanyStage.SERIES_C_PLUS, CompanyStage.LATE_PRE_IPO}
_COMPS_ELIGIBLE_REVENUE = {
    RevenueStatus.EARLY_REVENUE, RevenueStatus.GROWING_REVENUE, RevenueStatus.SCALED_REVENUE,
}


def recommend_methods(company: CompanyInput) -> list[MethodRecommendation]:
    """Return ranked method recommendations.

    Primary method: Recent Financing + Calibration (when a round exists).
    Secondary methods: Comps and DCF are available as cross-checks when data supports them.
    """
    recommendations: list[MethodRecommendation] = []

    has_revenue = (
        company.revenue_status in _COMPS_ELIGIBLE_REVENUE
        and company.current_revenue is not None
        and company.current_revenue > 0
    )
    has_round = company.last_round is not None
    has_projections = (
        company.projections is not None
        and len(company.projections.periods) >= 2
        and any(p.ebitda is not None and p.ebitda > 0 for p in company.projections.periods)
    )

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

        # Secondary: DCF cross-check
        if has_projections and company.stage in _DCF_ELIGIBLE_STAGES:
            recommendations.append(MethodRecommendation(
                method=MethodType.DCF,
                is_primary=False,
                rationale="DCF provides an income-approach cross-check given available projections",
            ))

        return recommendations

    # No round: fall back to comps or DCF as primary
    if has_revenue:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale="No recent financing data — comparable multiples used as primary method",
        ))
        if has_projections and company.stage in _DCF_ELIGIBLE_STAGES:
            recommendations.append(MethodRecommendation(
                method=MethodType.DCF,
                is_primary=False,
                rationale="DCF available as secondary cross-check",
            ))
        return recommendations

    # No round, no revenue: manual review required
    recommendations.append(MethodRecommendation(
        method=MethodType.MANUAL,
        is_primary=True,
        rationale="Insufficient data for automated valuation — manual review required",
    ))
    return recommendations
