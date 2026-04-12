import dataclasses
from datetime import datetime

from valuation_engine.models import (
    CompanyInput, AuditTrail, MethodRecommendation, MethodResult,
)
from valuation_engine.benchmarks.loader import get_benchmark_version


def build_audit_trail(
    company: CompanyInput,
    recommendations: list[MethodRecommendation],
    method_results: list[MethodResult],
    overrides: list[dict] | None = None,
) -> AuditTrail:
    """Build a complete audit trail from valuation inputs and outputs."""
    input_snapshot = _serialize_company(company)

    primary_rec = next((r for r in recommendations if r.is_primary), recommendations[0])

    return AuditTrail(
        input_snapshot=input_snapshot,
        method_selection_rationale=primary_rec.rationale,
        recommendations=recommendations,
        method_results=method_results,
        overrides=overrides or [],
        benchmark_version=_safe_benchmark_version(),
        engine_version="0.1.0",
        timestamp=datetime.now(),
    )


def _serialize_company(company: CompanyInput) -> dict:
    """Convert CompanyInput to a JSON-safe dict for the audit trail snapshot."""
    data = dataclasses.asdict(company)
    # Convert enums to their values
    data["stage"] = company.stage.value
    data["revenue_status"] = company.revenue_status.value
    # Convert Decimals and dates to strings
    return _make_json_safe(data)


def _make_json_safe(obj):
    """Recursively convert non-JSON-serializable types to strings."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_safe(v) for v in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "value") and isinstance(obj, type):
        return obj.value
    try:
        float(obj)
        return str(obj)
    except (TypeError, ValueError):
        pass
    return obj


def _safe_benchmark_version() -> str | None:
    try:
        return get_benchmark_version()
    except FileNotFoundError:
        return None
