# ValCalc - VC Audit Valuation Tool

A structured, auditable valuation engine for private portfolio companies. Built for auditors reviewing venture capital portfolios under ASC 820 / IPEV guidelines.

## Approach & Methodology

ValCalc implements **Recent Financing + Calibration** as the primary valuation method. This follows ASC 820-10-35 guidance: start from the most recent arm's-length transaction price and calibrate forward based on what has changed since.

**The calibration engine runs 6 steps, each individually sourced and traced:**

1. **Anchor** -- post-money valuation from last financing round
2. **Time adjustment** -- staleness decay after a 12-month grace period (2%/quarter)
3. **Financial performance** -- revenue trajectory, gross margin, runway signals
4. **Market/sector** -- sector benchmark movement since the round
5. **Qualitative** -- board plan status, customer concentration, regulatory risk
6. **Cap table notes** -- liquidation preferences, option pools, SAFEs (noted; OPM not modeled)

Comps (comparable company multiples) and DCF are available as optional cross-checks when data supports them, but the calibration method is always primary when round data exists.

### Why this method?

The assignment asks for a single, well-engineered workflow. We chose calibration because:

- It's the most common approach auditors actually use for VC portfolios (per IPEV and ASC 820)
- It has a clear anchor (the transaction price) rather than relying on estimated multiples or projected cash flows
- It naturally accommodates sparse data -- you can run it with just a round date and valuation, and layer in financial/qualitative data as available
- Every adjustment is individually traceable, which is exactly what audit workpapers need

## Key Design Decisions & Tradeoffs

**Backend is the product.** The engine produces a complete `reasoning_trace` -- conclusion-first, with each calibration step showing the equation template and working numbers separately, plus citations on every assumption. This output is self-contained: the CLI (`python cli.py company.json`) produces the same audit-quality trace as the API, independent of any frontend.

**Batch intake, not interactive questions.** The system accepts all company data at once -- via JSON payload, Excel upload (5-sheet template covering Transaction, Financials, Forecast, Qualitative, External Mapping), or CSV. The parser auto-detects layouts and routes fields into structured JSON blobs. No wizard, no follow-up questions.

**Conservative by design.** Time decay is one-directional (no appreciation), DLOM always applies, WACC defaults high by stage, benchmarks use medians not optimistic percentiles. This matches audit practice where overstatement risk matters more than precision.

**Citations everywhere, never fabricated.** Every assumption carries a `source` field tracing to ASC 820, IPEV Guidelines, benchmark data versions, or company financial data. The engine never produces a number without explaining where it came from.

**Stage and revenue tiers are calculation parameters, not labels.** A Series C+ company gets a 22% WACC; scaled revenue reduces it by 2%. These flow directly into the math, not just the UI.

**Overrideable assumptions with audit trail.** Any assumption marked `overrideable: true` can be adjusted. Overrides are tracked and persisted in the audit trail.

### Evolution & Process

The system went through several intentional pivots during development:

1. **Started with three equal methods** (Comps, DCF, Last Round) with a rules engine selecting the primary method based on company profile. Each method had full audit trails from the start.

2. **Removed confidence scoring** early on -- it added noise without helping auditors make decisions. Method selection is deterministic based on data availability, not probabilistic.

3. **Switched from PostgreSQL/Docker to SQLite** to simplify setup. For an audit tool processing individual portfolios, SQLite is the right choice -- no infrastructure overhead, single-file database, trivially portable.

4. **Pivoted to calibration-primary architecture.** After deeper analysis of ASC 820-10-35 and how auditors actually work, restructured so Recent Financing + Calibration is always primary when round data exists. Comps and DCF became optional cross-checks.

5. **Expanded data model** from basic company fields to 5 structured categories (transaction/cap table, financials, forecast, qualitative, external mapping) that feed into the calibration steps.

6. **Moved presentation logic to the backend.** The reversed reasoning trace (conclusion first, equation vs working distinction) was initially a frontend rendering concern. Moved it to the engine as `reasoning_trace` so the API and CLI produce the same structured output.

## Setup

```bash
# Quick start (recommended)
./start.sh

# Or manually:
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python scripts/seed_data.py
uvicorn api.main:app --port 8000

cd frontend
npm install
npm run dev
```

Requires Python 3.12+ and Node 18+. SQLite (no external database needed).

## Usage

### Web UI

1. **Dashboard** -- view all companies and their latest valuations
2. **New Valuation** -- create a company (or import from Excel/CSV), select stage, sector, revenue status
3. **Workspace** -- view calibration trace, run cross-check methods, adjust assumptions
4. **Export** -- PDF memo, Excel workbook, or JSON

### CLI

```bash
cd backend && source .venv/bin/activate

# Print example input JSON
python cli.py --example > company.json

# Run valuation and print formatted reasoning trace
python cli.py company.json

# Run valuation and output raw JSON (for piping to other tools)
python cli.py company.json --json

# Specify valuation date
python cli.py company.json --valuation-date 2026-01-01
```

### API

```bash
# Create company and run valuation
curl -X POST http://localhost:8000/api/v1/companies -H "Content-Type: application/json" \
  -d '{"name":"Acme","stage":"series_a","sector":"information_technology","revenue_status":"growing_revenue","current_revenue":"5000000","created_by":"auditor"}'

# Upload Excel for batch data import
curl -X POST http://localhost:8000/api/v1/import/parse -F "file=@company_data.xlsx"

# Run valuation (returns reasoning_trace, method_results, audit_trail)
curl -X POST http://localhost:8000/api/v1/companies/{id}/valuations \
  -H "Content-Type: application/json" -d '{"created_by":"auditor"}'

# Download import template
curl http://localhost:8000/api/v1/import/template -o template.xlsx
```

## Output Structure

Every valuation returns four required outputs:

| Output | Location in API response |
|--------|-------------------------|
| **Estimated fair value** (numeric + range) | `fair_value`, `fair_value_low`, `fair_value_high` |
| **Key inputs and assumptions** | `reasoning_trace.assumptions_table[]` with name, value, rationale |
| **Citations / data sources** | `reasoning_trace.data_sources[]` + each assumption's `source` field |
| **Explanation of derivation** | `reasoning_trace.calibration_steps[]` (equation + working per step) |

## Stack

**Backend:** Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite
**Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite
**Tests:** 65 unit/integration tests (`cd backend && pytest tests/ -v`)

## Extension

- **Real benchmark data** -- current sector multiples are mock (flagged in source). Production would pull from PitchBook, S&P Capital IQ, or PrivCo.
- **Equity allocation (OPM/waterfall)** -- the engine notes cap table complexity but doesn't model option pricing or liquidation preference waterfalls. This is the gap between enterprise value and per-share fair value.
- **Data integration** -- Netsuite, Carta, Microsoft Dynamics for automated portfolio data ingestion.
- **Historical market index integration** -- replace static sector trend factors with actual index performance data (e.g., NASDAQ IT index movement since round date).
- **PDF/document parsing** -- currently supports Excel/CSV. Adding PDF parsing (term sheets, board decks) would enable ingesting common audit documents directly.
- **Multi-user review workflow** -- reviewer/approver roles with sign-off tracking for audit team collaboration.
