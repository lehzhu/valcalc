import dataclasses
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from db.models import Company, Valuation
from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus,
    FundingRound, FinancialProjections, ProjectionPeriod,
    MethodType, ValuationResult, MethodResult,
)
from valuation_engine.engine import run_valuation
from valuation_engine.methods.manual import ManualOverride


def _company_to_engine_input(company: Company) -> CompanyInput:
    """Convert a DB Company model to the engine's CompanyInput dataclass."""
    last_round = None
    if company.last_round_date and company.last_round_valuation:
        last_round = FundingRound(
            date=company.last_round_date,
            pre_money_valuation=company.last_round_valuation,
            amount_raised=company.last_round_amount or Decimal("0"),
            lead_investor=company.last_round_investor,
        )

    projections = None
    if company.projections and "periods" in company.projections:
        periods = [
            ProjectionPeriod(
                year=p["year"],
                revenue=Decimal(str(p["revenue"])),
                ebitda=Decimal(str(p["ebitda"])) if p.get("ebitda") else None,
                growth_rate=p.get("growth_rate"),
            )
            for p in company.projections["periods"]
        ]
        projections = FinancialProjections(
            periods=periods,
            discount_rate=company.projections.get("discount_rate"),
        )

    return CompanyInput(
        name=company.name,
        stage=CompanyStage(company.stage),
        sector=company.sector,
        revenue_status=RevenueStatus(company.revenue_status),
        last_round=last_round,
        current_revenue=company.current_revenue,
        cap_table=company.cap_table,
        financials=company.financials,
        projections=projections,
        qualitative=company.qualitative,
        external_mapping=company.external_mapping,
        auditor_notes=company.auditor_notes,
    )


def _serialize_method_results(results: list[MethodResult]) -> list[dict]:
    """Convert MethodResult list to JSON-serializable dicts."""
    serialized = []
    for r in results:
        d = dataclasses.asdict(r)
        d["method"] = r.method.value
        serialized.append(_make_json_safe(d))
    return serialized


def _serialize_audit_trail(trail) -> dict:
    d = dataclasses.asdict(trail)
    for rec in d.get("recommendations", []):
        if hasattr(rec.get("method"), "value"):
            rec["method"] = rec["method"].value
    for mr in d.get("method_results", []):
        if hasattr(mr.get("method"), "value"):
            mr["method"] = mr["method"].value
    return _make_json_safe(d)


def _make_json_safe(obj):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_safe(v) for v in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    if hasattr(obj, "value") and not isinstance(obj, (str, int, float, bool)):
        return obj.value
    return obj


def run_company_valuation(
    db: Session,
    company: Company,
    created_by: str,
    valuation_date: date | None = None,
    method_weights: dict[str, float] | None = None,
) -> Valuation:
    """Run a valuation for a company and persist the result."""
    engine_input = _company_to_engine_input(company)
    result = run_valuation(engine_input, valuation_date=valuation_date)

    # Apply method weighting if provided
    fair_value = result.fair_value
    fair_value_low = result.fair_value_low
    fair_value_high = result.fair_value_high
    explanation = result.explanation
    primary_method = result.primary_method.value

    if method_weights and len(result.method_results) > 1:
        weighted_val, weighted_low, weighted_high = _apply_weights(result.method_results, method_weights)
        if weighted_val is not None:
            fair_value = weighted_val
            fair_value_low = weighted_low
            fair_value_high = weighted_high
            primary_method = "weighted_blend"
            weight_desc = ", ".join(
                f"{m.method.value.replace('_', ' ').title()} ({method_weights.get(m.method.value, 0):.0%})"
                for m in result.method_results if method_weights.get(m.method.value, 0) > 0
            )
            explanation = f"Weighted blend of {weight_desc}. Fair value: ${fair_value:,.0f}."

    latest = (
        db.query(Valuation)
        .filter(Valuation.company_id == company.id)
        .order_by(Valuation.version.desc())
        .first()
    )
    version = (latest.version + 1) if latest else 1

    audit_trail = _serialize_audit_trail(result.audit_trail)
    if method_weights:
        audit_trail["method_weights"] = method_weights

    valuation = Valuation(
        company_id=company.id,
        version=version,
        primary_method=primary_method,
        fair_value=fair_value,
        fair_value_low=fair_value_low,
        fair_value_high=fair_value_high,
        explanation=explanation,
        method_results=_serialize_method_results(result.method_results),
        audit_trail=audit_trail,
        created_by=created_by,
    )
    db.add(valuation)
    db.commit()
    db.refresh(valuation)
    return valuation


def _apply_weights(
    method_results: list[MethodResult],
    weights: dict[str, float],
) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    """Compute weighted average across method results. Returns (value, low, high) or Nones."""
    total_weight = Decimal("0")
    weighted_sum = Decimal("0")
    weighted_low = Decimal("0")
    weighted_high = Decimal("0")

    for mr in method_results:
        w = Decimal(str(weights.get(mr.method.value, 0)))
        if w > 0:
            total_weight += w
            weighted_sum += mr.value * w
            weighted_low += mr.value_low * w
            weighted_high += mr.value_high * w

    if total_weight == 0:
        return None, None, None

    return (
        (weighted_sum / total_weight).quantize(Decimal("1")),
        (weighted_low / total_weight).quantize(Decimal("1")),
        (weighted_high / total_weight).quantize(Decimal("1")),
    )


def apply_override(
    db: Session,
    valuation: Valuation,
    fair_value: Decimal,
    justification: str,
    created_by: str,
) -> Valuation:
    """Apply a manual override to an existing valuation."""
    manual = ManualOverride()
    result = manual.compute(
        fair_value=fair_value,
        justification=justification,
        prior_computed_value=valuation.fair_value,
        valuation_date=date.today(),
    )

    valuation.fair_value = fair_value
    valuation.fair_value_low = fair_value
    valuation.fair_value_high = fair_value
    valuation.overrides = {
        "applied_by": created_by,
        "justification": justification,
        "prior_value": str(valuation.fair_value),
        "override_result": _make_json_safe(dataclasses.asdict(result)),
    }
    db.commit()
    db.refresh(valuation)
    return valuation
