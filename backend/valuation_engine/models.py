from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


class CompanyStage(Enum):
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A = "series_a"
    SERIES_B = "series_b"
    SERIES_C_PLUS = "series_c_plus"
    LATE_PRE_IPO = "late_pre_ipo"


class RevenueStatus(Enum):
    PRE_REVENUE = "pre_revenue"
    EARLY_REVENUE = "early_revenue"          # < $1M ARR
    GROWING_REVENUE = "growing_revenue"      # $1M - $10M ARR
    SCALED_REVENUE = "scaled_revenue"        # > $10M ARR


class MethodType(Enum):
    LAST_ROUND_ADJUSTED = "last_round_adjusted"
    COMPS = "comps"
    DCF = "dcf"
    MANUAL = "manual"


@dataclass
class FundingRound:
    date: date
    pre_money_valuation: Decimal
    amount_raised: Decimal
    lead_investor: str | None = None


@dataclass
class ProjectionPeriod:
    year: int
    revenue: Decimal
    ebitda: Decimal | None = None
    growth_rate: float | None = None


@dataclass
class FinancialProjections:
    periods: list[ProjectionPeriod] = field(default_factory=list)
    discount_rate: float | None = None


@dataclass
class CompanyInput:
    name: str
    stage: CompanyStage
    sector: str
    revenue_status: RevenueStatus
    last_round: FundingRound | None = None
    current_revenue: Decimal | None = None
    projections: FinancialProjections | None = None
    auditor_notes: str | None = None


@dataclass
class ComputationStep:
    description: str
    formula: str
    inputs: dict[str, str]
    output: str


@dataclass
class Assumption:
    name: str
    value: str
    rationale: str
    source: str | None = None
    overrideable: bool = True


@dataclass
class Source:
    name: str
    version: str
    effective_date: date
    url: str | None = None


@dataclass
class MethodResult:
    method: MethodType
    value: Decimal
    value_low: Decimal
    value_high: Decimal
    steps: list[ComputationStep]
    assumptions: list[Assumption]
    sources: list[Source]
    is_primary: bool


@dataclass
class MethodRecommendation:
    method: MethodType
    is_primary: bool
    rationale: str


@dataclass
class AuditTrail:
    input_snapshot: dict
    method_selection_rationale: str
    recommendations: list[MethodRecommendation]
    method_results: list[MethodResult]
    overrides: list[dict] = field(default_factory=list)
    benchmark_version: str | None = None
    engine_version: str = "0.1.0"
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ValuationResult:
    primary_method: MethodType
    fair_value: Decimal
    fair_value_low: Decimal
    fair_value_high: Decimal
    explanation: str
    method_results: list[MethodResult]
    audit_trail: AuditTrail
