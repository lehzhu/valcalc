from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, MethodRecommendation,
)

_LATER_STAGES = {CompanyStage.GROWTH, CompanyStage.MATURE_PRIVATE}


def recommend_methods(company: CompanyInput) -> list[MethodRecommendation]:
    """Return ranked method recommendations based on company data availability."""
    recommendations: list[MethodRecommendation] = []

    has_revenue = (
        company.revenue_status != RevenueStatus.PRE_REVENUE
        and company.current_revenue is not None
        and company.current_revenue > 0
    )
    has_round = company.last_round is not None
    has_projections = (
        company.projections is not None
        and len(company.projections.periods) >= 2
        and any(p.ebitda is not None and p.ebitda > 0 for p in company.projections.periods)
    )
    is_later_stage = company.stage in _LATER_STAGES

    # Case 1: Revenue + projections + later stage → DCF primary, Comps secondary
    if has_revenue and has_projections and is_later_stage:
        recommendations.append(MethodRecommendation(
            method=MethodType.DCF,
            is_primary=True,
            rationale="Company has revenue, detailed projections, and is growth/mature stage — DCF is most appropriate",
        ))
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=False,
            rationale="Revenue-based comparable multiples provide a cross-check",
        ))
        if has_round:
            recommendations.append(MethodRecommendation(
                method=MethodType.LAST_ROUND_ADJUSTED,
                is_primary=False,
                rationale="Prior round provides additional reference point",
            ))
        return recommendations

    # Case 2: Has revenue → Comps primary
    if has_revenue:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale="Company has revenue and sector benchmarks are available for comparable multiples",
        ))
        if has_round:
            recommendations.append(MethodRecommendation(
                method=MethodType.LAST_ROUND_ADJUSTED,
                is_primary=False,
                rationale="Prior round provides additional reference point",
            ))
        if has_projections:
            recommendations.append(MethodRecommendation(
                method=MethodType.DCF,
                is_primary=False,
                rationale="Projections available for DCF cross-check",
            ))
        return recommendations

    # Case 3: Pre-revenue with round → Last Round primary
    if has_round:
        recommendations.append(MethodRecommendation(
            method=MethodType.LAST_ROUND_ADJUSTED,
            is_primary=True,
            rationale="Pre-revenue company with prior funding round — last round adjusted is most reliable",
        ))
        return recommendations

    # Case 4: No revenue, no round → Manual review
    recommendations.append(MethodRecommendation(
        method=MethodType.MANUAL,
        is_primary=True,
        rationale="Insufficient data for automated valuation — manual review required",
    ))
    return recommendations
