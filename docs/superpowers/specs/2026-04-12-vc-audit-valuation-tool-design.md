# VC Audit Valuation Tool — Design Spec

## Overview

A web application that helps auditors produce initial, explainable valuations for private portfolio companies. Prioritizes a simple, low-friction workflow with strong auditability — every assumption, formula step, and data source is traceable.

**Primary user:** Audit/valuation professionals reviewing VC portfolios of private, illiquid companies.

**Core value:** Consistent, documented, reviewable fair value estimation — not perfect intrinsic valuation.

---

## Decisions from Brainstorming

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tech stack | Vite + React frontend, FastAPI + Python backend | Financial formulas are more readable/auditable in Python; clean separation of UI from computation |
| Architecture | Monorepo with engine as clean module | Simple structure, engine has zero API/DB imports, independently testable |
| Database | PostgreSQL | Multi-user support, production-grade |
| Auth | No auth — user selector only | Everyone on audit team has access; audit trail tracks "who" via user selection |
| Comp data | Sector benchmarks (refreshable) + future AI-assisted peer groups (spec'd, not built) | Fast default path; manual entry is throwaway UI |
| Export | PDF + JSON + Excel | PDF for humans, Excel for auditor workflows, JSON for interoperability |
| Scale | Small team (1-5 users), dozens of companies | Scale is not a priority |
| Portfolio grouping | Standalone valuations, flat list | Multiple concurrent companies supported, no fund/engagement grouping needed |

---

## Project Structure

```
audit2/
├── frontend/                      # Vite + React + TypeScript
│   ├── src/
│   │   ├── pages/                 # Dashboard, NewValuation, Results, AuditTrail, History
│   │   ├── components/            # Shared UI: RangeBar, WaterfallChart, ConfidenceIndicator, etc.
│   │   ├── api/                   # Typed API client (fetch wrappers)
│   │   └── types/                 # TypeScript types mirroring backend models
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── api/                       # FastAPI routes, Pydantic request/response schemas
│   │   ├── routes/
│   │   │   ├── companies.py
│   │   │   ├── valuations.py
│   │   │   ├── benchmarks.py
│   │   │   ├── exports.py
│   │   │   └── users.py
│   │   ├── schemas.py             # Pydantic models for API layer
│   │   └── main.py                # FastAPI app, CORS, startup
│   ├── db/                        # SQLAlchemy models, Alembic migrations
│   │   ├── models.py
│   │   ├── session.py
│   │   └── alembic/
│   ├── valuation_engine/          # Pure Python — ZERO imports from api/ or db/
│   │   ├── methods/
│   │   │   ├── last_round.py      # Last Round Adjusted method
│   │   │   ├── comps.py           # Public Comparable Company Multiples
│   │   │   ├── dcf.py             # Discounted Cash Flow
│   │   │   └── manual.py          # Manual / Auditor Override
│   │   ├── rules.py               # Method recommendation engine
│   │   ├── models.py              # Input/output dataclasses
│   │   ├── audit_trail.py         # Builds structured audit trace
│   │   ├── benchmarks/
│   │   │   ├── data/              # Sector benchmark JSON files (versioned)
│   │   │   └── loader.py          # Loads and serves benchmark data
│   │   └── engine.py              # Top-level orchestrator
│   ├── services/                  # Glue: feeds DB data to engine, persists results
│   │   ├── valuation_service.py
│   │   └── export_service.py
│   ├── requirements.txt
│   └── pyproject.toml
├── docs/
├── docker-compose.yml             # Postgres + backend + frontend
└── .gitignore
```

### Boundary Rule

`valuation_engine/` must never import from `api/`, `db/`, or `services/`. It takes dataclasses in, returns dataclasses out. All auditability lives here.

`services/` is the orchestration layer — it translates between DB models and engine dataclasses, calls the engine, and persists results.

---

## Data Models

### Engine Models (Python dataclasses — no ORM dependency)

```python
class CompanyStage(Enum):
    PRE_SEED = "pre_seed"
    SEED = "seed"
    SERIES_A_PLUS = "series_a_plus"
    GROWTH = "growth"
    MATURE_PRIVATE = "mature_private"

class RevenueStatus(Enum):
    PRE_REVENUE = "pre_revenue"
    EARLY_REVENUE = "early_revenue"
    MEANINGFUL_REVENUE = "meaningful_revenue"

class MethodType(Enum):
    LAST_ROUND_ADJUSTED = "last_round_adjusted"
    COMPS = "comps"
    DCF = "dcf"
    MANUAL = "manual"

class ConfidenceLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

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
    periods: list[ProjectionPeriod]
    discount_rate: float | None = None  # Override; engine has stage-based defaults

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
    description: str       # "Apply sector revenue multiple"
    formula: str           # "revenue × multiple"
    inputs: dict[str, str] # {"revenue": "$3.4M", "multiple": "12.5x"}
    output: str            # "$42.5M"

@dataclass
class Assumption:
    name: str              # "Growth adjustment"
    value: str             # "+15%"
    rationale: str         # "Revenue growth exceeds sector median by 20pp"
    source: str | None     # "Benchmark v2024-Q4"
    overrideable: bool     # Whether the user can change this

@dataclass
class Source:
    name: str              # "Sector Benchmark - B2B SaaS"
    version: str           # "v2024-Q4"
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
    rationale: str         # "Revenue exists and peer benchmarks available"

@dataclass
class AuditTrail:
    input_snapshot: dict           # Serialized CompanyInput
    method_selection_rationale: str
    recommendations: list[MethodRecommendation]
    method_results: list[MethodResult]
    overrides: list[dict]          # Any user overrides applied
    benchmark_version: str | None
    engine_version: str
    timestamp: datetime

@dataclass
class ValuationResult:
    primary_method: MethodType
    fair_value: Decimal
    fair_value_low: Decimal
    fair_value_high: Decimal
    confidence: ConfidenceLevel
    data_completeness: float       # 0.0 to 1.0
    explanation: str               # Plain English summary
    method_results: list[MethodResult]
    audit_trail: AuditTrail
```

### Database Models (SQLAlchemy)

```
companies
    id: UUID (PK)
    name: str
    stage: str (enum value)
    sector: str
    revenue_status: str (enum value)
    current_revenue: Decimal | null
    last_round_date: date | null
    last_round_valuation: Decimal | null
    last_round_amount: Decimal | null
    last_round_investor: str | null
    projections: JSONB | null      # Serialized FinancialProjections
    auditor_notes: text | null
    created_by: str                # Username from selector
    created_at: timestamp
    updated_at: timestamp

valuations
    id: UUID (PK)
    company_id: UUID (FK → companies)
    version: int                   # Auto-increment per company
    primary_method: str
    fair_value: Decimal
    fair_value_low: Decimal
    fair_value_high: Decimal
    confidence: str
    data_completeness: float
    explanation: text
    method_results: JSONB          # Serialized list[MethodResult]
    audit_trail: JSONB             # Serialized AuditTrail
    overrides: JSONB | null        # Any user overrides
    created_by: str
    created_at: timestamp

users
    id: UUID (PK)
    name: str
    email: str
    created_at: timestamp
```

---

## Valuation Engine

### Method Selection Rules

The rules engine maps company inputs to recommended methods:

| Condition | Primary Method | Secondary Methods |
|-----------|---------------|-------------------|
| Pre-revenue + recent round exists | Last Round Adjusted | — |
| Pre-revenue + no round data | Manual Review | — |
| Early/meaningful revenue + sector benchmarks available | Comps | Last Round Adjusted (if round data exists) |
| Revenue + projections + growth/mature stage | DCF | Comps |
| Weak data quality (missing key fields) | Last Round Adjusted (if available) or Manual Review | — |

The rules engine returns a ranked list of `MethodRecommendation` objects. The first primary method is the default shown to the user. Secondary methods are available in the method comparison view.

### Method Implementations

#### 1. Last Round Adjusted

The most general fallback method. Adjusts a prior funding round for time elapsed and market conditions.

**Inputs:** Last round valuation, round date, sector, current date

**Steps:**
1. Base value = pre-money valuation + amount raised (post-money)
2. Time decay: months since round → decay factor (configurable curve; default: -2% per quarter for > 12 months, 0% for < 12 months)
3. Market/sector adjustment: lookup sector trend factor from benchmarks (e.g., +5% for AI/ML sector strength)
4. Final value = base × time factor × market factor

**Range:** ±15% of final value (configurable)

**Assumptions logged:** Time decay rate, market adjustment factor, adjustment rationale

#### 2. Public Comparable Company Multiples (Comps)

Uses sector benchmark multiples applied to the company's revenue.

**Inputs:** Current revenue (ARR), sector, stage, revenue growth rate (if available)

**Steps:**
1. Benchmark lookup: sector → median revenue multiple (from versioned benchmark data)
2. Base valuation = revenue × sector multiple
3. Growth adjustment: if growth rate available, adjust multiple ±% relative to sector median growth
4. Stage/size discount: apply stage-appropriate illiquidity and size discount
5. Final value = adjusted valuation

**Range:** 25th to 75th percentile of sector multiples applied to revenue

**Assumptions logged:** Benchmark version, sector multiple, growth adjustment, stage discount

**Benchmark data structure:**
```python
{
    "b2b_saas": {
        "revenue_multiple": {"p25": 8.0, "median": 12.5, "p75": 18.0},
        "ebitda_multiple": {"p25": 15.0, "median": 22.0, "p75": 30.0},
        "median_growth_rate": 0.35,
        "sector_trend_factor": 0.05,  # Used by Last Round Adjusted for market adjustment
        "source": "Mock benchmark dataset",
        "effective_date": "2024-12-31",
        "version": "v2024-Q4"
    },
    ...
}
```

Benchmark data lives in `valuation_engine/benchmarks/data/` as versioned JSON files. The `loader.py` module reads the latest version. An admin API endpoint allows uploading new benchmark data, which writes a new versioned file and updates the pointer.

#### 3. Discounted Cash Flow (DCF)

Only available when detailed forward projections exist. Hidden from the default flow for early-stage companies.

**Inputs:** Financial projections (multi-year revenue, EBITDA), discount rate (or stage-based default), terminal growth rate

**Steps:**
1. Project free cash flows from EBITDA projections (simplified: FCF = EBITDA × conversion factor)
2. Determine discount rate: user-supplied or stage-based default (e.g., seed: 40-50%, Series A: 30-40%, growth: 20-25%, mature: 12-18%)
3. Discount projected cash flows to present value
4. Terminal value: FCF_final × (1 + terminal_growth) / (discount_rate - terminal_growth)
5. Discount terminal value to present
6. Enterprise value = sum of discounted CFs + discounted terminal value

**Range:** Sensitivity analysis on discount rate ±3pp

**Assumptions logged:** Discount rate, terminal growth rate, EBITDA-to-FCF conversion, projection period

#### 4. Manual / Auditor Override

Allows an expert user to set a value directly with documented justification.

**Inputs:** Fair value (user-entered), justification text, supporting method (optional)

**Steps:**
1. Record user-supplied value
2. Record justification
3. If a prior computed valuation exists, record the delta and override rationale

**Audit trail:** Full override log with before/after values and justification

### Confidence & Data Completeness

**Data completeness** is a simple score (0.0–1.0) based on which fields are populated:
- Company name, stage, sector: +0.15 each (0.45 base)
- Revenue status: +0.05
- Current revenue: +0.15
- Last round data (all fields): +0.15
- Financial projections: +0.15
- Auditor notes: +0.05

**Confidence level** combines data completeness with method reliability:
- HIGH: completeness ≥ 0.8 + primary method has strong inputs
- MEDIUM: completeness ≥ 0.5 + primary method has adequate inputs
- LOW: completeness < 0.5 or method is fallback/manual

### Explanation Generator

Each valuation result includes a plain English explanation. The engine builds this from templates:

> "Valued using [method name]. [Key metric] of [value] with [sector] [multiple type] multiple of [X]x, adjusted [+/-Y%] for [reason]. Confidence: [level] based on [data completeness]% data availability."

The explanation references specific numbers and sources — not generic boilerplate.

---

## API Design

Base URL: `/api/v1`

### Companies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/companies` | Create a new company |
| GET | `/companies` | List all companies (with most recent valuation summary) |
| GET | `/companies/{id}` | Get company details |
| PUT | `/companies/{id}` | Update company details |
| DELETE | `/companies/{id}` | Delete company and its valuations |

### Valuations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/companies/{id}/valuations` | Run a new valuation for a company |
| GET | `/companies/{id}/valuations` | List all valuations for a company (version history) |
| GET | `/valuations/{id}` | Get full valuation with audit trail |
| POST | `/valuations/{id}/override` | Apply a manual override to a valuation |

### Exports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/valuations/{id}/export/pdf` | Export valuation as PDF |
| GET | `/valuations/{id}/export/json` | Export valuation as JSON |
| GET | `/valuations/{id}/export/xlsx` | Export valuation as Excel |

### Benchmarks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/benchmarks` | Get current sector benchmarks |
| GET | `/benchmarks/sectors` | List available sectors |
| PUT | `/benchmarks` | Upload new benchmark data (admin) |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users |
| POST | `/users` | Create a user |

---

## Frontend

### Tech Stack

- Vite + React + TypeScript
- Tailwind CSS for styling
- Recharts for charts (range bars, waterfall, comparison)
- React Router for navigation
- React Hook Form for the guided input form

### Pages

#### 1. Dashboard (`/`)
- List of recent valuations (company name, value, method, date, who)
- "New Valuation" button
- Simple search/filter by company name
- User selector in the header (dropdown, persisted in localStorage)

#### 2. New Valuation (`/valuations/new`)
- Multi-step guided form:
  - Step 1: Company basics (name, stage, sector, revenue status)
  - Step 2: Funding history (last round details — conditional, shown if relevant)
  - Step 3: Financials (current revenue, projections — conditional, shown based on stage/revenue status)
  - Step 4: Notes (auditor notes, optional)
  - Step 5: Review & submit
- Progress indicator showing current step
- Conditional steps: pre-revenue companies skip the projections step; companies without prior rounds skip funding history
- "Run Valuation" submits to API and navigates to results

#### 3. Valuation Results (`/valuations/{id}`)
- **Valuation card:** Fair value (large), range bar, primary method badge
- **Quick stats:** Confidence level, data completeness, method used
- **Explanation:** Plain English summary paragraph
- **Method comparison:** If multiple methods ran, bar chart comparing their outputs
- **Actions:** Export (PDF/JSON/Excel), Override, Re-run with different inputs
- **Audit Trail toggle:** Expands inline audit trail panel

#### 4. Audit Trail (`/valuations/{id}/audit`)
- Also accessible as expandable panel within Results page
- Step-by-step vertical timeline:
  1. Input Snapshot — all raw inputs
  2. Method Selection — which rule fired, why this method
  3. Data Sources — benchmark versions, data used
  4. Computation Steps — each formula step with inputs/outputs
  5. Assumptions — every assumption with rationale
  6. Result — final value, range, confidence
  7. Overrides — any manual adjustments (if applicable)
- Each step is expandable/collapsible
- Copy-to-clipboard for individual sections

#### 5. Company History (`/companies/{id}`)
- Company details card
- Timeline of all valuations for this company
- Value trend chart across valuation versions
- Quick comparison between versions

### Visualization Components

- **RangeBar:** Horizontal bar showing low–mid–high range with point estimate marker
- **MethodComparisonChart:** Grouped bar chart comparing values from different methods
- **WaterfallChart:** Shows adjustment steps (base value → adjustments → final value)
- **ConfidenceIndicator:** Color-coded badge (green/yellow/red) with label
- **CompletenessRing:** Circular progress indicator for data completeness
- **ValueTrendLine:** Line chart showing valuation history for a company over time

---

## Export Formats

### PDF
- Formatted report with company header, valuation summary, methodology section, assumptions table, audit trail, and footer with metadata (generated by, date, engine version)
- Generated server-side using a Python PDF library (e.g., ReportLab or WeasyPrint)

### JSON
- Structured payload matching the `ValuationResult` dataclass
- Includes full audit trail
- Machine-readable for downstream systems

### Excel
- Multi-sheet workbook:
  - **Summary:** Company info, fair value, range, method, confidence
  - **Method Details:** Each method's steps, inputs, outputs
  - **Assumptions:** Full assumptions table with rationale
  - **Audit Trail:** Complete step-by-step trace
- Generated using openpyxl

---

## Benchmark Data Layer

### Structure
- Benchmark data stored as versioned JSON files in `valuation_engine/benchmarks/data/`
- Filename format: `benchmarks-{version}.json` (e.g., `benchmarks-v2024-Q4.json`)
- A `latest.json` symlink or pointer file indicates the active version
- Each benchmark file includes metadata: source, effective date, version

### Refresh Mechanism
- Admin API endpoint (`PUT /benchmarks`) accepts a new benchmark dataset
- Writes a new versioned file, updates the pointer
- Old versions are retained for audit trail (valuations reference which benchmark version they used)
- No automatic external data fetching in MVP — refresh is manual upload

### Sectors (MVP)
The MVP ships with mocked benchmark data for these sectors:
- B2B SaaS
- Consumer Tech
- Fintech
- Healthcare / Biotech
- AI / ML
- Hardware / IoT
- E-commerce / Marketplace
- Enterprise Software
- Cybersecurity
- Climate / Clean Tech

Each sector includes: revenue multiple (p25, median, p75), EBITDA multiple (p25, median, p75), median growth rate, and metadata.

---

## Future: AI-Assisted Peer Group Selection (Spec Only — Not Built in MVP)

### Problem
Sector benchmarks are generic. Experienced auditors want to select specific comparable companies and derive multiples from that peer set. Manual entry of peer data is tedious and error-prone.

### Proposed Workflow
1. **Document upload:** Auditor uploads a PDF or Excel file containing comparable company data (e.g., a broker report, industry analysis, or internal comp sheet)
2. **AI extraction:** System uses an LLM to extract structured data: company names, revenue, EBITDA, multiples, growth rates
3. **Review & confirm:** Auditor reviews extracted data in a table, corrects errors, adds/removes companies
4. **Peer group saved:** Confirmed peer group is stored and versioned
5. **Comps method uses peer data:** Instead of sector benchmarks, the comps method uses the custom peer group's median/mean multiples

### Architecture Considerations
- The comps method already accepts multiples as input — the benchmark loader is one source, a peer group would be another
- Peer group data model: list of companies with name, revenue, EBITDA, multiples, source document reference
- Extraction would use Claude API with structured output
- The peer group is versioned and tied to a specific valuation run in the audit trail

### Not Built
This feature is not implemented in the MVP. The comps method interface should be designed to accept multiples from any source (benchmarks or peer group) so this can be added later without restructuring the engine.

---

## MVP Scope Summary

### Built
- Guided web form for company input
- Rules-based method recommendation
- 3 valuation methods: Last Round Adjusted, Comps, DCF
- Manual override method
- Audit trail with full step-by-step breakdown
- Valuation results with charts and explanation
- Method comparison view
- Valuation history per company
- PDF + JSON + Excel export
- Mocked sector benchmark data (10 sectors)
- Benchmark refresh via admin endpoint
- User selector (no auth)
- PostgreSQL persistence

### Spec'd for Future
- AI-assisted peer group selection (document ingest)
- SSO / proper authentication
- Fund/engagement grouping
- Live market data integrations
- Custom peer group management

---

## Success Criteria

An auditor can:
1. Enter limited company information through a guided form
2. Get a reasonable initial valuation quickly (< 2 seconds)
3. Understand exactly how the number was produced (plain English explanation)
4. Inspect every assumption, formula step, and data source (audit trail)
5. Compare multiple valuation methods side by side
6. Override or adjust the valuation with documented justification
7. Export a complete, reviewable report (PDF/Excel/JSON)
