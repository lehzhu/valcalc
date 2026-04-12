from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, MethodRecommendation,
)

_DCF_PRIMARY_STAGES = {CompanyStage.SERIES_C_PLUS, CompanyStage.LATE_PRE_IPO}
_DCF_SECONDARY_STAGES = {CompanyStage.SERIES_B}
_COMPS_ELIGIBLE_REVENUE = {
    RevenueStatus.EARLY_REVENUE, RevenueStatus.GROWING_REVENUE, RevenueStatus.SCALED_REVENUE,
}


def recommend_methods(company: CompanyInput) -> list[MethodRecommendation]:
    """Return ranked method recommendations based on company data and stage."""
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

    # Case 1: Scaled/growing revenue + projections + later stage → DCF primary
    if has_revenue and has_projections and company.stage in _DCF_PRIMARY_STAGES:
        recommendations.append(MethodRecommendation(
            method=MethodType.DCF,
            is_primary=True,
            rationale=f"Company is {company.stage.value} stage with {company.revenue_status.value.replace('_', ' ')} and detailed projections — DCF is most appropriate per ASC 820",
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

    # Case 2: Revenue + projections + Series B → Comps primary, DCF secondary
    if has_revenue and has_projections and company.stage in _DCF_SECONDARY_STAGES:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale=f"Series B stage with revenue — comparable multiples are primary; DCF available as secondary",
        ))
        recommendations.append(MethodRecommendation(
            method=MethodType.DCF,
            is_primary=False,
            rationale="Projections available for DCF cross-check",
        ))
        if has_round:
            recommendations.append(MethodRecommendation(
                method=MethodType.LAST_ROUND_ADJUSTED,
                is_primary=False,
                rationale="Prior round provides additional reference point",
            ))
        return recommendations

    # Case 3: Has revenue (no projections or early stage) → Comps primary
    if has_revenue:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale=f"Company has {company.revenue_status.value.replace('_', ' ')} and sector benchmarks are available",
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

    # Case 4: Pre-revenue with round → Last Round primary
    if has_round:
        recommendations.append(MethodRecommendation(
            method=MethodType.LAST_ROUND_ADJUSTED,
            is_primary=True,
            rationale="Pre-revenue company with prior funding round — last round adjusted is most reliable",
        ))
        if has_projections:
            recommendations.append(MethodRecommendation(
                method=MethodType.DCF,
                is_primary=False,
                rationale="Projections available for DCF cross-check despite pre-revenue status (WACC adjusted +5%)",
            ))
        return recommendations

    # Case 5: No revenue, no round → Manual review
    recommendations.append(MethodRecommendation(
        method=MethodType.MANUAL,
        is_primary=True,
        rationale="Insufficient data for automated valuation — manual review required",
    ))
    return recommendations
