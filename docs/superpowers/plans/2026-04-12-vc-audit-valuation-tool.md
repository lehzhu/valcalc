# VC Audit Valuation Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that lets auditors enter company details, get an explainable fair value estimate, inspect the full audit trail, and export reports.

**Architecture:** Monorepo with Vite+React+TypeScript frontend and FastAPI+Python backend. The valuation engine is a pure Python module (`valuation_engine/`) with zero API/DB imports — it takes dataclasses in, returns dataclasses out. PostgreSQL for persistence. Services layer glues DB ↔ engine.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, React 18, TypeScript, Vite, Tailwind CSS 3, Recharts, React Router 6, React Hook Form, openpyxl, WeasyPrint, Docker Compose

**Design reference:** Light-theme modern SaaS aesthetic inspired by Hex and Sapien.ai — soft whites/grays, generous whitespace, subtle shadows, clean sans-serif typography (Inter), refined card layouts with rounded corners, smooth micro-interactions.

**Spec:** `docs/superpowers/specs/2026-04-12-vc-audit-valuation-tool-design.md`

---

## File Structure

```
audit2/
├── frontend/
│   ├── src/
│   │   ├── main.tsx                        # React entry point
│   │   ├── App.tsx                         # Router + layout shell
│   │   ├── api/
│   │   │   └── client.ts                   # Typed fetch wrappers for all endpoints
│   │   ├── types/
│   │   │   └── index.ts                    # All TypeScript types mirroring backend
│   │   ├── components/
│   │   │   ├── Layout.tsx                  # App shell: header, user selector, nav
│   │   │   ├── RangeBar.tsx                # Horizontal low-mid-high range bar
│   │   │   ├── MethodComparisonChart.tsx   # Bar chart comparing method outputs
│   │   │   ├── WaterfallChart.tsx          # Adjustment step waterfall
│   │   │   ├── ConfidenceIndicator.tsx     # Color-coded confidence badge
│   │   │   ├── CompletenessRing.tsx        # Circular progress for data completeness
│   │   │   ├── ValueTrendLine.tsx          # Line chart for valuation history
│   │   │   └── ExportMenu.tsx              # Dropdown for PDF/JSON/Excel export
│   │   └── pages/
│   │       ├── Dashboard.tsx               # Home: recent valuations list
│   │       ├── NewValuation.tsx            # Multi-step guided form
│   │       ├── ValuationResults.tsx        # Results card + charts + audit trail
│   │       └── CompanyHistory.tsx          # All valuations for one company
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── api/
│   │   ├── main.py                         # FastAPI app, CORS, lifespan
│   │   ├── schemas.py                      # Pydantic request/response models
│   │   └── routes/
│   │       ├── companies.py                # Company CRUD
│   │       ├── valuations.py               # Run valuation, get results, override
│   │       ├── benchmarks.py               # Get/update benchmarks
│   │       ├── exports.py                  # PDF/JSON/Excel export endpoints
│   │       └── users.py                    # List/create users
│   ├── db/
│   │   ├── models.py                       # SQLAlchemy ORM models
│   │   ├── session.py                      # Engine, SessionLocal, get_db
│   │   └── alembic/
│   │       ├── env.py
│   │       └── versions/                   # Migration files
│   ├── services/
│   │   ├── valuation_service.py            # Orchestrates: DB → engine → persist
│   │   └── export_service.py               # Generates PDF, JSON, Excel files
│   ├── valuation_engine/
│   │   ├── __init__.py
│   │   ├── models.py                       # All dataclasses and enums
│   │   ├── engine.py                       # Top-level: run_valuation()
│   │   ├── rules.py                        # recommend_methods()
│   │   ├── audit_trail.py                  # build_audit_trail()
│   │   ├── explanation.py                  # generate_explanation()
│   │   ├── confidence.py                   # compute_confidence(), compute_completeness()
│   │   ├── methods/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                     # ValuationMethod protocol
│   │   │   ├── last_round.py               # LastRoundAdjusted
│   │   │   ├── comps.py                    # ComparableCompanyMultiples
│   │   │   ├── dcf.py                      # DiscountedCashFlow
│   │   │   └── manual.py                   # ManualOverride
│   │   └── benchmarks/
│   │       ├── loader.py                   # load_benchmarks(), get_sector()
│   │       └── data/
│   │           └── benchmarks-v2025-Q1.json # Mocked benchmark dataset
│   ├── tests/
│   │   ├── conftest.py                     # Fixtures: test DB, engine inputs
│   │   ├── engine/
│   │   │   ├── test_models.py
│   │   │   ├── test_rules.py
│   │   │   ├── test_last_round.py
│   │   │   ├── test_comps.py
│   │   │   ├── test_dcf.py
│   │   │   ├── test_manual.py
│   │   │   ├── test_engine.py
│   │   │   ├── test_confidence.py
│   │   │   └── test_explanation.py
│   │   └── api/
│   │       ├── test_companies.py
│   │       ├── test_valuations.py
│   │       └── test_exports.py
│   ├── pyproject.toml
│   └── alembic.ini
├── docker-compose.yml
├── .env.example
├── .gitignore
└── docs/
```

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/valuation_engine/__init__.py`
- Create: `backend/api/__init__.py`
- Create: `backend/api/main.py`
- Create: `backend/db/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "vc-audit-valuation"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.13.0",
    "psycopg2-binary>=2.9.0",
    "pydantic>=2.0.0",
    "openpyxl>=3.1.0",
    "weasyprint>=62.0",
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create package init files**

```python
# backend/valuation_engine/__init__.py
# Pure valuation engine — no API/DB imports allowed

# backend/api/__init__.py
# (empty)

# backend/db/__init__.py
# (empty)

# backend/services/__init__.py
# (empty)

# backend/tests/__init__.py
# (empty)
```

- [ ] **Step 3: Create minimal FastAPI app**

```python
# backend/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="VC Audit Valuation Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 4: Install dependencies and verify**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn api.main:app --reload --port 8000 &
curl http://localhost:8000/api/v1/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with FastAPI and project dependencies"
```

---

### Task 2: Initialize Frontend Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
```

Select "React" and "TypeScript" if prompted interactively. If it creates files, keep them. Then:

```bash
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom react-hook-form recharts
```

- [ ] **Step 2: Configure Tailwind**

```css
/* frontend/src/index.css */
@import "tailwindcss";

:root {
  --color-primary: #4f46e5;
  --color-primary-light: #818cf8;
  --color-primary-dark: #3730a3;
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --color-surface-tertiary: #f1f5f9;
  --color-border: #e2e8f0;
  --color-border-light: #f1f5f9;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94a3b8;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: var(--color-surface-secondary);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}
```

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 3: Create App shell with routing**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--color-text-tertiary)] text-lg">{name} — coming soon</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/valuations/new" element={<Placeholder name="New Valuation" />} />
        <Route path="/valuations/:id" element={<Placeholder name="Valuation Results" />} />
        <Route path="/companies/:id" element={<Placeholder name="Company History" />} />
      </Routes>
    </BrowserRouter>
  )
}
```

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd frontend
npm run dev
# Visit http://localhost:5173 — should show "Dashboard — coming soon"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, TypeScript, Tailwind"
```

---

### Task 3: Docker Compose for PostgreSQL

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vc_audit
      POSTGRES_USER: vc_audit
      POSTGRES_PASSWORD: vc_audit_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Create .env.example**

```bash
# .env.example
DATABASE_URL=postgresql://vc_audit:vc_audit_dev@localhost:5432/vc_audit
```

- [ ] **Step 3: Update .gitignore**

```gitignore
# .gitignore
.superpowers/
.env
__pycache__/
*.pyc
.venv/
node_modules/
dist/
.pytest_cache/
```

- [ ] **Step 4: Start Postgres and verify**

```bash
docker compose up -d
docker compose exec db psql -U vc_audit -c "SELECT 1"
# Expected: a row with column "?column?" value 1
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: add Docker Compose for PostgreSQL"
```

---

### Task 4: Database Setup with SQLAlchemy + Alembic

**Files:**
- Create: `backend/db/session.py`
- Create: `backend/db/models.py`
- Create: `backend/alembic.ini`
- Create: `backend/db/alembic/env.py`

- [ ] **Step 1: Create database session module**

```python
# backend/db/session.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://vc_audit:vc_audit_dev@localhost:5432/vc_audit",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create ORM models**

```python
# backend/db/models.py
import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, Float, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    stage: Mapped[str] = mapped_column(String(50))
    sector: Mapped[str] = mapped_column(String(100))
    revenue_status: Mapped[str] = mapped_column(String(50))
    current_revenue: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_round_valuation: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_amount: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_investor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    projections: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    auditor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    valuations: Mapped[list["Valuation"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Valuation(Base):
    __tablename__ = "valuations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"))
    version: Mapped[int] = mapped_column(Integer)
    primary_method: Mapped[str] = mapped_column(String(50))
    fair_value: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    fair_value_low: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    fair_value_high: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    confidence: Mapped[str] = mapped_column(String(20))
    data_completeness: Mapped[float] = mapped_column(Float)
    explanation: Mapped[str] = mapped_column(Text)
    method_results: Mapped[dict] = mapped_column(JSONB)
    audit_trail: Mapped[dict] = mapped_column(JSONB)
    overrides: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="valuations")
```

- [ ] **Step 3: Initialize Alembic**

```bash
cd backend
source .venv/bin/activate
alembic init db/alembic
```

Then update the generated files:

```ini
# backend/alembic.ini
# Find the sqlalchemy.url line and replace with:
sqlalchemy.url = postgresql://vc_audit:vc_audit_dev@localhost:5432/vc_audit
```

```python
# backend/db/alembic/env.py
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from db.session import Base
from db.models import User, Company, Valuation  # noqa: F401 — register models

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate and run initial migration**

```bash
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "initial tables: users, companies, valuations"
alembic upgrade head
```

Verify:
```bash
docker compose exec db psql -U vc_audit -c "\dt"
# Expected: users, companies, valuations tables listed
```

- [ ] **Step 5: Commit**

```bash
git add backend/db/ backend/alembic.ini
git commit -m "feat: add SQLAlchemy models and initial Alembic migration"
```

---

## Phase 2: Valuation Engine (Pure Python)

### Task 5: Engine Data Models

**Files:**
- Create: `backend/valuation_engine/models.py`
- Create: `backend/tests/engine/__init__.py`
- Create: `backend/tests/engine/test_models.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_models.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput,
    CompanyStage,
    RevenueStatus,
    MethodType,
    ConfidenceLevel,
    FundingRound,
    ProjectionPeriod,
    FinancialProjections,
    ComputationStep,
    Assumption,
    Source,
    MethodResult,
    MethodRecommendation,
    ValuationResult,
    AuditTrail,
)


