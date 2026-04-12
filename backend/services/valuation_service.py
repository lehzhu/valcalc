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
        projections=projections,
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
) -> Valuation:
    """Run a valuation for a company and persist the result."""
    engine_input = _company_to_engine_input(company)
    result = run_valuation(engine_input, valuation_date=valuation_date)

    latest = (
        db.query(Valuation)
        .filter(Valuation.company_id == company.id)
        .order_by(Valuation.version.desc())
        .first()
    )
    version = (latest.version + 1) if latest else 1

    valuation = Valuation(
        company_id=company.id,
        version=version,
        primary_method=result.primary_method.value,
        fair_value=result.fair_value,
        fair_value_low=result.fair_value_low,
        fair_value_high=result.fair_value_high,
        explanation=result.explanation,
        method_results=_serialize_method_results(result.method_results),
        audit_trail=_serialize_audit_trail(result.audit_trail),
        created_by=created_by,
    )
    db.add(valuation)
    db.commit()
    db.refresh(valuation)
    return valuation


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
