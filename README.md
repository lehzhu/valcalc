# ValCalc - VC Audit Valuation Tool

A structured, auditable valuation engine for private portfolio companies. Built for auditors reviewing venture capital portfolios under ASC 820 / IPEV guidelines.

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

## Approach & Methodology

ValCalc implements **Recent Financing + Calibration** as the primary valuation method. This follows ASC 820-10-35 guidance: start from the most recent arm's-length transaction price and calibrate forward based on what has changed since.

**The calibration engine runs 6 steps, each individually sourced and traced:**

1. **Anchor**: post-money valuation from last financing round
2. **Time adjustment**: staleness decay after a 12-month grace period (2%/quarter)
3. **Financial performance**: revenue trajectory, gross margin, runway signals
4. **Market/sector**: sector benchmark movement since the round
5. **Qualitative**: board plan status, customer concentration, regulatory risk
6. **Cap table notes**: liquidation preferences, option pools, SAFEs (noted; OPM not modeled)

Comparable company multiples (comps) serve as a cross-check when revenue data is available. When no round data exists, comps becomes the primary method.

### Why this method?

The assignment asks for a single, well-engineered workflow. We chose calibration because:

- It's the most common approach auditors actually use for VC portfolios (per IPEV and ASC 820)
- It has a clear anchor (the transaction price) rather than relying on estimated multiples or projected cash flows
- It naturally accommodates sparse data: you can run it with just a round date and valuation, and layer in financial/qualitative data as available
- Every adjustment is individually traceable, which is exactly what audit workpapers need

## Key Design Decisions & Tradeoffs

**Backend is the product.** The engine produces a complete `reasoning_trace` (conclusion-first, with each calibration step showing the equation template and working numbers separately, plus citations on every assumption). This output is self-contained: the CLI (`python cli.py demo`) produces the same audit-quality trace as the API, independent of any frontend.

**Batch-first intake.** The primary workflow is uploading a portfolio spreadsheet (one row per company) that triggers automated valuations across the entire portfolio. Single-company Excel import (5-sheet template) and manual entry are also supported. No wizard, no follow-up questions; the system runs both methods on every company where data permits.

**Conservative by design.** Time decay is one-directional (no appreciation), DLOM always applies, discount rates default high by stage, benchmarks use medians not optimistic percentiles. This matches audit practice where overstatement risk matters more than precision.

**Citations everywhere, never fabricated.** Every assumption carries a `source` field tracing to ASC 820, IPEV Guidelines, benchmark data versions, or company financial data. The engine never produces a number without explaining where it came from.

**Stage and revenue tiers are calculation parameters, not labels.** A Series C+ company gets a higher base discount rate; scaled revenue reduces it. These flow directly into the calibration math, not just the UI.

**Overrideable assumptions with audit trail.** Any assumption marked `overrideable: true` can be adjusted. Overrides are tracked and persisted in the audit trail.

### A note on data

**All benchmark data is mocked.** Sector revenue multiples, growth rates, and trend factors in `backend/valuation_engine/benchmarks/data/` are realistic but synthetic. In production these would come from PitchBook, S&P Capital IQ, or PrivCo. The mock data is flagged in source citations (e.g., `Benchmark v2025-Q1`) so it's never mistaken for live market data.

The three test portfolio files (`backend/tests/fixtures/batch_*.xlsx`) contain fictional companies with realistic financials. They exist to demonstrate the engine's behavior across stages, sectors, and edge cases, not to represent real investments.

### Evolution & Process

The system went through several intentional pivots during development:

1. **Started broad, then focused.** Early versions had more valuation methods; we narrowed to the two that auditors actually rely on for VC portfolios. Method selection is deterministic based on data availability, not probabilistic.

2. **Switched from PostgreSQL/Docker to SQLite** to simplify setup. For an audit tool processing individual portfolios, SQLite is the right choice: no infrastructure overhead, single-file database, trivially portable.

3. **Pivoted to calibration-primary architecture.** After deeper analysis of ASC 820-10-35 and how auditors actually work, restructured so Recent Financing + Calibration is always primary when round data exists. Comps became a cross-check.

4. **Moved presentation logic to the backend.** The reversed reasoning trace (conclusion first, equation vs working distinction) was initially a frontend rendering concern. Moved it to the engine as `reasoning_trace` so the API and CLI produce the same structured output.

## CLI

The fastest way to use ValCalc. No server needed; runs the engine directly.

```bash
cd backend && source .venv/bin/activate

# Run the built-in demo (Acme AI, Series A SaaS)
python cli.py demo

# Value a full portfolio from Excel
python cli.py batch tests/fixtures/batch_25_portfolio.xlsx

# Value a single company from JSON
python cli.py example > company.json    # generate example input
python cli.py value company.json        # run it

# Pipe JSON through stdin
python cli.py example | python cli.py value -

# Raw JSON output (for piping to jq, scripts, etc.)
python cli.py value company.json --json
python cli.py value company.json --json | jq '.reasoning_trace.conclusion'

# Batch with JSON output
python cli.py batch portfolio.xlsx --json | jq '.results[] | {name: .company_name, value: .fair_value}'

# Save the batch template to fill out yourself
python cli.py template

# Run the test suite
python cli.py test
```

### Reading the output

The CLI prints a structured audit trace for each company. Here's what each section means:

**Header**: the fair value estimate, range (low-high based on sensitivity), and which method was primary.

**Cross-checks**: if both Last Round and Comps ran, the secondary method's range appears here. A large gap between methods is a signal to investigate, not a bug.

**Calibration Steps**: the full derivation from anchor to conclusion, in reverse order (conclusion first, anchor last). Each step shows what was applied and the running total. Read bottom-to-top to follow the math forward.