def test_company_input_minimal():
    company = CompanyInput(
        name="Acme Corp",
        stage=CompanyStage.SEED,
        sector="b2b_saas",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    assert company.name == "Acme Corp"
    assert company.last_round is None
    assert company.projections is None


def test_company_input_full():
    company = CompanyInput(
        name="Beta Inc",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="fintech",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3400000"),
        last_round=FundingRound(
            date=date(2025, 6, 15),
            pre_money_valuation=Decimal("30000000"),
            amount_raised=Decimal("10000000"),
            lead_investor="Sequoia",
        ),
        projections=FinancialProjections(
            periods=[
                ProjectionPeriod(year=2026, revenue=Decimal("5000000"), ebitda=Decimal("500000"), growth_rate=0.47),
                ProjectionPeriod(year=2027, revenue=Decimal("8000000"), ebitda=Decimal("1200000"), growth_rate=0.60),
            ]
        ),
        auditor_notes="Strong product-market fit signals",
    )
    assert company.last_round.lead_investor == "Sequoia"
    assert len(company.projections.periods) == 2


def test_method_result_construction():
    result = MethodResult(
        method=MethodType.COMPS,
        value=Decimal("42000000"),
        value_low=Decimal("36000000"),
        value_high=Decimal("48000000"),
        steps=[
            ComputationStep(
                description="Apply sector revenue multiple",
                formula="revenue × multiple",
                inputs={"revenue": "$3.4M", "multiple": "12.5x"},
                output="$42.5M",
            )
        ],
        assumptions=[
            Assumption(
                name="Revenue multiple",
                value="12.5x",
                rationale="B2B SaaS median",
                source="Benchmark v2025-Q1",
                overrideable=True,
            )
        ],
        sources=[
            Source(name="Sector Benchmark", version="v2025-Q1", effective_date=date(2025, 3, 31))
        ],
        is_primary=True,
    )
    assert result.value == Decimal("42000000")
    assert result.steps[0].formula == "revenue × multiple"


def test_enum_values():
    assert CompanyStage.PRE_SEED.value == "pre_seed"
    assert RevenueStatus.MEANINGFUL_REVENUE.value == "meaningful_revenue"
    assert MethodType.LAST_ROUND_ADJUSTED.value == "last_round_adjusted"
    assert ConfidenceLevel.HIGH.value == "high"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && source .venv/bin/activate
pytest tests/engine/test_models.py -v
# Expected: ModuleNotFoundError: No module named 'valuation_engine.models'
```

- [ ] **Step 3: Implement the models**

```python
# backend/valuation_engine/models.py
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


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
    confidence: ConfidenceLevel
    data_completeness: float
    explanation: str
    method_results: list[MethodResult]
    audit_trail: AuditTrail
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_models.py -v
# Expected: 4 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/valuation_engine/models.py backend/tests/engine/
git commit -m "feat: add valuation engine data models and enums"
```

---

### Task 6: Benchmark Data Loader

**Files:**
- Create: `backend/valuation_engine/benchmarks/__init__.py`
- Create: `backend/valuation_engine/benchmarks/loader.py`
- Create: `backend/valuation_engine/benchmarks/data/benchmarks-v2025-Q1.json`
- Create: `backend/tests/engine/test_benchmarks.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_benchmarks.py
import pytest
from decimal import Decimal
from valuation_engine.benchmarks.loader import load_benchmarks, get_sector_benchmarks


def test_load_benchmarks_returns_dict():
    data = load_benchmarks()
    assert isinstance(data, dict)
    assert "metadata" in data
    assert "sectors" in data
    assert data["metadata"]["version"] == "v2025-Q1"


def test_get_sector_benchmarks_known_sector():
    sector = get_sector_benchmarks("b2b_saas")
    assert "revenue_multiple" in sector
    assert "median" in sector["revenue_multiple"]
    assert sector["revenue_multiple"]["median"] > 0


def test_get_sector_benchmarks_unknown_sector():
    with pytest.raises(KeyError, match="unknown_sector"):
        get_sector_benchmarks("unknown_sector")


def test_all_sectors_have_required_fields():
    data = load_benchmarks()
    required_fields = ["revenue_multiple", "median_growth_rate", "sector_trend_factor"]
    for sector_key, sector_data in data["sectors"].items():
        for field in required_fields:
            assert field in sector_data, f"{sector_key} missing {field}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_benchmarks.py -v
# Expected: ModuleNotFoundError
```

- [ ] **Step 3: Create benchmark data file**

```json
{
  "metadata": {
    "version": "v2025-Q1",
    "source": "Mock benchmark dataset for MVP",
    "effective_date": "2025-03-31"
  },
  "sectors": {
    "b2b_saas": {
      "display_name": "B2B SaaS",
      "revenue_multiple": { "p25": 8.0, "median": 12.5, "p75": 18.0 },
      "ebitda_multiple": { "p25": 15.0, "median": 22.0, "p75": 30.0 },
      "median_growth_rate": 0.35,
      "sector_trend_factor": 0.03
    },
    "consumer_tech": {
      "display_name": "Consumer Tech",
      "revenue_multiple": { "p25": 4.0, "median": 7.0, "p75": 12.0 },
      "ebitda_multiple": { "p25": 10.0, "median": 16.0, "p75": 24.0 },
      "median_growth_rate": 0.25,
      "sector_trend_factor": -0.02
    },
    "fintech": {
      "display_name": "Fintech",
      "revenue_multiple": { "p25": 6.0, "median": 10.0, "p75": 16.0 },
      "ebitda_multiple": { "p25": 12.0, "median": 20.0, "p75": 28.0 },
      "median_growth_rate": 0.30,
      "sector_trend_factor": 0.01
    },
    "healthcare_biotech": {
      "display_name": "Healthcare / Biotech",
      "revenue_multiple": { "p25": 5.0, "median": 9.0, "p75": 15.0 },
      "ebitda_multiple": { "p25": 12.0, "median": 18.0, "p75": 26.0 },
      "median_growth_rate": 0.20,
      "sector_trend_factor": 0.02
    },
    "ai_ml": {
      "display_name": "AI / ML",
      "revenue_multiple": { "p25": 12.0, "median": 20.0, "p75": 35.0 },
      "ebitda_multiple": { "p25": 20.0, "median": 30.0, "p75": 50.0 },
      "median_growth_rate": 0.50,
      "sector_trend_factor": 0.08
    },
    "hardware_iot": {
      "display_name": "Hardware / IoT",
      "revenue_multiple": { "p25": 2.5, "median": 5.0, "p75": 8.0 },
      "ebitda_multiple": { "p25": 8.0, "median": 12.0, "p75": 18.0 },
      "median_growth_rate": 0.15,
      "sector_trend_factor": 0.00
    },
    "ecommerce_marketplace": {
      "display_name": "E-commerce / Marketplace",
      "revenue_multiple": { "p25": 3.0, "median": 5.5, "p75": 9.0 },
      "ebitda_multiple": { "p25": 10.0, "median": 15.0, "p75": 22.0 },
      "median_growth_rate": 0.20,
      "sector_trend_factor": -0.01
    },
    "enterprise_software": {
      "display_name": "Enterprise Software",
      "revenue_multiple": { "p25": 7.0, "median": 11.0, "p75": 16.0 },
      "ebitda_multiple": { "p25": 14.0, "median": 20.0, "p75": 28.0 },
      "median_growth_rate": 0.25,
      "sector_trend_factor": 0.02
    },
    "cybersecurity": {
      "display_name": "Cybersecurity",
      "revenue_multiple": { "p25": 9.0, "median": 14.0, "p75": 22.0 },
      "ebitda_multiple": { "p25": 16.0, "median": 24.0, "p75": 35.0 },
      "median_growth_rate": 0.30,
      "sector_trend_factor": 0.05
    },
    "climate_cleantech": {
      "display_name": "Climate / Clean Tech",
      "revenue_multiple": { "p25": 4.0, "median": 7.5, "p75": 12.0 },
      "ebitda_multiple": { "p25": 10.0, "median": 16.0, "p75": 24.0 },
      "median_growth_rate": 0.25,
      "sector_trend_factor": 0.04
    }
  }
}
```

Save to `backend/valuation_engine/benchmarks/data/benchmarks-v2025-Q1.json`.

- [ ] **Step 4: Implement the loader**

```python
# backend/valuation_engine/benchmarks/__init__.py
# (empty)

# backend/valuation_engine/benchmarks/loader.py
import json
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"
_cache: dict | None = None


def load_benchmarks(version: str | None = None) -> dict:
    """Load benchmark data. Uses latest version if not specified."""
    global _cache
    if _cache is not None and version is None:
        return _cache

    if version:
        path = _DATA_DIR / f"benchmarks-{version}.json"
    else:
        files = sorted(_DATA_DIR.glob("benchmarks-*.json"))
        if not files:
            raise FileNotFoundError("No benchmark data files found")
        path = files[-1]

    with open(path) as f:
        data = json.load(f)

    if version is None:
        _cache = data
    return data


def get_sector_benchmarks(sector_key: str, version: str | None = None) -> dict:
    """Get benchmark data for a specific sector. Raises KeyError if not found."""
    data = load_benchmarks(version)
    sectors = data["sectors"]
    if sector_key not in sectors:
        raise KeyError(f"{sector_key}")
    return sectors[sector_key]


def list_sectors(version: str | None = None) -> list[dict]:
    """Return list of available sectors with keys and display names."""
    data = load_benchmarks(version)
    return [
        {"key": key, "display_name": sector["display_name"]}
        for key, sector in data["sectors"].items()
    ]


def get_benchmark_version(version: str | None = None) -> str:
    """Return the version string of the loaded benchmarks."""
    data = load_benchmarks(version)
    return data["metadata"]["version"]


def clear_cache():
    """Clear cached benchmark data. Used after benchmark refresh."""
    global _cache
    _cache = None
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_benchmarks.py -v
# Expected: 4 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/valuation_engine/benchmarks/ backend/tests/engine/test_benchmarks.py
git commit -m "feat: add benchmark data loader with 10 sector datasets"
```

---

### Task 7: Last Round Adjusted Method

**Files:**
- Create: `backend/valuation_engine/methods/__init__.py`
- Create: `backend/valuation_engine/methods/base.py`
- Create: `backend/valuation_engine/methods/last_round.py`
- Create: `backend/tests/engine/test_last_round.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_last_round.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, FundingRound, MethodType,
)
from valuation_engine.methods.last_round import LastRoundAdjusted


def _make_company(round_date: date, pre_money: Decimal, raised: Decimal) -> CompanyInput:
    return CompanyInput(
        name="Test Co",
        stage=CompanyStage.SEED,
        sector="b2b_saas",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(
            date=round_date,
            pre_money_valuation=pre_money,
            amount_raised=raised,
        ),
    )


def test_recent_round_no_decay():
    """A round less than 12 months old should have no time decay."""
    company = _make_company(
        round_date=date(2025, 6, 1),
        pre_money=Decimal("30000000"),
        raised=Decimal("10000000"),
    )
    method = LastRoundAdjusted()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    assert result.method == MethodType.LAST_ROUND_ADJUSTED
    # Post-money = 40M, no time decay (< 12 months), sector trend +3%
    expected_base = Decimal("40000000")
    assert result.value > expected_base * Decimal("0.95")
    assert result.value < expected_base * Decimal("1.15")
    assert len(result.steps) >= 3
    assert len(result.assumptions) >= 2


def test_old_round_has_decay():
    """A round older than 12 months should have time decay applied."""
    company = _make_company(
        round_date=date(2023, 1, 1),
        pre_money=Decimal("20000000"),
        raised=Decimal("5000000"),
    )
    method = LastRoundAdjusted()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    post_money = Decimal("25000000")
    # 3 years = 12 quarters, minus 4 (first year no decay) = 8 quarters × -2% = -16%
    assert result.value < post_money


def test_range_is_plus_minus_15_percent():
    company = _make_company(
        round_date=date(2025, 6, 1),
        pre_money=Decimal("30000000"),
        raised=Decimal("10000000"),
    )
    method = LastRoundAdjusted()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    expected_low = result.value * Decimal("0.85")
    expected_high = result.value * Decimal("1.15")
    assert abs(result.value_low - expected_low) < Decimal("1")
    assert abs(result.value_high - expected_high) < Decimal("1")


def test_steps_are_traceable():
    company = _make_company(
        round_date=date(2025, 6, 1),
        pre_money=Decimal("30000000"),
        raised=Decimal("10000000"),
    )
    method = LastRoundAdjusted()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    step_descriptions = [s.description for s in result.steps]
    assert "Calculate post-money valuation" in step_descriptions
    assert "Apply time adjustment" in step_descriptions
    assert "Apply market/sector adjustment" in step_descriptions
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_last_round.py -v
# Expected: ModuleNotFoundError
```

- [ ] **Step 3: Create method base protocol**

```python
# backend/valuation_engine/methods/__init__.py
# (empty)

# backend/valuation_engine/methods/base.py
from typing import Protocol
from datetime import date

from valuation_engine.models import CompanyInput, MethodResult


class ValuationMethod(Protocol):
    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        ...
```

- [ ] **Step 4: Implement Last Round Adjusted**

```python
# backend/valuation_engine/methods/last_round.py
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from valuation_engine.models import (
    CompanyInput, MethodResult, MethodType, ComputationStep, Assumption, Source,
)
from valuation_engine.benchmarks.loader import get_sector_benchmarks, get_benchmark_version


def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"


