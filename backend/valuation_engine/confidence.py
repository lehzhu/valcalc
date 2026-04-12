from valuation_engine.models import CompanyInput, ConfidenceLevel, MethodType


def compute_completeness(company: CompanyInput) -> float:
    """Compute data completeness score (0.0-1.0) based on populated fields."""
    score = 0.0

    # Base fields (always present due to required fields): +0.45
    score += 0.15  # name
    score += 0.15  # stage
    score += 0.15  # sector

    # Revenue status: +0.05
    score += 0.05

    # Current revenue: +0.15
    if company.current_revenue is not None and company.current_revenue > 0:
        score += 0.15

    # Last round data: +0.15
    if company.last_round is not None:
        score += 0.15

    # Financial projections: +0.15
    if company.projections is not None and len(company.projections.periods) > 0:
        score += 0.15

    # Auditor notes: +0.05
    if company.auditor_notes:
        score += 0.05

    return min(score, 1.0)


def compute_confidence(completeness: float, primary_method: MethodType) -> ConfidenceLevel:
    """Determine confidence level from data completeness and method type."""
    if primary_method == MethodType.MANUAL:
        return ConfidenceLevel.LOW

    if completeness >= 0.8:
        return ConfidenceLevel.HIGH
    if completeness >= 0.5:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW
