from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Company, Valuation
from api.schemas import CompanyCreate, CompanyUpdate, CompanyOut, CompanyListItem

router = APIRouter(prefix="/api/v1/companies", tags=["companies"])


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(body: CompanyCreate, db: Session = Depends(get_db)):
    company = Company(
        name=body.name,
        stage=body.stage,
        sector=body.sector,
        revenue_status=body.revenue_status,
        current_revenue=body.current_revenue,
        auditor_notes=body.auditor_notes,
        created_by=body.created_by,
    )
    if body.last_round:
        company.last_round_date = body.last_round.date
        company.last_round_valuation = body.last_round.pre_money_valuation
        company.last_round_amount = body.last_round.amount_raised
        company.last_round_investor = body.last_round.lead_investor
    if body.projections:
        company.projections = body.projections.model_dump(mode="json")
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("", response_model=list[CompanyListItem])
def list_companies(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.updated_at.desc()).all()
    result = []
    for c in companies:
        latest = (
            db.query(Valuation)
            .filter(Valuation.company_id == c.id)
            .order_by(Valuation.version.desc())
            .first()
        )
        result.append(CompanyListItem(
            id=c.id,
            name=c.name,
            stage=c.stage,
            sector=c.sector,
            revenue_status=c.revenue_status,
            created_at=c.created_at,
            latest_valuation=latest.fair_value if latest else None,
            latest_method=latest.primary_method if latest else None,
        ))
    return result


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: UUID, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(company_id: UUID, body: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = body.model_dump(exclude_unset=True)
    if "last_round" in update_data and update_data["last_round"] is not None:
        lr = update_data.pop("last_round")
        company.last_round_date = lr["date"]
        company.last_round_valuation = lr["pre_money_valuation"]
        company.last_round_amount = lr["amount_raised"]
        company.last_round_investor = lr.get("lead_investor")
    elif "last_round" in update_data:
        update_data.pop("last_round")

    if "projections" in update_data and update_data["projections"] is not None:
        proj = update_data.pop("projections")
        company.projections = proj
    elif "projections" in update_data:
        update_data.pop("projections")

    for key, value in update_data.items():
        setattr(company, key, value)

    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: UUID, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