class LastRoundAdjusted:
    """Adjusts prior funding round valuation for time elapsed and market conditions."""

    QUARTERLY_DECAY_RATE = Decimal("0.02")  # -2% per quarter after 12 months
    DECAY_FREE_MONTHS = 12
    RANGE_SPREAD = Decimal("0.15")  # ±15%

    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        last_round = company.last_round
        steps: list[ComputationStep] = []
        assumptions: list[Assumption] = []
        sources: list[Source] = []

        # Step 1: Post-money valuation
        post_money = last_round.pre_money_valuation + last_round.amount_raised
        steps.append(ComputationStep(
            description="Calculate post-money valuation",
            formula="pre_money + amount_raised",
            inputs={
                "pre_money": _format_currency(last_round.pre_money_valuation),
                "amount_raised": _format_currency(last_round.amount_raised),
            },
            output=_format_currency(post_money),
        ))

        # Step 2: Time adjustment
        months_elapsed = (valuation_date.year - last_round.date.year) * 12 + (
            valuation_date.month - last_round.date.month
        )
        if months_elapsed <= self.DECAY_FREE_MONTHS:
            time_factor = Decimal("1.0")
            time_rationale = f"Round is {months_elapsed} months old (< {self.DECAY_FREE_MONTHS}), no decay applied"
        else:
            decay_months = months_elapsed - self.DECAY_FREE_MONTHS
            decay_quarters = Decimal(str(decay_months)) / Decimal("3")
            total_decay = self.QUARTERLY_DECAY_RATE * decay_quarters
            time_factor = Decimal("1.0") - total_decay
            time_factor = max(time_factor, Decimal("0.5"))  # Floor at 50%
            time_rationale = (
                f"Round is {months_elapsed} months old, "
                f"{decay_quarters.quantize(Decimal('0.1'))} quarters of decay at "
                f"{self.QUARTERLY_DECAY_RATE * 100}% per quarter"
            )

        time_adjusted = (post_money * time_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(
            description="Apply time adjustment",
            formula="post_money × time_factor",
            inputs={
                "post_money": _format_currency(post_money),
                "time_factor": f"{time_factor:.4f}",
                "months_elapsed": str(months_elapsed),
            },
            output=_format_currency(time_adjusted),
        ))
        assumptions.append(Assumption(
            name="Time decay rate",
            value=f"-{self.QUARTERLY_DECAY_RATE * 100}% per quarter after {self.DECAY_FREE_MONTHS} months",
            rationale=time_rationale,
            overrideable=True,
        ))

        # Step 3: Market/sector adjustment
        try:
            sector_data = get_sector_benchmarks(company.sector)
            trend_factor = Decimal(str(sector_data["sector_trend_factor"]))
            benchmark_version = get_benchmark_version()
            sources.append(Source(
                name=f"Sector Benchmark - {sector_data.get('display_name', company.sector)}",
                version=benchmark_version,
                effective_date=date.fromisoformat(
                    # Fall back to valuation date if not in benchmarks
                    "2025-03-31"
                ),
            ))
        except KeyError:
            trend_factor = Decimal("0")
            benchmark_version = "N/A"

        market_factor = Decimal("1") + trend_factor
        final_value = (time_adjusted * market_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(
            description="Apply market/sector adjustment",
            formula="time_adjusted × (1 + sector_trend_factor)",
            inputs={
                "time_adjusted": _format_currency(time_adjusted),
                "sector_trend_factor": f"{trend_factor:+.2%}",
            },
            output=_format_currency(final_value),
        ))
        assumptions.append(Assumption(
            name="Sector trend adjustment",
            value=f"{trend_factor:+.2%}",
            rationale=f"Sector trend factor for {company.sector}",
            source=f"Benchmark {benchmark_version}",
            overrideable=True,
        ))

        # Range
        value_low = (final_value * (Decimal("1") - self.RANGE_SPREAD)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        value_high = (final_value * (Decimal("1") + self.RANGE_SPREAD)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        return MethodResult(
            method=MethodType.LAST_ROUND_ADJUSTED,
            value=final_value,
            value_low=value_low,
            value_high=value_high,
            steps=steps,
            assumptions=assumptions,
            sources=sources,
            is_primary=False,
        )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_last_round.py -v
# Expected: 4 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/valuation_engine/methods/ backend/tests/engine/test_last_round.py
git commit -m "feat: implement Last Round Adjusted valuation method"
```

---

### Task 8: Comps Method

**Files:**
- Create: `backend/valuation_engine/methods/comps.py`
- Create: `backend/tests/engine/test_comps.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_comps.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
)
from valuation_engine.methods.comps import ComparableCompanyMultiples


def _make_company(
    sector: str = "b2b_saas",
    revenue: Decimal = Decimal("3400000"),
    stage: CompanyStage = CompanyStage.SERIES_A_PLUS,
) -> CompanyInput:
    return CompanyInput(
        name="Test Co",
        stage=stage,
        sector=sector,
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=revenue,
    )


def test_basic_comps_valuation():
    company = _make_company()
    method = ComparableCompanyMultiples()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    assert result.method == MethodType.COMPS
    # B2B SaaS median = 12.5x, revenue = $3.4M → base ~$42.5M before adjustments
    assert result.value > Decimal("20000000")
    assert result.value < Decimal("80000000")


def test_range_uses_percentiles():
    company = _make_company()
    method = ComparableCompanyMultiples()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    # Low should use p25 (8.0x), high should use p75 (18.0x), roughly
    assert result.value_low < result.value
    assert result.value_high > result.value


def test_steps_include_benchmark_lookup():
    company = _make_company()
    method = ComparableCompanyMultiples()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    step_descriptions = [s.description for s in result.steps]
    assert "Look up sector revenue multiple" in step_descriptions
    assert "Calculate base valuation" in step_descriptions
    assert "Apply stage/size discount" in step_descriptions


def test_higher_revenue_higher_valuation():
    low = _make_company(revenue=Decimal("1000000"))
    high = _make_company(revenue=Decimal("10000000"))
    method = ComparableCompanyMultiples()

    result_low = method.compute(low, valuation_date=date(2026, 1, 1))
    result_high = method.compute(high, valuation_date=date(2026, 1, 1))

    assert result_high.value > result_low.value


def test_accepts_custom_multiples():
    """Comps method should accept externally-supplied multiples (for future peer groups)."""
    company = _make_company()
    custom = {"p25": 5.0, "median": 8.0, "p75": 12.0}
    method = ComparableCompanyMultiples()
    result = method.compute(company, valuation_date=date(2026, 1, 1), custom_multiples=custom)

    # With median of 8.0x on $3.4M → base ~$27.2M before adjustments
    assert result.value < Decimal("40000000")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_comps.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement Comps method**

```python
# backend/valuation_engine/methods/comps.py
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from valuation_engine.models import (
    CompanyInput, CompanyStage, MethodResult, MethodType,
    ComputationStep, Assumption, Source,
)
from valuation_engine.benchmarks.loader import get_sector_benchmarks, get_benchmark_version


def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"


# Stage-based illiquidity/size discounts
_STAGE_DISCOUNTS = {
    CompanyStage.PRE_SEED: Decimal("0.30"),
    CompanyStage.SEED: Decimal("0.25"),
    CompanyStage.SERIES_A_PLUS: Decimal("0.15"),
    CompanyStage.GROWTH: Decimal("0.08"),
    CompanyStage.MATURE_PRIVATE: Decimal("0.05"),
}


class ComparableCompanyMultiples:
    """Values a company using sector benchmark revenue multiples."""

    def compute(
        self,
        company: CompanyInput,
        valuation_date: date,
        custom_multiples: dict | None = None,
    ) -> MethodResult:
        steps: list[ComputationStep] = []
        assumptions: list[Assumption] = []
        sources: list[Source] = []

        revenue = company.current_revenue

        # Step 1: Get multiples (benchmark or custom)
        if custom_multiples:
            multiples = custom_multiples
            multiple_source = "Custom peer group"
            benchmark_version = "custom"
        else:
            sector_data = get_sector_benchmarks(company.sector)
            multiples = sector_data["revenue_multiple"]
            median_growth = sector_data.get("median_growth_rate", 0)
            multiple_source = f"Sector Benchmark - {sector_data.get('display_name', company.sector)}"
            benchmark_version = get_benchmark_version()
            sources.append(Source(
                name=multiple_source,
                version=benchmark_version,
                effective_date=date(2025, 3, 31),
            ))

        median_multiple = Decimal(str(multiples["median"]))
        p25_multiple = Decimal(str(multiples["p25"]))
        p75_multiple = Decimal(str(multiples["p75"]))

        steps.append(ComputationStep(
            description="Look up sector revenue multiple",
            formula="sector → {p25, median, p75}",
            inputs={
                "sector": company.sector,
                "p25": f"{p25_multiple}x",
                "median": f"{median_multiple}x",
                "p75": f"{p75_multiple}x",
            },
            output=f"{median_multiple}x (median)",
        ))

        # Step 2: Base valuation
        base_value = (revenue * median_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        base_low = (revenue * p25_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        base_high = (revenue * p75_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(
            description="Calculate base valuation",
            formula="revenue × median_multiple",
            inputs={
                "revenue": _format_currency(revenue),
                "multiple": f"{median_multiple}x",
            },
            output=_format_currency(base_value),
        ))
        assumptions.append(Assumption(
            name="Revenue multiple",
            value=f"{median_multiple}x",
            rationale=f"Median revenue multiple for {company.sector}",
            source=f"Benchmark {benchmark_version}",
            overrideable=True,
        ))

        # Step 3: Growth adjustment (if not custom multiples)
        growth_adjustment = Decimal("1.0")
        if not custom_multiples:
            sector_data = get_sector_benchmarks(company.sector)
            sector_median_growth = Decimal(str(sector_data.get("median_growth_rate", 0.25)))
            # If we have projections with growth rates, compare to sector median
            if company.projections and company.projections.periods:
                company_growth = Decimal(str(company.projections.periods[0].growth_rate or 0))
                growth_diff = company_growth - sector_median_growth
                # Adjust multiple by half the growth differential
                growth_adjustment = Decimal("1") + (growth_diff * Decimal("0.5"))
                growth_adjustment = max(Decimal("0.7"), min(growth_adjustment, Decimal("1.5")))

                steps.append(ComputationStep(
                    description="Apply growth rate adjustment",
                    formula="base × growth_adjustment",
                    inputs={
                        "company_growth": f"{company_growth:.0%}",
                        "sector_median_growth": f"{sector_median_growth:.0%}",
                        "adjustment_factor": f"{growth_adjustment:.4f}",
                    },
                    output=_format_currency(
                        (base_value * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                    ),
                ))
                assumptions.append(Assumption(
                    name="Growth adjustment",
                    value=f"{growth_adjustment:.4f}x",
                    rationale=f"Company growth ({company_growth:.0%}) vs sector median ({sector_median_growth:.0%})",
                    overrideable=True,
                ))

        adjusted_value = (base_value * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        adjusted_low = (base_low * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        adjusted_high = (base_high * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        # Step 4: Stage/size discount
        discount = _STAGE_DISCOUNTS.get(company.stage, Decimal("0.15"))
        discount_factor = Decimal("1") - discount

        final_value = (adjusted_value * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        final_low = (adjusted_low * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        final_high = (adjusted_high * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(
            description="Apply stage/size discount",
            formula="adjusted_value × (1 - discount)",
            inputs={
                "adjusted_value": _format_currency(adjusted_value),
                "stage": company.stage.value,
                "discount": f"{discount:.0%}",
            },
            output=_format_currency(final_value),
        ))
        assumptions.append(Assumption(
            name="Stage/size discount",
            value=f"-{discount:.0%}",
            rationale=f"Illiquidity and size discount for {company.stage.value} stage",
            overrideable=True,
        ))

        return MethodResult(
            method=MethodType.COMPS,
            value=final_value,
            value_low=final_low,
            value_high=final_high,
            steps=steps,
            assumptions=assumptions,
            sources=sources,
            is_primary=False,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_comps.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/valuation_engine/methods/comps.py backend/tests/engine/test_comps.py
git commit -m "feat: implement Comparable Company Multiples valuation method"
```

---

### Task 9: DCF Method

**Files:**
- Create: `backend/valuation_engine/methods/dcf.py`
- Create: `backend/tests/engine/test_dcf.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_dcf.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FinancialProjections, ProjectionPeriod,
)
from valuation_engine.methods.dcf import DiscountedCashFlow


def _make_company(
    stage: CompanyStage = CompanyStage.GROWTH,
    discount_rate: float | None = None,
) -> CompanyInput:
    return CompanyInput(
        name="Test Co",
        stage=stage,
        sector="b2b_saas",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("10000000"),
        projections=FinancialProjections(
            periods=[
                ProjectionPeriod(year=2026, revenue=Decimal("14000000"), ebitda=Decimal("2000000")),
                ProjectionPeriod(year=2027, revenue=Decimal("20000000"), ebitda=Decimal("4000000")),
                ProjectionPeriod(year=2028, revenue=Decimal("28000000"), ebitda=Decimal("7000000")),
                ProjectionPeriod(year=2029, revenue=Decimal("35000000"), ebitda=Decimal("10000000")),
                ProjectionPeriod(year=2030, revenue=Decimal("42000000"), ebitda=Decimal("14000000")),
            ],
            discount_rate=discount_rate,
        ),
    )


def test_basic_dcf_valuation():
    company = _make_company()
    method = DiscountedCashFlow()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    assert result.method == MethodType.DCF
    assert result.value > 0
    assert result.value_low < result.value < result.value_high


def test_steps_include_all_dcf_phases():
    company = _make_company()
    method = DiscountedCashFlow()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    step_descriptions = [s.description for s in result.steps]
    assert any("free cash flow" in s.lower() for s in step_descriptions)
    assert any("discount" in s.lower() for s in step_descriptions)
    assert any("terminal" in s.lower() for s in step_descriptions)


def test_custom_discount_rate_overrides_default():
    company_default = _make_company()
    company_custom = _make_company(discount_rate=0.10)
    method = DiscountedCashFlow()

    result_default = method.compute(company_default, valuation_date=date(2026, 1, 1))
    result_custom = method.compute(company_custom, valuation_date=date(2026, 1, 1))

    # Lower discount rate → higher valuation
    assert result_custom.value > result_default.value


def test_earlier_stage_higher_discount():
    """Earlier-stage companies should get higher default discount rates → lower valuations."""
    company_growth = _make_company(stage=CompanyStage.GROWTH)
    company_seed = _make_company(stage=CompanyStage.SEED)
    method = DiscountedCashFlow()

    result_growth = method.compute(company_growth, valuation_date=date(2026, 1, 1))
    result_seed = method.compute(company_seed, valuation_date=date(2026, 1, 1))

    assert result_growth.value > result_seed.value


def test_sensitivity_range():
    """Range should be based on discount rate ±3pp."""
    company = _make_company()
    method = DiscountedCashFlow()
    result = method.compute(company, valuation_date=date(2026, 1, 1))

    # High value (lower discount rate) should be meaningfully higher
    spread = (result.value_high - result.value_low) / result.value
    assert spread > Decimal("0.1")  # At least 10% spread
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_dcf.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement DCF method**

```python
# backend/valuation_engine/methods/dcf.py
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from valuation_engine.models import (
    CompanyInput, CompanyStage, MethodResult, MethodType,
    ComputationStep, Assumption, Source,
)


def _format_currency(value: Decimal) -> str:
    if abs(value) >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if abs(value) >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if abs(value) >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"


# Default discount rates by stage
_DEFAULT_DISCOUNT_RATES = {
    CompanyStage.PRE_SEED: 0.50,
    CompanyStage.SEED: 0.45,
    CompanyStage.SERIES_A_PLUS: 0.35,
    CompanyStage.GROWTH: 0.22,
    CompanyStage.MATURE_PRIVATE: 0.15,
}

EBITDA_TO_FCF = Decimal("0.75")  # Simplified: FCF ≈ 75% of EBITDA
TERMINAL_GROWTH_RATE = Decimal("0.03")  # 3% perpetuity growth
SENSITIVITY_PP = Decimal("0.03")  # ±3 percentage points


class DiscountedCashFlow:
    """DCF valuation using projected EBITDA, stage-based discount rates, and terminal value."""

    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        steps: list[ComputationStep] = []
        assumptions: list[Assumption] = []
        sources: list[Source] = []

        projections = company.projections
        periods = projections.periods

        # Determine discount rate
        if projections.discount_rate is not None:
            discount_rate = Decimal(str(projections.discount_rate))
            rate_source = "User-supplied"
        else:
            discount_rate = Decimal(str(_DEFAULT_DISCOUNT_RATES.get(company.stage, 0.25)))
            rate_source = f"Default for {company.stage.value} stage"

        assumptions.append(Assumption(
            name="Discount rate (WACC)",
            value=f"{discount_rate:.0%}",
            rationale=rate_source,
            overrideable=True,
        ))
        assumptions.append(Assumption(
            name="EBITDA-to-FCF conversion",
            value=f"{EBITDA_TO_FCF:.0%}",
            rationale="Simplified: FCF ≈ 75% of EBITDA (accounts for capex and working capital)",
            overrideable=True,
        ))
        assumptions.append(Assumption(
            name="Terminal growth rate",
            value=f"{TERMINAL_GROWTH_RATE:.0%}",
            rationale="Long-run GDP-aligned perpetuity growth rate",
            overrideable=True,
        ))

        # Step 1: Project free cash flows
        fcfs: list[Decimal] = []
        fcf_details: list[str] = []
        for period in periods:
            ebitda = period.ebitda or Decimal("0")
            fcf = (ebitda * EBITDA_TO_FCF).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            fcfs.append(fcf)
            fcf_details.append(f"Y{period.year}: {_format_currency(fcf)}")

        steps.append(ComputationStep(
            description="Project free cash flows from EBITDA",
            formula="FCF = EBITDA × 0.75",
            inputs={"periods": ", ".join(fcf_details)},
            output=f"{len(fcfs)} periods projected",
        ))

        # Step 2: Discount projected cash flows
        pv_fcfs: list[Decimal] = []
        discount_details: list[str] = []
        for i, fcf in enumerate(fcfs):
            year = i + 1
            pv_factor = Decimal("1") / (Decimal("1") + discount_rate) ** year
            pv = (fcf * pv_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            pv_fcfs.append(pv)
            discount_details.append(f"Y{year}: {_format_currency(pv)}")

        sum_pv_fcfs = sum(pv_fcfs)
        steps.append(ComputationStep(
            description="Discount projected cash flows to present value",
            formula="PV = FCF / (1 + r)^t",
            inputs={
                "discount_rate": f"{discount_rate:.0%}",
                "discounted_flows": ", ".join(discount_details),
            },
            output=_format_currency(sum_pv_fcfs),
        ))

        # Step 3: Terminal value
        final_fcf = fcfs[-1]
        terminal_value = final_fcf * (Decimal("1") + TERMINAL_GROWTH_RATE) / (discount_rate - TERMINAL_GROWTH_RATE)
        terminal_value = terminal_value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        n = len(fcfs)
        tv_pv_factor = Decimal("1") / (Decimal("1") + discount_rate) ** n
        pv_terminal = (terminal_value * tv_pv_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(
            description="Calculate and discount terminal value",
            formula="TV = FCF_final × (1 + g) / (r - g), then PV = TV / (1 + r)^n",
            inputs={
                "final_fcf": _format_currency(final_fcf),
                "terminal_growth": f"{TERMINAL_GROWTH_RATE:.0%}",
                "terminal_value": _format_currency(terminal_value),
            },
            output=f"PV of terminal: {_format_currency(pv_terminal)}",
        ))

        # Step 4: Enterprise value
        enterprise_value = sum_pv_fcfs + pv_terminal

        steps.append(ComputationStep(
            description="Sum discounted cash flows and terminal value",
            formula="EV = Σ PV(FCFs) + PV(TV)",
            inputs={
                "sum_pv_fcfs": _format_currency(sum_pv_fcfs),
                "pv_terminal": _format_currency(pv_terminal),
            },
            output=_format_currency(enterprise_value),
        ))

        # Sensitivity range: ±3pp on discount rate
        def _compute_ev(rate: Decimal) -> Decimal:
            pv_sum = Decimal("0")
            for i, fcf in enumerate(fcfs):
                pv_sum += fcf / (Decimal("1") + rate) ** (i + 1)
            tv = final_fcf * (Decimal("1") + TERMINAL_GROWTH_RATE) / (rate - TERMINAL_GROWTH_RATE)
            pv_tv = tv / (Decimal("1") + rate) ** n
            return (pv_sum + pv_tv).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        ev_high = _compute_ev(discount_rate - SENSITIVITY_PP)  # Lower rate → higher value
        ev_low = _compute_ev(discount_rate + SENSITIVITY_PP)   # Higher rate → lower value

        return MethodResult(
            method=MethodType.DCF,
            value=enterprise_value,
            value_low=ev_low,
            value_high=ev_high,
            steps=steps,
            assumptions=assumptions,
            sources=sources,
            is_primary=False,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_dcf.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/valuation_engine/methods/dcf.py backend/tests/engine/test_dcf.py
git commit -m "feat: implement DCF valuation method with sensitivity analysis"
```

---

### Task 10: Manual Override Method

**Files:**
- Create: `backend/valuation_engine/methods/manual.py`
- Create: `backend/tests/engine/test_manual.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_manual.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import MethodType
from valuation_engine.methods.manual import ManualOverride


def test_manual_override_records_value():
    method = ManualOverride()
    result = method.compute(
        fair_value=Decimal("50000000"),
        justification="Based on recent comparable transaction in same vertical",
        prior_computed_value=Decimal("42000000"),
        valuation_date=date(2026, 1, 1),
    )

    assert result.method == MethodType.MANUAL
    assert result.value == Decimal("50000000")
    assert result.value_low == Decimal("50000000")
    assert result.value_high == Decimal("50000000")


def test_manual_override_logs_delta():
    method = ManualOverride()
    result = method.compute(
        fair_value=Decimal("50000000"),
        justification="Market intel",
        prior_computed_value=Decimal("42000000"),
        valuation_date=date(2026, 1, 1),
    )

    step_descriptions = [s.description for s in result.steps]
    assert "Record override delta" in step_descriptions


def test_manual_override_without_prior():
    method = ManualOverride()
    result = method.compute(
        fair_value=Decimal("25000000"),
        justification="Independent expert assessment",
        prior_computed_value=None,
        valuation_date=date(2026, 1, 1),
    )

    assert result.value == Decimal("25000000")
    assert len(result.steps) >= 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_manual.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement Manual Override**

```python
# backend/valuation_engine/methods/manual.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    MethodResult, MethodType, ComputationStep, Assumption, Source,
)


def _format_currency(value: Decimal) -> str:
    if abs(value) >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if abs(value) >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value:,.0f}"


class ManualOverride:
    """Records a user-supplied valuation with documented justification."""

    def compute(
        self,
        fair_value: Decimal,
        justification: str,
        prior_computed_value: Decimal | None,
        valuation_date: date,
    ) -> MethodResult:
        steps: list[ComputationStep] = []
        assumptions: list[Assumption] = []

        steps.append(ComputationStep(
            description="Record auditor-supplied fair value",
            formula="manual_entry",
            inputs={"fair_value": _format_currency(fair_value)},
            output=_format_currency(fair_value),
        ))

        assumptions.append(Assumption(
            name="Auditor justification",
            value=justification,
            rationale="Manual override by auditor",
            overrideable=False,
        ))

        if prior_computed_value is not None:
            delta = fair_value - prior_computed_value
            delta_pct = (delta / prior_computed_value * 100).quantize(Decimal("0.1"))
            steps.append(ComputationStep(
                description="Record override delta",
                formula="manual_value - computed_value",
                inputs={
                    "manual_value": _format_currency(fair_value),
                    "computed_value": _format_currency(prior_computed_value),
                },
                output=f"{_format_currency(delta)} ({delta_pct:+}%)",
            ))

        return MethodResult(
            method=MethodType.MANUAL,
            value=fair_value,
            value_low=fair_value,
            value_high=fair_value,
            steps=steps,
            assumptions=assumptions,
            sources=[],
            is_primary=True,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_manual.py -v
# Expected: 3 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/valuation_engine/methods/manual.py backend/tests/engine/test_manual.py
git commit -m "feat: implement Manual Override valuation method"
```

---

### Task 11: Rules Engine (Method Recommendation)

**Files:**
- Create: `backend/valuation_engine/rules.py`
- Create: `backend/tests/engine/test_rules.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_rules.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.rules import recommend_methods


def test_pre_revenue_with_round():
    company = CompanyInput(
        name="Early Co",
        stage=CompanyStage.SEED,
        sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=date(2025, 6, 1), pre_money_valuation=Decimal("10000000"), amount_raised=Decimal("3000000")),
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.LAST_ROUND_ADJUSTED
    assert recs[0].is_primary is True


def test_pre_revenue_no_round():
    company = CompanyInput(
        name="Very Early Co",
        stage=CompanyStage.PRE_SEED,
        sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    recs = recommend_methods(company)
    assert recs[0].method == MethodType.MANUAL
    assert recs[0].is_primary is True


def test_early_revenue_with_benchmarks():
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="b2b_saas",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3000000"),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.COMPS


def test_revenue_with_round_gets_secondary():
    company = CompanyInput(
        name="Revenue Co",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="b2b_saas",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("3000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("20000000"), amount_raised=Decimal("5000000")),
    )
    recs = recommend_methods(company)
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods
    assert MethodType.LAST_ROUND_ADJUSTED in methods


def test_growth_with_projections_gets_dcf():
    company = CompanyInput(
        name="Growth Co",
        stage=CompanyStage.GROWTH,
        sector="fintech",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("20000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("30000000"), ebitda=Decimal("5000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("42000000"), ebitda=Decimal("10000000")),
        ]),
    )
    recs = recommend_methods(company)
    primary = [r for r in recs if r.is_primary]
    assert primary[0].method == MethodType.DCF
    methods = [r.method for r in recs]
    assert MethodType.COMPS in methods


def test_recommendations_have_rationales():
    company = CompanyInput(
        name="Test Co",
        stage=CompanyStage.SEED,
        sector="b2b_saas",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(date=date(2025, 6, 1), pre_money_valuation=Decimal("10000000"), amount_raised=Decimal("3000000")),
    )
    recs = recommend_methods(company)
    for rec in recs:
        assert rec.rationale != ""
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/engine/test_rules.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement the rules engine**

```python
# backend/valuation_engine/rules.py
from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, MethodRecommendation,
)

_LATER_STAGES = {CompanyStage.GROWTH, CompanyStage.MATURE_PRIVATE}


def recommend_methods(company: CompanyInput) -> list[MethodRecommendation]:
    """Return ranked method recommendations based on company data availability."""
    recommendations: list[MethodRecommendation] = []

    has_revenue = (
        company.revenue_status != RevenueStatus.PRE_REVENUE
        and company.current_revenue is not None
        and company.current_revenue > 0
    )
    has_round = company.last_round is not None
    has_projections = (
        company.projections is not None
        and len(company.projections.periods) >= 2
        and any(p.ebitda is not None and p.ebitda > 0 for p in company.projections.periods)
    )
    is_later_stage = company.stage in _LATER_STAGES

    # Case 1: Revenue + projections + later stage → DCF primary, Comps secondary
    if has_revenue and has_projections and is_later_stage:
        recommendations.append(MethodRecommendation(
            method=MethodType.DCF,
            is_primary=True,
            rationale="Company has revenue, detailed projections, and is growth/mature stage — DCF is most appropriate",
        ))
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=False,
            rationale="Revenue-based comparable multiples provide a cross-check",
        ))
        if has_round:
            recommendations.append(MethodRecommendation(
                method=MethodType.LAST_ROUND_ADJUSTED,
                is_primary=False,
                rationale="Prior round provides additional reference point",
            ))
        return recommendations

    # Case 2: Has revenue → Comps primary
    if has_revenue:
        recommendations.append(MethodRecommendation(
            method=MethodType.COMPS,
            is_primary=True,
            rationale="Company has revenue and sector benchmarks are available for comparable multiples",
        ))
        if has_round:
            recommendations.append(MethodRecommendation(
                method=MethodType.LAST_ROUND_ADJUSTED,
                is_primary=False,
                rationale="Prior round provides additional reference point",
            ))
        if has_projections:
            recommendations.append(MethodRecommendation(
                method=MethodType.DCF,
                is_primary=False,
                rationale="Projections available for DCF cross-check",
            ))
        return recommendations

    # Case 3: Pre-revenue with round → Last Round primary
    if has_round:
        recommendations.append(MethodRecommendation(
            method=MethodType.LAST_ROUND_ADJUSTED,
            is_primary=True,
            rationale="Pre-revenue company with prior funding round — last round adjusted is most reliable",
        ))
        return recommendations

    # Case 4: No revenue, no round → Manual review
    recommendations.append(MethodRecommendation(
        method=MethodType.MANUAL,
        is_primary=True,
        rationale="Insufficient data for automated valuation — manual review required",
    ))
    return recommendations
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_rules.py -v
# Expected: 6 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/valuation_engine/rules.py backend/tests/engine/test_rules.py
git commit -m "feat: implement method recommendation rules engine"
```

---

### Task 12: Confidence, Explanation, and Audit Trail

**Files:**
- Create: `backend/valuation_engine/confidence.py`
- Create: `backend/valuation_engine/explanation.py`
- Create: `backend/valuation_engine/audit_trail.py`
- Create: `backend/tests/engine/test_confidence.py`
- Create: `backend/tests/engine/test_explanation.py`

- [ ] **Step 1: Write the tests**

```python
# backend/tests/engine/test_confidence.py
from decimal import Decimal
from datetime import date

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, FundingRound,
    FinancialProjections, ProjectionPeriod, ConfidenceLevel, MethodType,
)
from valuation_engine.confidence import compute_completeness, compute_confidence


