import dataclasses
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Company, Valuation
from api.schemas import (
    ValuationRunRequest, ValuationOut, ValuationListItem,
    OverrideRequest, MethodRunRequest, MethodResultOut,
)
from services.valuation_service import run_company_valuation, apply_override, _company_to_engine_input, _make_json_safe
from valuation_engine.engine import run_single_method
from valuation_engine.models import MethodType

router = APIRouter(tags=["valuations"])


@router.post("/api/v1/companies/{company_id}/valuations", response_model=ValuationOut, status_code=201)
def create_valuation(company_id: UUID, body: ValuationRunRequest, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        valuation = run_company_valuation(
            db=db,
            company=company,
            created_by=body.created_by,
            valuation_date=body.valuation_date,
            method_weights=body.method_weights,
            overrides=body.overrides,
        )
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    db.commit()
    return valuation


@router.get("/api/v1/companies/{company_id}/valuations", response_model=list[ValuationListItem])
def list_company_valuations(company_id: UUID, db: Session = Depends(get_db)):
    valuations = (
        db.query(Valuation)
        .filter(Valuation.company_id == company_id)
        .order_by(Valuation.version.desc())
        .all()
    )
    return valuations


@router.get("/api/v1/valuations/{valuation_id}", response_model=ValuationOut)
def get_valuation(valuation_id: UUID, db: Session = Depends(get_db)):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    return valuation


VALID_METHODS = {m.value: m for m in MethodType if m != MethodType.MANUAL}


@router.post("/api/v1/companies/{company_id}/methods/{method}", response_model=MethodResultOut)
def run_method_preview(company_id: UUID, method: str, body: MethodRunRequest, db: Session = Depends(get_db)):
    """Run a single valuation method against a company (preview, not persisted)."""
    if method not in VALID_METHODS:
        raise HTTPException(status_code=400, detail=f"Invalid method: {method}. Valid: {list(VALID_METHODS.keys())}")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        engine_input = _company_to_engine_input(company)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    overrides = {k: v for k, v in (body.overrides or {}).items()} if body.overrides else None
    try:
        result = run_single_method(VALID_METHODS[method], engine_input, body.valuation_date, overrides=overrides)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    if result is None:
        raise HTTPException(status_code=422, detail=f"Insufficient data to run {method}. Check company inputs.")

    d = dataclasses.asdict(result)
    d["method"] = result.method.value
    d = _make_json_safe(d)
    return d


@router.post("/api/v1/valuations/{valuation_id}/override", response_model=ValuationOut)
def override_valuation(valuation_id: UUID, body: OverrideRequest, db: Session = Depends(get_db)):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")

    updated = apply_override(
        db=db,
        valuation=valuation,
        fair_value=body.fair_value,
        justification=body.justification,
        created_by=body.created_by,
    )
    db.commit()
    return updated
