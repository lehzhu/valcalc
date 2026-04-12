from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Company, Valuation
from api.schemas import ValuationRunRequest, ValuationOut, ValuationListItem, OverrideRequest
from services.valuation_service import run_company_valuation, apply_override

router = APIRouter(tags=["valuations"])


@router.post("/api/v1/companies/{company_id}/valuations", response_model=ValuationOut, status_code=201)
def create_valuation(company_id: UUID, body: ValuationRunRequest, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    valuation = run_company_valuation(
        db=db,
        company=company,
        created_by=body.created_by,
        valuation_date=body.valuation_date,
    )
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
    return updated