def test_minimal_input_completeness():
    company = CompanyInput(
        name="Test", stage=CompanyStage.SEED, sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    score = compute_completeness(company)
    assert 0.45 <= score <= 0.55  # name + stage + sector + revenue_status


def test_full_input_completeness():
    company = CompanyInput(
        name="Test", stage=CompanyStage.GROWTH, sector="b2b_saas",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("10000000"),
        last_round=FundingRound(date=date(2025, 1, 1), pre_money_valuation=Decimal("50000000"), amount_raised=Decimal("10000000")),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("15000000"), ebitda=Decimal("3000000")),
        ]),
        auditor_notes="Some notes",
    )
    score = compute_completeness(company)
    assert score >= 0.95


def test_high_confidence():
    assert compute_confidence(0.85, MethodType.COMPS) == ConfidenceLevel.HIGH


def test_medium_confidence():
    assert compute_confidence(0.60, MethodType.COMPS) == ConfidenceLevel.MEDIUM


def test_low_confidence_from_incomplete_data():
    assert compute_confidence(0.40, MethodType.COMPS) == ConfidenceLevel.LOW


def test_manual_method_always_low():
    assert compute_confidence(0.90, MethodType.MANUAL) == ConfidenceLevel.LOW
```

```python
# backend/tests/engine/test_explanation.py
from decimal import Decimal

from valuation_engine.models import MethodType, ConfidenceLevel
from valuation_engine.explanation import generate_explanation


def test_comps_explanation():
    text = generate_explanation(
        method=MethodType.COMPS,
        fair_value=Decimal("42000000"),
        sector="b2b_saas",
        confidence=ConfidenceLevel.MEDIUM,
        data_completeness=0.72,
        key_inputs={"revenue": "$3.4M", "multiple": "12.5x"},
    )
    assert "comparable" in text.lower() or "comps" in text.lower() or "multiple" in text.lower()
    assert "$42" in text or "42.0M" in text
    assert "medium" in text.lower() or "Medium" in text


def test_last_round_explanation():
    text = generate_explanation(
        method=MethodType.LAST_ROUND_ADJUSTED,
        fair_value=Decimal("40000000"),
        sector="ai_ml",
        confidence=ConfidenceLevel.MEDIUM,
        data_completeness=0.55,
        key_inputs={"post_money": "$40M", "months_elapsed": "8"},
    )
    assert "round" in text.lower() or "last" in text.lower()


def test_dcf_explanation():
    text = generate_explanation(
        method=MethodType.DCF,
        fair_value=Decimal("120000000"),
        sector="fintech",
        confidence=ConfidenceLevel.HIGH,
        data_completeness=0.90,
        key_inputs={"discount_rate": "22%", "projection_years": "5"},
    )
    assert "dcf" in text.lower() or "cash flow" in text.lower() or "discounted" in text.lower()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/engine/test_confidence.py tests/engine/test_explanation.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement confidence module**

```python
# backend/valuation_engine/confidence.py
from valuation_engine.models import CompanyInput, ConfidenceLevel, MethodType


def compute_completeness(company: CompanyInput) -> float:
    """Compute data completeness score (0.0–1.0) based on populated fields."""
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
```

- [ ] **Step 4: Implement explanation module**

```python
# backend/valuation_engine/explanation.py
from decimal import Decimal

from valuation_engine.models import MethodType, ConfidenceLevel


def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value:,.0f}"


def generate_explanation(
    method: MethodType,
    fair_value: Decimal,
    sector: str,
    confidence: ConfidenceLevel,
    data_completeness: float,
    key_inputs: dict[str, str],
) -> str:
    """Generate a plain English explanation of the valuation result."""
    value_str = _format_currency(fair_value)
    sector_display = sector.replace("_", " ").title()

    if method == MethodType.COMPS:
        revenue = key_inputs.get("revenue", "N/A")
        multiple = key_inputs.get("multiple", "N/A")
        return (
            f"Valued at {value_str} using public comparable company multiples. "
            f"Applied {sector_display} sector median revenue multiple of {multiple} "
            f"to current revenue of {revenue}, with adjustments for growth rate and stage. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.LAST_ROUND_ADJUSTED:
        post_money = key_inputs.get("post_money", "N/A")
        months = key_inputs.get("months_elapsed", "N/A")
        return (
            f"Valued at {value_str} based on the most recent funding round. "
            f"Starting from post-money valuation of {post_money} ({months} months ago), "
            f"adjusted for time elapsed and {sector_display} sector market conditions. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.DCF:
        discount_rate = key_inputs.get("discount_rate", "N/A")
        years = key_inputs.get("projection_years", "N/A")
        return (
            f"Valued at {value_str} using a discounted cash flow analysis. "
            f"Projected free cash flows over {years} years discounted at {discount_rate}, "
            f"plus terminal value. Sector: {sector_display}. "
            f"Confidence: {confidence.value} based on {data_completeness:.0%} data completeness."
        )

    if method == MethodType.MANUAL:
        return (
            f"Fair value of {value_str} determined by auditor manual assessment. "
            f"See justification in audit trail for detailed rationale. "
            f"Confidence: {confidence.value} (manual override)."
        )

    return f"Valued at {value_str}. Confidence: {confidence.value}."
```

- [ ] **Step 5: Implement audit trail builder**

```python
# backend/valuation_engine/audit_trail.py
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
    # Serialize company input — convert dataclass to dict, handling nested types
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_confidence.py tests/engine/test_explanation.py -v
# Expected: all passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/valuation_engine/confidence.py backend/valuation_engine/explanation.py backend/valuation_engine/audit_trail.py backend/tests/engine/test_confidence.py backend/tests/engine/test_explanation.py
git commit -m "feat: add confidence scoring, explanation generator, and audit trail builder"
```

---

### Task 13: Engine Orchestrator