**Assumptions**: every input the engine used, with `[overrideable]` flags. Each shows a rationale (why this value) and source (where it came from). Override these via the `--json` flag + API `overrides` parameter.

**Sources**: data provenance. `v2025-Q1` means mocked benchmark data. `Round dated YYYY-MM-DD` traces to the company's financing history.

### Batch output

The batch command prints a summary table: company name, fair value, primary method, and which cross-checks ran. The total line is the sum of all fair values (aggregate portfolio NAV).

Companies that fail valuation (e.g., missing required fields) show as `ERROR` with a reason.

## Testing

```bash
cd backend && source .venv/bin/activate

# Run all 61 tests
python cli.py test
# or equivalently:
pytest tests/ -v

# Run specific test modules
pytest tests/engine/test_last_round.py -v     # calibration method
pytest tests/engine/test_comps.py -v          # comparable multiples
pytest tests/engine/test_engine.py -v         # full engine integration
pytest tests/engine/test_rules.py -v          # method selection logic

# Test batch import end-to-end via CLI
python cli.py batch tests/fixtures/batch_10_companies.xlsx     # 10 companies, 8 sectors
python cli.py batch tests/fixtures/batch_25_portfolio.xlsx     # full fund, $10.6B
python cli.py batch tests/fixtures/batch_5_edge_cases.xlsx     # edge cases (pre-rev, stale, mega)

# Smoke test: demo should print a full trace without errors
python cli.py demo

# Smoke test: example JSON round-trips cleanly
python cli.py example | python cli.py value - --json | jq '.fair_value'
```

### What the test fixtures cover

| File | Companies | Purpose |
|------|-----------|---------|
| `batch_10_companies.xlsx` | 10 | Diverse sectors (SaaS, biotech, fintech, climate, consumer, media, robotics, food). Mix of healthy and struggling companies. |
| `batch_25_portfolio.xlsx` | 25 | Full VC fund simulation. Stage distribution: 20% seed, 32% Series A, 28% Series B, 20% late. Real investor names, varied cap table complexity. |
| `batch_5_edge_cases.xlsx` | 5 | Pre-revenue SAFE with no financials, stale 2022 round with 4-month runway, $340M late-stage with participating preferred, high-risk/high-growth, 500% hyper-growth from tiny base. |

All fixture data is **synthetic** (fictional companies with realistic financials). The files were generated by `backend/tests/fixtures/generate_batch_fixtures.py` and can be regenerated.

## API

Start the server with `./start.sh` or `uvicorn api.main:app --port 8000`.

```bash
# Batch import: upload portfolio spreadsheet (creates companies + runs valuations)
curl -X POST http://localhost:8000/api/v1/import/batch \
  -F "file=@portfolio.xlsx" -F "created_by=auditor"

# Create a single company
curl -X POST http://localhost:8000/api/v1/companies -H "Content-Type: application/json" \
  -d '{"name":"Acme","stage":"series_a","sector":"information_technology","revenue_status":"growing_revenue","current_revenue":"5000000","created_by":"auditor"}'

# Run valuation on a company
curl -X POST http://localhost:8000/api/v1/companies/{id}/valuations \
  -H "Content-Type: application/json" -d '{"created_by":"auditor"}'

# Run valuation with assumption overrides
curl -X POST http://localhost:8000/api/v1/companies/{id}/valuations \
  -H "Content-Type: application/json" \
  -d '{"created_by":"auditor","overrides":{"revenue_multiple":8.0,"dlom":0.15}}'

# Get a valuation with full trace
curl http://localhost:8000/api/v1/valuations/{id} | jq '.reasoning_trace'

# Download templates
curl http://localhost:8000/api/v1/import/batch-template -o batch-template.xlsx
curl http://localhost:8000/api/v1/import/template -o single-company-template.xlsx
```

## Output Structure

Every valuation returns four required outputs:

| Output | Location in API response |
|--------|-------------------------|
| **Estimated fair value** (numeric + range) | `fair_value`, `fair_value_low`, `fair_value_high` |
| **Key inputs and assumptions** | `reasoning_trace.assumptions_table[]` with name, value, rationale, source |
| **Citations / data sources** | `reasoning_trace.data_sources[]` + each assumption's `source` field |
| **Explanation of derivation** | `reasoning_trace.calibration_steps[]` (equation + working per step) |

The `reasoning_trace` is the authoritative output. It's structured for both machine consumption (JSON) and human reading (CLI formatter). The frontend renders it, but the backend produces it; the API and CLI are first-class interfaces, not wrappers around a UI.

## Stack

**Backend:** Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite
**Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite
**Tests:** 61 unit/integration tests, 3 mock portfolio fixtures (10, 25, 5-edge-case companies)

## Extension

- **Real benchmark data**: current sector multiples are mock (flagged in source as `v2025-Q1`). Production would pull from PitchBook, S&P Capital IQ, or PrivCo.
- **Equity allocation (OPM/waterfall)**: the engine notes cap table complexity but doesn't model option pricing or liquidation preference waterfalls. This is the gap between enterprise value and per-share fair value.
- **Data integration**: Netsuite, Carta, Microsoft Dynamics for automated portfolio data ingestion.
- **Historical market index integration**: replace static sector trend factors with actual index performance data (e.g., NASDAQ IT index movement since round date).
- **PDF/document parsing**: currently supports Excel/CSV. Adding PDF parsing (term sheets, board decks) would enable ingesting common audit documents directly.
- **Multi-user review workflow**: reviewer/approver roles with sign-off tracking for audit team collaboration.
