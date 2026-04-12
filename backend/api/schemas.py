from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


# --- Users ---

class UserCreate(BaseModel):
    name: str
    email: str

class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Companies ---

class FundingRoundIn(BaseModel):
    date: date
    pre_money_valuation: Decimal
    amount_raised: Decimal
    lead_investor: str | None = None

class ProjectionPeriodIn(BaseModel):
    year: int
    revenue: Decimal
    ebitda: Decimal | None = None
    growth_rate: float | None = None

class FinancialProjectionsIn(BaseModel):
    periods: list[ProjectionPeriodIn]
    discount_rate: float | None = None

class CompanyCreate(BaseModel):
    name: str
    stage: str
    sector: str
    revenue_status: str
    current_revenue: Decimal | None = None
    last_round: FundingRoundIn | None = None
    projections: FinancialProjectionsIn | None = None
    auditor_notes: str | None = None
    created_by: str

class CompanyUpdate(BaseModel):
    name: str | None = None
    stage: str | None = None
    sector: str | None = None
    revenue_status: str | None = None
    current_revenue: Decimal | None = None
    last_round: FundingRoundIn | None = None
    projections: FinancialProjectionsIn | None = None
    auditor_notes: str | None = None

class CompanyOut(BaseModel):
    id: UUID
    name: str
    stage: str
    sector: str
    revenue_status: str
    current_revenue: Decimal | None
    last_round_date: date | None
    last_round_valuation: Decimal | None
    last_round_amount: Decimal | None
    last_round_investor: str | None
    projections: dict | None
    auditor_notes: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class CompanyListItem(BaseModel):
    id: UUID
    name: str
    stage: str
    sector: str
    revenue_status: str
    created_at: datetime
    latest_valuation: Decimal | None = None
    latest_method: str | None = None

    model_config = {"from_attributes": True}


# --- Valuations ---

class ValuationRunRequest(BaseModel):
    created_by: str
    valuation_date: date | None = None
    method_weights: dict[str, float] | None = None

class MethodRunRequest(BaseModel):
    valuation_date: date | None = None
    overrides: dict[str, float] | None = None

class MethodResultOut(BaseModel):
    method: str
    value: Decimal
    value_low: Decimal
    value_high: Decimal
    steps: list[dict]
    assumptions: list[dict]
    sources: list[dict]
    is_primary: bool = False

class SensitivityRequest(BaseModel):
    valuation_date: date | None = None
    wacc_steps: list[float] | None = None
    tg_steps: list[float] | None = None

class SensitivityOut(BaseModel):
    wacc_values: list[float]
    tg_values: list[float]
    grid: list[list[str]]
    base_wacc: float
    base_tg: float

class OverrideRequest(BaseModel):
    fair_value: Decimal
    justification: str
    created_by: str

class ValuationOut(BaseModel):
    id: UUID
    company_id: UUID
    version: int
    primary_method: str
    fair_value: Decimal
    fair_value_low: Decimal
    fair_value_high: Decimal
    explanation: str
    method_results: list[dict]
    audit_trail: dict
    overrides: dict | None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}

class ValuationListItem(BaseModel):
    id: UUID
    version: int
    primary_method: str
    fair_value: Decimal
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Benchmarks ---

class BenchmarkSector(BaseModel):
    key: str
    display_name: str

class BenchmarkOut(BaseModel):
    metadata: dict
    sectors: dict