**Files:**
- Create: `backend/valuation_engine/engine.py`
- Create: `backend/tests/engine/test_engine.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/engine/test_engine.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus, MethodType, ConfidenceLevel,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.engine import run_valuation


def test_pre_revenue_company():
    company = CompanyInput(
        name="Early AI",
        stage=CompanyStage.SEED,
        sector="ai_ml",
        revenue_status=RevenueStatus.PRE_REVENUE,
        last_round=FundingRound(
            date=date(2025, 6, 1),
            pre_money_valuation=Decimal("10000000"),
            amount_raised=Decimal("3000000"),
        ),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.LAST_ROUND_ADJUSTED
    assert result.fair_value > 0
    assert result.fair_value_low < result.fair_value < result.fair_value_high
    assert result.explanation != ""
    assert result.audit_trail is not None
    assert result.audit_trail.input_snapshot["name"] == "Early AI"
    assert len(result.method_results) >= 1


def test_revenue_company_with_comps():
    company = CompanyInput(
        name="SaaS Co",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="b2b_saas",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("5000000"),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.COMPS
    assert result.data_completeness > 0.5


def test_growth_company_with_dcf():
    company = CompanyInput(
        name="Growth Fintech",
        stage=CompanyStage.GROWTH,
        sector="fintech",
        revenue_status=RevenueStatus.MEANINGFUL_REVENUE,
        current_revenue=Decimal("20000000"),
        projections=FinancialProjections(periods=[
            ProjectionPeriod(year=2026, revenue=Decimal("30000000"), ebitda=Decimal("5000000")),
            ProjectionPeriod(year=2027, revenue=Decimal("42000000"), ebitda=Decimal("10000000")),
            ProjectionPeriod(year=2028, revenue=Decimal("55000000"), ebitda=Decimal("16000000")),
        ]),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.DCF
    assert len(result.method_results) >= 2  # DCF + Comps at minimum
    assert result.confidence in (ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM)


def test_no_data_falls_back_to_manual():
    company = CompanyInput(
        name="Mystery Co",
        stage=CompanyStage.PRE_SEED,
        sector="consumer_tech",
        revenue_status=RevenueStatus.PRE_REVENUE,
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    assert result.primary_method == MethodType.MANUAL
    assert result.fair_value == Decimal("0")
    assert result.confidence == ConfidenceLevel.LOW


def test_audit_trail_completeness():
    company = CompanyInput(
        name="Audit Test",
        stage=CompanyStage.SERIES_A_PLUS,
        sector="cybersecurity",
        revenue_status=RevenueStatus.EARLY_REVENUE,
        current_revenue=Decimal("8000000"),
        last_round=FundingRound(
            date=date(2025, 3, 1),
            pre_money_valuation=Decimal("40000000"),
            amount_raised=Decimal("10000000"),
        ),
    )
    result = run_valuation(company, valuation_date=date(2026, 1, 1))

    trail = result.audit_trail
    assert trail.input_snapshot is not None
    assert trail.method_selection_rationale != ""
    assert len(trail.recommendations) >= 1
    assert len(trail.method_results) >= 1
    assert trail.engine_version == "0.1.0"
    assert trail.timestamp is not None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/engine/test_engine.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement the orchestrator**

```python
# backend/valuation_engine/engine.py
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, ValuationResult, MethodType, MethodResult,
)
from valuation_engine.rules import recommend_methods
from valuation_engine.methods.last_round import LastRoundAdjusted
from valuation_engine.methods.comps import ComparableCompanyMultiples
from valuation_engine.methods.dcf import DiscountedCashFlow
from valuation_engine.confidence import compute_completeness, compute_confidence
from valuation_engine.explanation import generate_explanation
from valuation_engine.audit_trail import build_audit_trail


def run_valuation(company: CompanyInput, valuation_date: date | None = None) -> ValuationResult:
    """Run a complete valuation for a company. Returns result with full audit trail."""
    if valuation_date is None:
        valuation_date = date.today()

    # Step 1: Get method recommendations
    recommendations = recommend_methods(company)

    # Step 2: Run each recommended method
    method_results: list[MethodResult] = []

    for rec in recommendations:
        result = _run_method(rec.method, company, valuation_date)
        if result is not None:
            result.is_primary = rec.is_primary
            method_results.append(result)

    # Step 3: Determine primary result
    primary_results = [r for r in method_results if r.is_primary]
    if primary_results:
        primary = primary_results[0]
    elif method_results:
        primary = method_results[0]
        primary.is_primary = True
    else:
        # No methods could run — return zero with manual flag
        primary = MethodResult(
            method=MethodType.MANUAL,
            value=Decimal("0"),
            value_low=Decimal("0"),
            value_high=Decimal("0"),
            steps=[],
            assumptions=[],
            sources=[],
            is_primary=True,
        )
        method_results = [primary]

    # Step 4: Compute confidence and completeness
    completeness = compute_completeness(company)
    confidence = compute_confidence(completeness, primary.method)

    # Step 5: Build key inputs for explanation
    key_inputs = _extract_key_inputs(primary, company)

    # Step 6: Generate explanation
    explanation = generate_explanation(
        method=primary.method,
        fair_value=primary.value,
        sector=company.sector,
        confidence=confidence,
        data_completeness=completeness,
        key_inputs=key_inputs,
    )

    # Step 7: Build audit trail
    audit_trail = build_audit_trail(
        company=company,
        recommendations=recommendations,
        method_results=method_results,
    )

    return ValuationResult(
        primary_method=primary.method,
        fair_value=primary.value,
        fair_value_low=primary.value_low,
        fair_value_high=primary.value_high,
        confidence=confidence,
        data_completeness=completeness,
        explanation=explanation,
        method_results=method_results,
        audit_trail=audit_trail,
    )


def _run_method(method_type: MethodType, company: CompanyInput, valuation_date: date) -> MethodResult | None:
    """Run a single valuation method. Returns None if prerequisites aren't met."""
    if method_type == MethodType.LAST_ROUND_ADJUSTED:
        if company.last_round is None:
            return None
        return LastRoundAdjusted().compute(company, valuation_date)

    if method_type == MethodType.COMPS:
        if company.current_revenue is None or company.current_revenue <= 0:
            return None
        return ComparableCompanyMultiples().compute(company, valuation_date)

    if method_type == MethodType.DCF:
        if (
            company.projections is None
            or len(company.projections.periods) < 2
            or not any(p.ebitda and p.ebitda > 0 for p in company.projections.periods)
        ):
            return None
        return DiscountedCashFlow().compute(company, valuation_date)

    if method_type == MethodType.MANUAL:
        return None  # Manual is handled via override endpoint, not auto-run

    return None


def _extract_key_inputs(primary: MethodResult, company: CompanyInput) -> dict[str, str]:
    """Extract key inputs from method result for the explanation generator."""
    inputs: dict[str, str] = {}

    if primary.method == MethodType.COMPS:
        if company.current_revenue:
            if company.current_revenue >= 1_000_000:
                inputs["revenue"] = f"${company.current_revenue / 1_000_000:.1f}M"
            else:
                inputs["revenue"] = f"${company.current_revenue:,.0f}"
        for step in primary.steps:
            if "multiple" in step.description.lower() and "median" in step.output:
                inputs["multiple"] = step.output.replace(" (median)", "")
                break

    elif primary.method == MethodType.LAST_ROUND_ADJUSTED:
        for step in primary.steps:
            if "post-money" in step.description.lower():
                inputs["post_money"] = step.output
            if "time" in step.description.lower():
                inputs["months_elapsed"] = step.inputs.get("months_elapsed", "N/A")

    elif primary.method == MethodType.DCF:
        for assumption in primary.assumptions:
            if "discount" in assumption.name.lower():
                inputs["discount_rate"] = assumption.value
                break
        if company.projections:
            inputs["projection_years"] = str(len(company.projections.periods))

    return inputs
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/engine/test_engine.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Run full engine test suite**

```bash
cd backend && pytest tests/engine/ -v
# Expected: all passed (models, benchmarks, methods, rules, confidence, explanation, engine)
```

- [ ] **Step 6: Commit**

```bash
git add backend/valuation_engine/engine.py backend/tests/engine/test_engine.py
git commit -m "feat: implement valuation engine orchestrator"
```

---

## Phase 3: API Layer

### Task 14: API Schemas (Pydantic Models)

**Files:**
- Create: `backend/api/schemas.py`
- Create: `backend/api/routes/__init__.py`

- [ ] **Step 1: Create Pydantic request/response schemas**

```python
# backend/api/schemas.py
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
    confidence: str
    data_completeness: float
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
    confidence: str
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
```

```python
# backend/api/routes/__init__.py
# (empty)
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/schemas.py backend/api/routes/__init__.py
git commit -m "feat: add Pydantic API schemas for all endpoints"
```

---

### Task 15: Company and User API Routes

