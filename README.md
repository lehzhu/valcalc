# ValCalc - VC Audit Valuation Tool

A structured, auditable valuation workflow for private portfolio companies. Built for auditors reviewing venture capital portfolios under ASC 820 / IPEV guidelines.

## Approach

Rather than building a single calculator, ValCalc implements a **method-centric workspace** where auditors run multiple valuation methods, adjust assumptions, and reconcile results into a defensible conclusion.

**Three valuation methods, each with full audit trails:**
- **Comparable Company Multiples** -- sector benchmarks, growth adjustments, DLOM
- **Discounted Cash Flow** -- WACC by stage/revenue, terminal value via Gordon Growth, sensitivity analysis
- **Last Round Adjusted** -- time decay, sector trend factors

**The rules engine** automatically recommends primary/secondary methods based on company stage, revenue status, and data availability -- codifying ASC 820 guidance into deterministic logic.

## Key Design Decisions

- **Stage and revenue tiers are calculation parameters, not labels.** A Series C+ company gets a 22% WACC; scaled revenue reduces it by 2%. These flow directly into the math.
- **Every number traces to a formula, inputs, and a source.** Each computation step records its formula, inputs, and output. Assumptions carry rationale and source citations. This is what auditors need for workpapers.
- **Assumption overrides with live recalculation.** Click any assumption to adjust it and see the valuation update. Overrides are tracked in the audit trail.
- **Sensitivity analysis.** WACC vs terminal growth matrix for DCF, color-coded, with base case highlighted.
- **Method reconciliation.** Weight multiple methods (e.g., 60% DCF / 40% Comps) to produce a blended conclusion.
- **Export to PDF and Excel.** Professional valuation memo PDF; 4-sheet Excel workbook (Summary, Method Details, Assumptions, Audit Trail).

## Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/seed_data.py          # load demo companies
uvicorn api.main:app --port 8000

# Frontend
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Requires Python 3.12+ and Node 18+. SQLite (no external database needed).

## Usage

1. **Dashboard** -- view all companies and their latest valuations
2. **New Valuation** -- create a company with stage, sector, revenue status
3. **Workspace** -- run methods tab-by-tab, adjust assumptions, view sensitivity, reconcile with weights
4. **Save** -- persists versioned valuation with full audit trail
5. **Export** -- PDF memo, Excel workbook, or JSON

## Stack

**Backend:** FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite, WeasyPrint (PDF)
**Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite 8
**Tests:** 65 unit/integration tests (`pytest tests/`)

## If I Had More Time

- **Real benchmark data** -- current sector multiples are mock (flagged in source). Production would pull from PitchBook or S&P Capital IQ.
- **Comparable company selection** -- let auditors pick specific public comps instead of relying on sector medians.
- **Multi-user collaboration** -- reviewer/approver workflow with sign-off tracking.
- **Historical market index integration** -- replace sector trend factors with actual index performance for Last Round method.