**Files:**
- Create: `backend/api/routes/users.py`
- Create: `backend/api/routes/companies.py`
- Modify: `backend/api/main.py`
- Create: `backend/tests/api/__init__.py`
- Create: `backend/tests/api/test_companies.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create test fixtures**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from db.session import Base, get_db
from api.main import app

# Use a separate test database on Postgres (models use JSONB which is Postgres-specific)
TEST_DATABASE_URL = "postgresql://vc_audit:vc_audit_dev@localhost:5432/vc_audit_test"

# Create the test database if it doesn't exist (connect to default db first)
_admin_engine = create_engine("postgresql://vc_audit:vc_audit_dev@localhost:5432/vc_audit", isolation_level="AUTOCOMMIT")
with _admin_engine.connect() as conn:
    exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = 'vc_audit_test'")).fetchone()
    if not exists:
        conn.execute(text("CREATE DATABASE vc_audit_test"))
_admin_engine.dispose()

test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session(setup_db):
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(setup_db):
    def override_get_db():
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Write the test**

```python
# backend/tests/api/test_companies.py
def test_create_user(client):
    resp = client.post("/api/v1/users", json={"name": "Alice", "email": "alice@audit.com"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice"


def test_list_users(client):
    client.post("/api/v1/users", json={"name": "Alice", "email": "alice@audit.com"})
    resp = client.get("/api/v1/users")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_create_company(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Acme Corp",
        "stage": "seed",
        "sector": "b2b_saas",
        "revenue_status": "pre_revenue",
        "created_by": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Acme Corp"
    assert data["id"] is not None


def test_create_company_with_round(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Beta Inc",
        "stage": "series_a_plus",
        "sector": "fintech",
        "revenue_status": "early_revenue",
        "current_revenue": "5000000",
        "last_round": {
            "date": "2025-06-01",
            "pre_money_valuation": "30000000",
            "amount_raised": "10000000",
            "lead_investor": "Sequoia",
        },
        "created_by": "Bob",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["last_round_valuation"] == "30000000.00"


def test_list_companies(client):
    client.post("/api/v1/companies", json={
        "name": "Co 1", "stage": "seed", "sector": "ai_ml",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    client.post("/api/v1/companies", json={
        "name": "Co 2", "stage": "growth", "sector": "fintech",
        "revenue_status": "meaningful_revenue", "created_by": "Alice",
    })
    resp = client.get("/api/v1/companies")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "b2b_saas",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.get(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme"


def test_update_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "b2b_saas",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.put(f"/api/v1/companies/{company_id}", json={"name": "Acme 2.0"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme 2.0"


def test_delete_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "b2b_saas",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.delete(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 204
    resp = client.get(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 404
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && pytest tests/api/test_companies.py -v
# Expected: 404s and failures
```

- [ ] **Step 4: Implement user routes**

```python
# backend/api/routes/users.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import User
from api.schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.name).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    user = User(name=body.name, email=body.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 5: Implement company routes**

```python
# backend/api/routes/companies.py
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
```

- [ ] **Step 6: Register routes in main app**

```python
# backend/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import companies, users

app = FastAPI(title="VC Audit Valuation Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(companies.router)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend && pytest tests/api/test_companies.py -v
# Expected: all passed
```

- [ ] **Step 8: Commit**

```bash
git add backend/api/ backend/tests/
git commit -m "feat: add Company CRUD and User API routes"
```

---

### Task 16: Valuation Service and API Routes

**Files:**
- Create: `backend/services/valuation_service.py`
- Create: `backend/api/routes/valuations.py`
- Create: `backend/tests/api/test_valuations.py`
- Modify: `backend/api/main.py` (add router)

- [ ] **Step 1: Write the test**

```python
# backend/tests/api/test_valuations.py

def _create_company(client, **overrides):
    defaults = {
        "name": "Test Co",
        "stage": "series_a_plus",
        "sector": "b2b_saas",
        "revenue_status": "early_revenue",
        "current_revenue": "5000000",
        "created_by": "Alice",
    }
    defaults.update(overrides)
    resp = client.post("/api/v1/companies", json=defaults)
    return resp.json()["id"]


def test_run_valuation(client):
    company_id = _create_company(client)
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={
        "created_by": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["primary_method"] == "comps"
    assert float(data["fair_value"]) > 0
    assert data["version"] == 1
    assert data["audit_trail"] is not None


def test_valuation_versioning(client):
    company_id = _create_company(client)
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    assert resp.json()["version"] == 2


def test_list_valuations_for_company(client):
    company_id = _create_company(client)
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Bob"})

    resp = client.get(f"/api/v1/companies/{company_id}/valuations")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_valuation_detail(client):
    company_id = _create_company(client)
    create_resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    val_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/valuations/{val_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "method_results" in data
    assert "audit_trail" in data


def test_override_valuation(client):
    company_id = _create_company(client)
    create_resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    val_id = create_resp.json()["id"]

    resp = client.post(f"/api/v1/valuations/{val_id}/override", json={
        "fair_value": "60000000",
        "justification": "Recent comparable transaction at higher multiple",
        "created_by": "Alice",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["fair_value"] == "60000000.00"
    assert data["overrides"] is not None


def test_pre_revenue_valuation(client):
    company_id = _create_company(
        client,
        name="Pre Rev",
        stage="seed",
        revenue_status="pre_revenue",
        current_revenue=None,
        last_round={
            "date": "2025-06-01",
            "pre_money_valuation": "10000000",
            "amount_raised": "3000000",
        },
    )
    # Remove current_revenue key since it's pre-revenue
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    assert resp.status_code == 201
    assert resp.json()["primary_method"] == "last_round_adjusted"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/api/test_valuations.py -v
# Expected: 404
```

- [ ] **Step 3: Implement valuation service**

```python
# backend/services/valuation_service.py
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
        # Convert Decimals and dates
        serialized.append(_make_json_safe(d))
    return serialized


def _serialize_audit_trail(trail) -> dict:
    d = dataclasses.asdict(trail)
    # Convert enums in recommendations
    for rec in d.get("recommendations", []):
        if hasattr(rec.get("method"), "value"):
            rec["method"] = rec["method"].value
    # Convert enums in method_results
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

    # Determine version number
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
        confidence=result.confidence.value,
        data_completeness=result.data_completeness,
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
```

- [ ] **Step 4: Implement valuation routes**

```python
# backend/api/routes/valuations.py
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
```

- [ ] **Step 5: Register routes in main app**

Add to `backend/api/main.py`:

```python
from api.routes import companies, users, valuations

# ... existing code ...
app.include_router(valuations.router)
```

- [ ] **Step 6: Run tests**

```bash
cd backend && pytest tests/api/test_valuations.py -v
# Expected: all passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/services/valuation_service.py backend/api/routes/valuations.py backend/api/main.py backend/tests/api/test_valuations.py
git commit -m "feat: add valuation service and API routes with full audit trail"
```

---

### Task 17: Benchmark and Export API Routes

**Files:**
- Create: `backend/api/routes/benchmarks.py`
- Create: `backend/services/export_service.py`
- Create: `backend/api/routes/exports.py`
- Create: `backend/tests/api/test_exports.py`
- Modify: `backend/api/main.py`

- [ ] **Step 1: Implement benchmark routes**

```python
# backend/api/routes/benchmarks.py
import json
from pathlib import Path
from fastapi import APIRouter, Body
from api.schemas import BenchmarkOut, BenchmarkSector
from valuation_engine.benchmarks.loader import load_benchmarks, list_sectors, clear_cache, _DATA_DIR

router = APIRouter(prefix="/api/v1/benchmarks", tags=["benchmarks"])


@router.get("", response_model=BenchmarkOut)
def get_benchmarks():
    return load_benchmarks()


@router.get("/sectors", response_model=list[BenchmarkSector])
def get_sectors():
    return list_sectors()


@router.put("")
def upload_benchmarks(data: dict = Body(...)):
    """Upload new benchmark data. Expects full benchmark JSON with metadata.version field."""
    version = data.get("metadata", {}).get("version", "unknown")
    path = _DATA_DIR / f"benchmarks-{version}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    clear_cache()
    return {"status": "ok", "version": version, "path": str(path)}
```

- [ ] **Step 2: Implement export service**

```python
# backend/services/export_service.py
import io
import json
from decimal import Decimal

from openpyxl import Workbook

from db.models import Valuation, Company


def export_json(valuation: Valuation, company: Company) -> dict:
    """Export valuation as a JSON-serializable dict."""
    return {
        "company": {
            "name": company.name,
            "stage": company.stage,
            "sector": company.sector,
            "revenue_status": company.revenue_status,
        },
        "valuation": {
            "id": str(valuation.id),
            "version": valuation.version,
            "primary_method": valuation.primary_method,
            "fair_value": str(valuation.fair_value),
            "fair_value_low": str(valuation.fair_value_low),
            "fair_value_high": str(valuation.fair_value_high),
            "confidence": valuation.confidence,
            "data_completeness": valuation.data_completeness,
            "explanation": valuation.explanation,
            "method_results": valuation.method_results,
            "audit_trail": valuation.audit_trail,
            "overrides": valuation.overrides,
            "created_by": valuation.created_by,
            "created_at": valuation.created_at.isoformat(),
        },
    }


def export_xlsx(valuation: Valuation, company: Company) -> bytes:
    """Export valuation as an Excel workbook."""
    wb = Workbook()

    # Sheet 1: Summary
    ws = wb.active
    ws.title = "Summary"
    summary_rows = [
        ("Company", company.name),
        ("Stage", company.stage),
        ("Sector", company.sector),
        ("Revenue Status", company.revenue_status),
        ("", ""),
        ("Fair Value", float(valuation.fair_value)),
        ("Fair Value (Low)", float(valuation.fair_value_low)),
        ("Fair Value (High)", float(valuation.fair_value_high)),
        ("Primary Method", valuation.primary_method),
        ("Confidence", valuation.confidence),
        ("Data Completeness", f"{valuation.data_completeness:.0%}"),
        ("", ""),
        ("Explanation", valuation.explanation),
        ("", ""),
        ("Created By", valuation.created_by),
        ("Created At", valuation.created_at.isoformat()),
        ("Version", valuation.version),
    ]
    for row in summary_rows:
        ws.append(row)
    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 60

    # Sheet 2: Method Details
    ws2 = wb.create_sheet("Method Details")
    ws2.append(["Method", "Step", "Formula", "Inputs", "Output"])
    for mr in valuation.method_results:
        method_name = mr.get("method", "")
        for step in mr.get("steps", []):
            ws2.append([
                method_name,
                step.get("description", ""),
                step.get("formula", ""),
                json.dumps(step.get("inputs", {})),
                step.get("output", ""),
            ])

    # Sheet 3: Assumptions
    ws3 = wb.create_sheet("Assumptions")
    ws3.append(["Method", "Assumption", "Value", "Rationale", "Source", "Overrideable"])
    for mr in valuation.method_results:
        method_name = mr.get("method", "")
        for a in mr.get("assumptions", []):
            ws3.append([
                method_name,
                a.get("name", ""),
                a.get("value", ""),
                a.get("rationale", ""),
                a.get("source", ""),
                str(a.get("overrideable", True)),
            ])

    # Sheet 4: Audit Trail
    ws4 = wb.create_sheet("Audit Trail")
    trail = valuation.audit_trail or {}
    ws4.append(["Field", "Value"])
    ws4.append(["Method Selection Rationale", trail.get("method_selection_rationale", "")])
    ws4.append(["Benchmark Version", trail.get("benchmark_version", "")])
    ws4.append(["Engine Version", trail.get("engine_version", "")])
    ws4.append(["Timestamp", trail.get("timestamp", "")])
    ws4.append(["", ""])
    ws4.append(["Input Snapshot", ""])
    for key, val in trail.get("input_snapshot", {}).items():
        ws4.append([key, str(val) if val is not None else ""])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
```

- [ ] **Step 3: Implement export routes**

```python
# backend/api/routes/exports.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Valuation, Company
from services.export_service import export_json, export_xlsx

router = APIRouter(prefix="/api/v1/valuations", tags=["exports"])


@router.get("/{valuation_id}/export/json")
def export_as_json(valuation_id: UUID, db: Session = Depends(get_db)):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    company = db.query(Company).filter(Company.id == valuation.company_id).first()
    return export_json(valuation, company)


@router.get("/{valuation_id}/export/xlsx")
def export_as_xlsx(valuation_id: UUID, db: Session = Depends(get_db)):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    company = db.query(Company).filter(Company.id == valuation.company_id).first()
    content = export_xlsx(valuation, company)
    filename = f"valuation-{company.name.replace(' ', '_')}-v{valuation.version}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{valuation_id}/export/pdf")
def export_as_pdf(valuation_id: UUID, db: Session = Depends(get_db)):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    company = db.query(Company).filter(Company.id == valuation.company_id).first()

    # Build HTML report, then convert to PDF
    html = _build_pdf_html(valuation, company)
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
    except Exception:
        raise HTTPException(status_code=500, detail="PDF generation failed — ensure WeasyPrint dependencies are installed")

    filename = f"valuation-{company.name.replace(' ', '_')}-v{valuation.version}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf_html(valuation, company) -> str:
    trail = valuation.audit_trail or {}
    methods_html = ""
    for mr in valuation.method_results:
        steps_html = ""
        for step in mr.get("steps", []):
            inputs_str = ", ".join(f"{k}: {v}" for k, v in step.get("inputs", {}).items())
            steps_html += f"<tr><td>{step['description']}</td><td>{step['formula']}</td><td>{inputs_str}</td><td>{step['output']}</td></tr>"
        methods_html += f"""
        <h3>{mr['method'].replace('_', ' ').title()}{' (Primary)' if mr.get('is_primary') else ''}</h3>
        <table><tr><th>Step</th><th>Formula</th><th>Inputs</th><th>Output</th></tr>{steps_html}</table>
        """

    return f"""
    <html>
    <head><style>
        body {{ font-family: Inter, Helvetica, Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }}
        h1 {{ color: #1a1a2e; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }}
        h2 {{ color: #475569; margin-top: 24px; }}
        h3 {{ color: #4f46e5; }}
        table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }}
        th {{ background: #f8fafc; font-weight: 600; }}
        .value {{ font-size: 28px; font-weight: 700; color: #4f46e5; }}
        .meta {{ color: #64748b; font-size: 11px; }}
    </style></head>
    <body>
        <h1>Valuation Report — {company.name}</h1>
        <p class="meta">Version {valuation.version} | {valuation.created_at.strftime('%Y-%m-%d %H:%M')} | By {valuation.created_by}</p>

        <h2>Summary</h2>
        <p class="value">${valuation.fair_value:,.0f}</p>
        <p>Range: ${valuation.fair_value_low:,.0f} – ${valuation.fair_value_high:,.0f}</p>
        <p>Method: {valuation.primary_method.replace('_', ' ').title()} | Confidence: {valuation.confidence.title()} | Data Completeness: {valuation.data_completeness:.0%}</p>
        <p>{valuation.explanation}</p>

        <h2>Methodology</h2>
        {methods_html}

        <h2>Audit Trail</h2>
        <p><strong>Method Selection:</strong> {trail.get('method_selection_rationale', 'N/A')}</p>
        <p><strong>Benchmark Version:</strong> {trail.get('benchmark_version', 'N/A')}</p>
        <p><strong>Engine Version:</strong> {trail.get('engine_version', 'N/A')}</p>

        <h3>Input Snapshot</h3>
        <table>
        {"".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in trail.get('input_snapshot', {}).items())}
        </table>
    </body>
    </html>
    """
```

- [ ] **Step 4: Register routes and write test**

Add to `backend/api/main.py`:
```python
from api.routes import companies, users, valuations, benchmarks, exports

# ... existing code ...
app.include_router(benchmarks.router)
app.include_router(exports.router)
```

```python
# backend/tests/api/test_exports.py

def _setup_valuation(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Export Test Co",
        "stage": "series_a_plus",
        "sector": "b2b_saas",
        "revenue_status": "early_revenue",
        "current_revenue": "5000000",
        "created_by": "Alice",
    })
    company_id = resp.json()["id"]
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    return resp.json()["id"]


def test_export_json(client):
    val_id = _setup_valuation(client)
    resp = client.get(f"/api/v1/valuations/{val_id}/export/json")
    assert resp.status_code == 200
    data = resp.json()
    assert "company" in data
    assert "valuation" in data
    assert data["company"]["name"] == "Export Test Co"


def test_export_xlsx(client):
    val_id = _setup_valuation(client)
    resp = client.get(f"/api/v1/valuations/{val_id}/export/xlsx")
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers["content-type"]


def test_get_benchmarks(client):
    resp = client.get("/api/v1/benchmarks")
    assert resp.status_code == 200
    data = resp.json()
    assert "sectors" in data
    assert "b2b_saas" in data["sectors"]


def test_get_sectors(client):
    resp = client.get("/api/v1/benchmarks/sectors")
    assert resp.status_code == 200
    sectors = resp.json()
    assert len(sectors) == 10
    assert any(s["key"] == "b2b_saas" for s in sectors)
```

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest tests/api/ -v
# Expected: all passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/benchmarks.py backend/api/routes/exports.py backend/services/export_service.py backend/api/main.py backend/tests/api/test_exports.py
git commit -m "feat: add benchmark, export API routes (JSON, Excel, PDF)"
```

---

## Phase 4: Frontend

### Task 18: TypeScript Types and API Client

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create TypeScript types**

```typescript
// frontend/src/types/index.ts

export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface FundingRound {
  date: string
  pre_money_valuation: string
  amount_raised: string
  lead_investor?: string
}

export interface ProjectionPeriod {
  year: number
  revenue: string
  ebitda?: string
  growth_rate?: number
}

export interface FinancialProjections {
  periods: ProjectionPeriod[]
  discount_rate?: number
}

export interface CompanyCreate {
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue?: string
  last_round?: FundingRound
  projections?: FinancialProjections
  auditor_notes?: string
  created_by: string
}

export interface Company {
  id: string
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue?: string
  last_round_date?: string
  last_round_valuation?: string
  last_round_amount?: string
  last_round_investor?: string
  projections?: Record<string, unknown>
  auditor_notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CompanyListItem {
  id: string
  name: string
  stage: string
  sector: string
  revenue_status: string
  created_at: string
  latest_valuation?: string
  latest_method?: string
}

export interface ComputationStep {
  description: string
  formula: string
  inputs: Record<string, string>
  output: string
}

export interface Assumption {
  name: string
  value: string
  rationale: string
  source?: string
  overrideable: boolean
}

export interface MethodResult {
  method: string
  value: string
  value_low: string
  value_high: string
  steps: ComputationStep[]
  assumptions: Assumption[]
  sources: { name: string; version: string; effective_date: string }[]
  is_primary: boolean
}

export interface AuditTrail {
  input_snapshot: Record<string, unknown>
  method_selection_rationale: string
  recommendations: { method: string; is_primary: boolean; rationale: string }[]
  method_results: MethodResult[]
  overrides: Record<string, unknown>[]
  benchmark_version?: string
  engine_version: string
  timestamp: string
}

export interface Valuation {
  id: string
  company_id: string
  version: number
  primary_method: string
  fair_value: string
  fair_value_low: string
  fair_value_high: string
  confidence: string
  data_completeness: number
  explanation: string
  method_results: MethodResult[]
  audit_trail: AuditTrail
  overrides?: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface ValuationListItem {
  id: string
  version: number
  primary_method: string
  fair_value: string
  confidence: string
  created_by: string
  created_at: string
}

export interface BenchmarkSector {
  key: string
  display_name: string
}

export const STAGES = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a_plus', label: 'Series A+' },
  { value: 'growth', label: 'Growth' },
  { value: 'mature_private', label: 'Mature Private' },
] as const

export const REVENUE_STATUSES = [
  { value: 'pre_revenue', label: 'Pre-Revenue' },
  { value: 'early_revenue', label: 'Early Revenue' },
  { value: 'meaningful_revenue', label: 'Meaningful Revenue' },
] as const
```

- [ ] **Step 2: Create API client**

```typescript
// frontend/src/api/client.ts
import type {
  User, Company, CompanyCreate, CompanyListItem,
  Valuation, ValuationListItem, BenchmarkSector,
} from '../types'

const BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error ${resp.status}: ${body}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

// Users
export const listUsers = () => request<User[]>('/users')
export const createUser = (data: { name: string; email: string }) =>
  request<User>('/users', { method: 'POST', body: JSON.stringify(data) })

// Companies
export const listCompanies = () => request<CompanyListItem[]>('/companies')
export const getCompany = (id: string) => request<Company>(`/companies/${id}`)
export const createCompany = (data: CompanyCreate) =>
  request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) })
export const updateCompany = (id: string, data: Partial<CompanyCreate>) =>
  request<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCompany = (id: string) =>
  request<void>(`/companies/${id}`, { method: 'DELETE' })

// Valuations
export const runValuation = (companyId: string, data: { created_by: string; valuation_date?: string }) =>
  request<Valuation>(`/companies/${companyId}/valuations`, { method: 'POST', body: JSON.stringify(data) })
export const listValuations = (companyId: string) =>
  request<ValuationListItem[]>(`/companies/${companyId}/valuations`)
export const getValuation = (id: string) => request<Valuation>(`/valuations/${id}`)
export const overrideValuation = (id: string, data: { fair_value: string; justification: string; created_by: string }) =>
  request<Valuation>(`/valuations/${id}/override`, { method: 'POST', body: JSON.stringify(data) })

// Exports
export const exportJsonUrl = (id: string) => `${BASE}/valuations/${id}/export/json`
export const exportXlsxUrl = (id: string) => `${BASE}/valuations/${id}/export/xlsx`
export const exportPdfUrl = (id: string) => `${BASE}/valuations/${id}/export/pdf`

// Benchmarks
export const listSectors = () => request<BenchmarkSector[]>('/benchmarks/sectors')
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/ frontend/src/api/
git commit -m "feat: add TypeScript types and API client"
```

---

### Task 19: Layout and Dashboard Page

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx` (replace placeholder)
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Layout component**

```tsx
// frontend/src/components/Layout.tsx
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState(() =>
    localStorage.getItem('vc-audit-user') || 'Auditor'
  )

  useEffect(() => {
    localStorage.setItem('vc-audit-user', currentUser)
  }, [currentUser])

  return (
    <div className="min-h-screen bg-[var(--color-surface-secondary)]">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
              VC Audit
            </Link>
            <nav className="flex gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/valuations/new"
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              + New Valuation
            </Link>
            <div className="flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface-tertiary)] flex items-center justify-center text-xs font-medium text-[var(--color-text-secondary)]">
                {currentUser.charAt(0).toUpperCase()}
              </div>
              <input
                type="text"
                value={currentUser}
                onChange={e => setCurrentUser(e.target.value)}
                className="text-sm text-[var(--color-text-secondary)] bg-transparent border-none outline-none w-24 focus:text-[var(--color-text-primary)]"
                placeholder="Your name"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create Dashboard page**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies } from '../api/client'
import type { CompanyListItem } from '../types'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
  dcf: 'DCF',
  manual: 'Manual',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-red-50 text-red-700',
}

function formatCurrency(value: string | undefined): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

export default function Dashboard() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    listCompanies().then(setCompanies).finally(() => setLoading(false))
  }, [])

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Valuations</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent w-56"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-12 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-[var(--color-text-secondary)] mb-4">
            {search ? 'No companies match your search.' : 'No valuations yet.'}
          </p>
          {!search && (
            <Link
              to="/valuations/new"
              className="inline-flex px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Create your first valuation
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Company</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Stage</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Sector</th>
                <th className="text-right text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Fair Value</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(company => (
                <tr key={company.id} className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-surface-secondary)] transition-colors">
                  <td className="px-5 py-3.5">
                    <Link to={`/companies/${company.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.sector.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-right text-[var(--color-text-primary)]">
                    {formatCurrency(company.latest_valuation)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.latest_method ? METHOD_LABELS[company.latest_method] || company.latest_method : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx to use Layout and real pages**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-[var(--color-text-tertiary)] text-lg">{name} — coming soon</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/valuations/new" element={<Placeholder name="New Valuation" />} />
          <Route path="/valuations/:id" element={<Placeholder name="Valuation Results" />} />
          <Route path="/companies/:id" element={<Placeholder name="Company History" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Verify in browser**

Start backend and frontend:
```bash
cd backend && source .venv/bin/activate && uvicorn api.main:app --reload --port 8000 &
cd frontend && npm run dev
# Visit http://localhost:5173 — should show empty dashboard with "Create your first valuation" CTA
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Layout shell and Dashboard page"
```

---

### Task 20: New Valuation Multi-Step Form

**Files:**
- Create: `frontend/src/pages/NewValuation.tsx`
- Modify: `frontend/src/App.tsx` (import real page)

This is the largest frontend component. It's a multi-step wizard: Company Basics → Funding History (conditional) → Financials (conditional) → Notes → Review & Submit.

- [ ] **Step 1: Implement the guided form**

```tsx
// frontend/src/pages/NewValuation.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createCompany, runValuation, listSectors } from '../api/client'
import { STAGES, REVENUE_STATUSES } from '../types'
import type { BenchmarkSector } from '../types'

interface FormData {
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue: string
  last_round_date: string
  last_round_valuation: string
  last_round_amount: string
  last_round_investor: string
  projection_years: { year: number; revenue: string; ebitda: string; growth_rate: string }[]
  auditor_notes: string
}

const STEPS = ['Company Basics', 'Funding History', 'Financials', 'Notes', 'Review']

export default function NewValuation() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { register, watch, handleSubmit, setValue, getValues } = useForm<FormData>({
    defaultValues: {
      stage: 'seed',
      revenue_status: 'pre_revenue',
      projection_years: [
        { year: new Date().getFullYear() + 1, revenue: '', ebitda: '', growth_rate: '' },
        { year: new Date().getFullYear() + 2, revenue: '', ebitda: '', growth_rate: '' },
        { year: new Date().getFullYear() + 3, revenue: '', ebitda: '', growth_rate: '' },
      ],
    },
  })

  const revenueStatus = watch('revenue_status')
  const stage = watch('stage')
  const isPreRevenue = revenueStatus === 'pre_revenue'
  const showProjections = !isPreRevenue && ['growth', 'mature_private'].includes(stage)

  useEffect(() => {
    listSectors().then(setSectors)
  }, [])

  // Filter steps based on data
  const activeSteps = STEPS.filter((s, i) => {
    if (i === 1) return true // Always show funding history as optional
    if (i === 2) return !isPreRevenue // Skip financials for pre-revenue
    return true
  })

  const currentStepName = activeSteps[step]
  const isLastStep = step === activeSteps.length - 1
  const progress = ((step + 1) / activeSteps.length) * 100

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const hasRound = data.last_round_date && data.last_round_valuation
      const hasProjections = showProjections && data.projection_years.some(p => p.revenue)

      const company = await createCompany({
        name: data.name,
        stage: data.stage,
        sector: data.sector,
        revenue_status: data.revenue_status,
        current_revenue: !isPreRevenue && data.current_revenue ? data.current_revenue : undefined,
        last_round: hasRound ? {
          date: data.last_round_date,
          pre_money_valuation: data.last_round_valuation,
          amount_raised: data.last_round_amount || '0',
          lead_investor: data.last_round_investor || undefined,
        } : undefined,
        projections: hasProjections ? {
          periods: data.projection_years
            .filter(p => p.revenue)
            .map(p => ({
              year: p.year,
              revenue: p.revenue,
              ebitda: p.ebitda || undefined,
              growth_rate: p.growth_rate ? parseFloat(p.growth_rate) / 100 : undefined,
            })),
        } : undefined,
        auditor_notes: data.auditor_notes || undefined,
        created_by: user,
      })

      const valuation = await runValuation(company.id, { created_by: user })
      navigate(`/valuations/${valuation.id}`)
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
  const sectionClass = "space-y-5"

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">New Valuation</h1>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-6">Enter company details to generate a valuation.</p>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {activeSteps.map((s, i) => (
            <button
              key={s}
              onClick={() => i < step && setStep(i)}
              className={`text-xs font-medium transition-colors ${
                i === step ? 'text-[var(--color-primary)]' :
                i < step ? 'text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary)]' :
                'text-[var(--color-text-tertiary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="h-1 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6" style={{ boxShadow: 'var(--shadow-md)' }}>

          {/* Step: Company Basics */}
          {currentStepName === 'Company Basics' && (
            <div className={sectionClass}>
              <div>
                <label className={labelClass}>Company Name</label>
                <input {...register('name', { required: true })} className={inputClass} placeholder="e.g., Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Stage</label>
                  <select {...register('stage')} className={inputClass}>
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Sector</label>
                  <select {...register('sector')} className={inputClass}>
                    {sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Revenue Status</label>
                <div className="flex gap-2">
                  {REVENUE_STATUSES.map(rs => (
                    <label
                      key={rs.value}
                      className={`flex-1 px-3 py-2 rounded-lg border text-center text-sm cursor-pointer transition-all ${
                        revenueStatus === rs.value
                          ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)] font-medium'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)]'
                      }`}
                    >
                      <input type="radio" {...register('revenue_status')} value={rs.value} className="sr-only" />
                      {rs.label}
                    </label>
                  ))}
                </div>
              </div>
              {!isPreRevenue && (
                <div>
                  <label className={labelClass}>Current Annual Revenue ($)</label>
                  <input {...register('current_revenue')} className={inputClass} placeholder="e.g., 5000000" type="number" />
                </div>
              )}
            </div>
          )}

          {/* Step: Funding History */}
          {currentStepName === 'Funding History' && (
            <div className={sectionClass}>
              <p className="text-sm text-[var(--color-text-tertiary)]">Optional — enter details from the most recent funding round.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Round Date</label>
                  <input {...register('last_round_date')} className={inputClass} type="date" />
                </div>
                <div>
                  <label className={labelClass}>Lead Investor</label>
                  <input {...register('last_round_investor')} className={inputClass} placeholder="e.g., Sequoia" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Pre-Money Valuation ($)</label>
                  <input {...register('last_round_valuation')} className={inputClass} placeholder="e.g., 30000000" type="number" />
                </div>
                <div>
                  <label className={labelClass}>Amount Raised ($)</label>
                  <input {...register('last_round_amount')} className={inputClass} placeholder="e.g., 10000000" type="number" />
                </div>
              </div>
            </div>
          )}

          {/* Step: Financials */}
          {currentStepName === 'Financials' && (
            <div className={sectionClass}>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {showProjections
                  ? 'Enter financial projections for DCF analysis.'
                  : 'Revenue data will be used for comparable company valuation.'}
              </p>
              {showProjections && (
                <div>
                  <label className={labelClass}>Projected Financials</label>
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="grid grid-cols-4 gap-3">
                        <input
                          {...register(`projection_years.${i}.year` as const, { valueAsNumber: true })}
                          className={inputClass}
                          placeholder="Year"
                          type="number"
                        />
                        <input
                          {...register(`projection_years.${i}.revenue` as const)}
                          className={inputClass}
                          placeholder="Revenue ($)"
                          type="number"
                        />
                        <input
                          {...register(`projection_years.${i}.ebitda` as const)}
                          className={inputClass}
                          placeholder="EBITDA ($)"
                          type="number"
                        />
                        <input
                          {...register(`projection_years.${i}.growth_rate` as const)}
                          className={inputClass}
                          placeholder="Growth %"
                          type="number"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Notes */}
          {currentStepName === 'Notes' && (
            <div className={sectionClass}>
              <div>
                <label className={labelClass}>Auditor Notes (optional)</label>
                <textarea
                  {...register('auditor_notes')}
                  className={`${inputClass} h-32 resize-none`}
                  placeholder="Any additional context, observations, or supporting information..."
                />
              </div>
            </div>
          )}

          {/* Step: Review */}
          {currentStepName === 'Review' && (
            <div className={sectionClass}>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Review your inputs</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                  <span className="text-[var(--color-text-tertiary)]">Company</span>
                  <span className="font-medium">{watch('name')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                  <span className="text-[var(--color-text-tertiary)]">Stage</span>
                  <span>{STAGES.find(s => s.value === watch('stage'))?.label}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                  <span className="text-[var(--color-text-tertiary)]">Sector</span>
                  <span>{sectors.find(s => s.key === watch('sector'))?.display_name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                  <span className="text-[var(--color-text-tertiary)]">Revenue Status</span>
                  <span>{REVENUE_STATUSES.find(r => r.value === revenueStatus)?.label}</span>
                </div>
                {watch('current_revenue') && (
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                    <span className="text-[var(--color-text-tertiary)]">Revenue</span>
                    <span>${Number(watch('current_revenue')).toLocaleString()}</span>
                  </div>
                )}
                {watch('last_round_date') && (
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]">
                    <span className="text-[var(--color-text-tertiary)]">Last Round</span>
                    <span>${Number(watch('last_round_valuation')).toLocaleString()} pre-money on {watch('last_round_date')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              step === 0
                ? 'invisible'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)]'
            }`}
          >
            Back
          </button>
          {isLastStep ? (
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Running valuation...' : 'Run Valuation'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(activeSteps.length - 1, s + 1))}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx imports**

Replace the NewValuation placeholder in `frontend/src/App.tsx`:

```tsx
import NewValuation from './pages/NewValuation'

// In Routes:
<Route path="/valuations/new" element={<NewValuation />} />
```

- [ ] **Step 3: Test in browser**

```bash
# With backend + frontend running:
# Visit http://localhost:5173/valuations/new
# Walk through the form steps, verify conditional rendering
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add multi-step New Valuation guided form"
```

---

### Task 21: Visualization Components

**Files:**
- Create: `frontend/src/components/RangeBar.tsx`
- Create: `frontend/src/components/MethodComparisonChart.tsx`
- Create: `frontend/src/components/WaterfallChart.tsx`
- Create: `frontend/src/components/ConfidenceIndicator.tsx`
- Create: `frontend/src/components/CompletenessRing.tsx`
- Create: `frontend/src/components/ValueTrendLine.tsx`
- Create: `frontend/src/components/ExportMenu.tsx`

- [ ] **Step 1: Create all visualization components**

```tsx
// frontend/src/components/RangeBar.tsx
interface RangeBarProps {
  low: number
  mid: number
  high: number
}

export default function RangeBar({ low, mid, high }: RangeBarProps) {
  const range = high - low
  const midPos = range > 0 ? ((mid - low) / range) * 100 : 50
  const formatVal = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }

  return (
    <div className="w-full">
      <div className="relative h-2.5 bg-[var(--color-surface-tertiary)] rounded-full">
        <div
          className="absolute h-full bg-gradient-to-r from-indigo-300 to-indigo-400 rounded-full"
          style={{ left: '5%', right: '5%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[var(--color-primary)] rounded-full border-2 border-white shadow-md"
          style={{ left: `${5 + midPos * 0.9}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-[var(--color-text-tertiary)]">
        <span>{formatVal(low)}</span>
        <span>{formatVal(high)}</span>
      </div>
    </div>
  )
}
```

```tsx
// frontend/src/components/MethodComparisonChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { MethodResult } from '../types'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
  dcf: 'DCF',
  manual: 'Manual',
}

const COLORS = ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe']

interface Props {
  results: MethodResult[]
}

export default function MethodComparisonChart({ results }: Props) {
  if (results.length < 2) return null

  const data = results.map(r => ({
    name: METHOD_LABELS[r.method] || r.method,
    value: parseFloat(r.value),
    low: parseFloat(r.value_low),
    high: parseFloat(r.value_high),
    is_primary: r.is_primary,
  }))

  const formatTick = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
    return `$${(v / 1e3).toFixed(0)}K`
  }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} width={80} />
          <Tooltip
            formatter={(v: number) => formatTick(v)}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

```tsx
// frontend/src/components/WaterfallChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { ComputationStep } from '../types'

interface Props {
  steps: ComputationStep[]
  finalValue: number
}

export default function WaterfallChart({ steps, finalValue }: Props) {
  if (steps.length < 2) return null

  // Build waterfall data: each step shows an adjustment from previous
  const data: { name: string; value: number; fill: string }[] = []
  let running = 0

  for (const step of steps) {
    // Try to parse the output as a number
    const raw = step.output.replace(/[^0-9.-]/g, '')
    const val = parseFloat(raw)
    if (isNaN(val)) continue

    // Scale to millions for display
    const scaled = val >= 1e6 ? val / 1e6 : val
    const delta = scaled - running

    data.push({
      name: step.description.length > 25 ? step.description.slice(0, 25) + '...' : step.description,
      value: delta,
      fill: delta >= 0 ? '#4f46e5' : '#ef4444',
    })
    running = scaled
  }

  if (data.length < 2) return null

  const formatTick = (v: number) => `$${v.toFixed(0)}M`

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 10, right: 20 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            formatter={(v: number) => `$${v.toFixed(1)}M`}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

```tsx
// frontend/src/components/ValueTrendLine.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ValuationListItem } from '../types'

interface Props {
  valuations: ValuationListItem[]
}

export default function ValueTrendLine({ valuations }: Props) {
  if (valuations.length < 2) return null

  // Sort by version ascending for chronological display
  const sorted = [...valuations].sort((a, b) => a.version - b.version)
  const data = sorted.map(v => ({
    name: `v${v.version}`,
    value: parseFloat(v.fair_value),
    date: new Date(v.created_at).toLocaleDateString(),
  }))

  const formatTick = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
    return `$${(v / 1e3).toFixed(0)}K`
  }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            formatter={(v: number) => formatTick(v)}
            labelFormatter={(label: string, payload: any[]) => payload[0]?.payload?.date || label}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ fill: '#4f46e5', r: 4 }}
            activeDot={{ fill: '#4f46e5', r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

```tsx
// frontend/src/components/ConfidenceIndicator.tsx
interface Props {
  level: string
}

const CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'High' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-red-50', text: 'text-red-700', label: 'Low' },
}

export default function ConfidenceIndicator({ level }: Props) {
  const c = CONFIG[level] || CONFIG.low
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
```

```tsx
// frontend/src/components/CompletenessRing.tsx
interface Props {
  value: number // 0–1
  size?: number
}

export default function CompletenessRing({ value, size = 48 }: Props) {
  const pct = Math.round(value * 100)
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value)

  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{pct}%</span>
    </div>
  )
}
```

```tsx
// frontend/src/components/ExportMenu.tsx
import { useState, useRef, useEffect } from 'react'
import { exportPdfUrl, exportXlsxUrl, exportJsonUrl } from '../api/client'

interface Props {
  valuationId: string
}

export default function ExportMenu({ valuationId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { label: 'Export PDF', href: exportPdfUrl(valuationId) },
    { label: 'Export Excel', href: exportXlsxUrl(valuationId) },
    { label: 'Export JSON', href: exportJsonUrl(valuationId) },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3.5 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
      >
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] py-1 z-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {items.map(item => (
            <a
              key={item.label}
              href={item.href}
              className="block px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add visualization components (RangeBar, charts, indicators, export)"
```

---

### Task 22: Valuation Results Page

**Files:**
- Create: `frontend/src/pages/ValuationResults.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement the results page**

```tsx
// frontend/src/pages/ValuationResults.tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getValuation } from '../api/client'
import type { Valuation } from '../types'
import RangeBar from '../components/RangeBar'
import MethodComparisonChart from '../components/MethodComparisonChart'
import ConfidenceIndicator from '../components/ConfidenceIndicator'
import CompletenessRing from '../components/CompletenessRing'
import ExportMenu from '../components/ExportMenu'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round Adjusted',
  comps: 'Comparable Multiples',
  dcf: 'Discounted Cash Flow',
  manual: 'Manual Override',
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

export default function ValuationResults() {
  const { id } = useParams<{ id: string }>()
  const [valuation, setValuation] = useState<Valuation | null>(null)
  const [showTrail, setShowTrail] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) getValuation(id).then(setValuation).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!valuation) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Valuation not found</div>

  const trail = valuation.audit_trail

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/companies/${valuation.company_id}`} className="text-sm text-[var(--color-primary)] hover:underline">
            {trail.input_snapshot.name as string}
          </Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">Valuation Results</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            v{valuation.version} &middot; {new Date(valuation.created_at).toLocaleDateString()} &middot; by {valuation.created_by}
          </p>
        </div>
        <ExportMenu valuationId={valuation.id} />
      </div>

      {/* Main Value Card */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Fair Value Estimate</p>
            <p className="text-3xl font-bold text-[var(--color-primary)]">{formatCurrency(valuation.fair_value)}</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              Range: {formatCurrency(valuation.fair_value_low)} – {formatCurrency(valuation.fair_value_high)}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Confidence</p>
              <ConfidenceIndicator level={valuation.confidence} />
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Data</p>
              <CompletenessRing value={valuation.data_completeness} />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <RangeBar
            low={parseFloat(valuation.fair_value_low)}
            mid={parseFloat(valuation.fair_value)}
            high={parseFloat(valuation.fair_value_high)}
          />
        </div>

        <div className="flex gap-3 mb-6">
          <div className="px-3 py-1.5 rounded-lg bg-indigo-50 text-sm font-medium text-[var(--color-primary)]">
            {METHOD_LABELS[valuation.primary_method] || valuation.primary_method}
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{valuation.explanation}</p>
      </div>

      {/* Method Comparison */}
      {valuation.method_results.length > 1 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Method Comparison</h2>
          <MethodComparisonChart results={valuation.method_results} />
        </div>
      )}

      {/* Audit Trail Toggle */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <button
          onClick={() => setShowTrail(t => !t)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Audit Trail</h2>
          <span className="text-[var(--color-text-tertiary)] text-sm">{showTrail ? 'Hide' : 'Show'}</span>
        </button>

        {showTrail && (
          <div className="px-6 pb-6 space-y-5">
            {/* Input Snapshot */}
            <div className="border-l-2 border-[var(--color-primary)] pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">1. Input Snapshot</h3>
              <div className="space-y-1">
                {Object.entries(trail.input_snapshot).map(([key, val]) => (
                  <div key={key} className="flex text-xs">
                    <span className="text-[var(--color-text-tertiary)] w-36">{key.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--color-text-secondary)]">{val != null ? String(val) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Method Selection */}
            <div className="border-l-2 border-[var(--color-primary)] pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">2. Method Selection</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{trail.method_selection_rationale}</p>
              <div className="mt-2 space-y-1">
                {trail.recommendations.map((rec, i) => (
                  <div key={i} className="text-xs text-[var(--color-text-tertiary)]">
                    {rec.is_primary ? '(Primary)' : '(Secondary)'} {METHOD_LABELS[rec.method] || rec.method}: {rec.rationale}
                  </div>
                ))}
              </div>
            </div>

            {/* Computation Steps per Method */}
            {valuation.method_results.map((mr, mi) => (
              <div key={mi} className="border-l-2 border-[var(--color-primary)] pl-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  {3 + mi}. {METHOD_LABELS[mr.method] || mr.method} {mr.is_primary ? '(Primary)' : ''}
                </h3>

                {mr.steps.map((step, si) => (
                  <div key={si} className="mb-3">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">{step.description}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] font-mono mt-0.5">{step.formula}</p>
                    <div className="flex gap-4 mt-0.5">
                      {Object.entries(step.inputs).map(([k, v]) => (
                        <span key={k} className="text-xs text-[var(--color-text-tertiary)]">{k}: <span className="text-[var(--color-text-secondary)]">{v}</span></span>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mt-0.5">= {step.output}</p>
                  </div>
                ))}

                {mr.assumptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Assumptions:</p>
                    {mr.assumptions.map((a, ai) => (
                      <div key={ai} className="text-xs text-[var(--color-text-tertiary)] mb-0.5">
                        {a.name}: <span className="text-[var(--color-text-secondary)]">{a.value}</span> — {a.rationale}
                        {a.source && <span className="italic"> (src: {a.source})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Meta */}
            <div className="border-l-2 border-emerald-400 pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Metadata</h3>
              <div className="space-y-0.5 text-xs text-[var(--color-text-tertiary)]">
                <p>Engine: {trail.engine_version}</p>
                <p>Benchmark: {trail.benchmark_version || 'N/A'}</p>
                <p>Timestamp: {trail.timestamp}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

```tsx
import ValuationResults from './pages/ValuationResults'

// In Routes:
<Route path="/valuations/:id" element={<ValuationResults />} />
```

- [ ] **Step 3: Test end-to-end in browser**

```bash
# Create a company via the form, run valuation, verify results page renders
# with value card, range bar, explanation, method comparison, and audit trail
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Valuation Results page with audit trail"
```

---

### Task 23: Company History Page

**Files:**
- Create: `frontend/src/pages/CompanyHistory.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement company history**

```tsx
// frontend/src/pages/CompanyHistory.tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCompany, listValuations } from '../api/client'
import type { Company, ValuationListItem } from '../types'
import ConfidenceIndicator from '../components/ConfidenceIndicator'
import ValueTrendLine from '../components/ValueTrendLine'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
  dcf: 'DCF',
  manual: 'Manual',
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toLocaleString()}`
}

export default function CompanyHistory() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [valuations, setValuations] = useState<ValuationListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getCompany(id), listValuations(id)])
      .then(([c, v]) => { setCompany(c); setValuations(v) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Company Header */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{company.name}</h1>
        <div className="flex gap-4 mt-2 text-sm text-[var(--color-text-secondary)]">
          <span>{company.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          <span className="text-[var(--color-text-tertiary)]">&middot;</span>
          <span>{company.sector.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          {company.current_revenue && (
            <>
              <span className="text-[var(--color-text-tertiary)]">&middot;</span>
              <span>{formatCurrency(company.current_revenue)} revenue</span>
            </>
          )}
        </div>
      </div>

      {/* Value Trend Chart */}
      {valuations.length >= 2 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Value Trend</h2>
          <ValueTrendLine valuations={valuations} />
        </div>
      )}

      {/* Valuations History */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Valuation History</h2>
        <Link
          to="/valuations/new"
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          New Valuation
        </Link>
      </div>

      {valuations.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm text-[var(--color-text-tertiary)]">No valuations yet for this company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {valuations.map(v => (
            <Link
              key={v.id}
              to={`/valuations/${v.id}`}
              className="block bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary-light)] transition-colors"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[var(--color-text-tertiary)]">v{v.version}</span>
                  <span className="text-lg font-semibold text-[var(--color-text-primary)]">{formatCurrency(v.fair_value)}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">
                    {METHOD_LABELS[v.primary_method] || v.primary_method}
                  </span>
                  <ConfidenceIndicator level={v.confidence} />
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(v.created_at).toLocaleDateString()} &middot; {v.created_by}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

```tsx
import CompanyHistory from './pages/CompanyHistory'

// In Routes:
<Route path="/companies/:id" element={<CompanyHistory />} />
```

- [ ] **Step 3: Test in browser**

```bash
# Navigate to a company from the dashboard, verify history page shows all valuations
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Company History page with valuation timeline"
```

---

## Phase 5: Integration and Polish

### Task 24: End-to-End Verification

- [ ] **Step 1: Start all services**

```bash
docker compose up -d                # Postgres
cd backend && source .venv/bin/activate
alembic upgrade head                # Ensure schema is current
uvicorn api.main:app --reload --port 8000 &
cd ../frontend && npm run dev &
```

- [ ] **Step 2: Run full backend test suite**

```bash
cd backend && pytest tests/ -v
# Expected: all tests pass
```

- [ ] **Step 3: Manual walkthrough in browser**

At `http://localhost:5173`:

1. Dashboard loads with empty state
2. Click "New Valuation" → form loads with sectors from API
3. Fill in a pre-revenue seed company with a funding round → submit
4. Results page shows Last Round Adjusted as primary method
5. Audit trail expands and shows all steps
6. Export JSON works (downloads file)
7. Export Excel works (downloads .xlsx)
8. Navigate to company history → valuation listed
9. Create another valuation (revenue company) → Comps method
10. Dashboard shows both companies with latest values

- [ ] **Step 4: Fix any issues found during walkthrough**

Address any bugs or UI issues discovered during manual testing.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address integration issues from end-to-end testing"
```

---

### Task 25: Add Seed Data Script

**Files:**
- Create: `backend/scripts/seed_data.py`

- [ ] **Step 1: Create seed script for demo data**

```python
# backend/scripts/seed_data.py
"""Seed the database with sample companies and run valuations for demo purposes."""
import sys
sys.path.insert(0, ".")

from datetime import date
from decimal import Decimal
from db.session import SessionLocal, engine
from db.models import Base, User, Company
from services.valuation_service import run_company_valuation

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Create demo user
user = User(name="Demo Auditor", email="demo@audit.com")
db.add(user)
db.commit()

# Company 1: Pre-revenue seed with round
c1 = Company(
    name="NeuralPath AI",
    stage="seed",
    sector="ai_ml",
    revenue_status="pre_revenue",
    last_round_date=date(2025, 8, 15),
    last_round_valuation=Decimal("12000000"),
    last_round_amount=Decimal("4000000"),
    last_round_investor="Andreessen Horowitz",
    auditor_notes="Strong founding team, ex-Google AI researchers. Early traction with 3 enterprise pilots.",
    created_by="Demo Auditor",
)
db.add(c1)
db.commit()
db.refresh(c1)
run_company_valuation(db, c1, "Demo Auditor")

# Company 2: Early revenue SaaS
c2 = Company(
    name="CloudSecure Pro",
    stage="series_a_plus",
    sector="cybersecurity",
    revenue_status="early_revenue",
    current_revenue=Decimal("4200000"),
    last_round_date=date(2025, 3, 1),
    last_round_valuation=Decimal("35000000"),
    last_round_amount=Decimal("12000000"),
    last_round_investor="Accel",
    auditor_notes="SOC2 certified. 40+ enterprise customers. Net revenue retention >120%.",
    created_by="Demo Auditor",
)
db.add(c2)
db.commit()
db.refresh(c2)
run_company_valuation(db, c2, "Demo Auditor")

# Company 3: Growth stage with projections
c3 = Company(
    name="PayFlow",
    stage="growth",
    sector="fintech",
    revenue_status="meaningful_revenue",
    current_revenue=Decimal("18000000"),
    last_round_date=date(2024, 11, 1),
    last_round_valuation=Decimal("120000000"),
    last_round_amount=Decimal("30000000"),
    last_round_investor="Tiger Global",
    projections={
        "periods": [
            {"year": 2026, "revenue": "27000000", "ebitda": "4000000", "growth_rate": 0.50},
            {"year": 2027, "revenue": "40000000", "ebitda": "8000000", "growth_rate": 0.48},
            {"year": 2028, "revenue": "56000000", "ebitda": "14000000", "growth_rate": 0.40},
            {"year": 2029, "revenue": "73000000", "ebitda": "22000000", "growth_rate": 0.30},
            {"year": 2030, "revenue": "88000000", "ebitda": "30000000", "growth_rate": 0.21},
        ],
    },
    auditor_notes="Category leader in SMB payments. Path to profitability clear by 2028.",
    created_by="Demo Auditor",
)
db.add(c3)
db.commit()
db.refresh(c3)
run_company_valuation(db, c3, "Demo Auditor")

db.close()
print("Seed data created: 3 companies with valuations")
```

- [ ] **Step 2: Run the seed script**

```bash
cd backend && source .venv/bin/activate
python scripts/seed_data.py
# Expected: "Seed data created: 3 companies with valuations"
```

- [ ] **Step 3: Verify in browser**

```bash
# Visit http://localhost:5173 — dashboard should show 3 companies with valuations
```

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_data.py
git commit -m "feat: add seed data script with 3 demo companies"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| Phase 1: Scaffolding | Tasks 1-4 | Running backend, frontend, Postgres, migrations |
| Phase 2: Engine | Tasks 5-13 | Pure Python valuation engine: 3 methods + manual + rules + audit trail |
| Phase 3: API | Tasks 14-17 | Full REST API: CRUD, run valuations, exports, benchmarks |
| Phase 4: Frontend | Tasks 18-23 | Complete UI: dashboard, wizard form, results, audit trail, history |
| Phase 5: Integration | Tasks 24-25 | E2E verification, seed data, polish |
