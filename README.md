# ValCalc — VC Audit Valuation Tool

Structured, auditable valuation engine for private portfolio companies. Built for auditors reviewing VC portfolios under ASC 820 / IPEV guidelines.

## Setup

```bash
./start.sh                    # starts backend (port 8000) + frontend (port 5173)
```

Or manually: `cd backend && pip install -e ".[dev]" && python scripts/seed_data.py && uvicorn api.main:app --port 8000`, then `cd frontend && npm install && npm run dev`. Requires Python 3.12+, Node 18+. Uses SQLite (no external DB).

## Approach

**Primary method: Recent Financing + Calibration** (ASC 820-10-35). Starts from the last arm's-length transaction price and calibrates forward through 6 individually-traced steps: anchor valuation → time decay → financial performance → sector movement → qualitative factors → cap table notes.

**Cross-check: Comparable multiples** when revenue data is available. If no round data exists, comps becomes primary.

All benchmark data is **mocked** (flagged as `v2025-Q1` in source citations). In production, these would come from PitchBook or S&P Capital IQ.

## Key Design Decisions

- **Backend is the product.** The engine produces a complete audit trail (conclusion, calibration steps with equations and working numbers, sourced assumptions). The CLI (`python cli.py demo`) produces the same output as the API — independent of any frontend.
- **Batch-first intake.** Upload a portfolio spreadsheet (one row per company) to trigger valuations across the entire portfolio. Single-company import and manual entry also supported.
- **Conservative by design.** Time decay is one-directional, DLOM always applies, discount rates default high by stage. Matches audit practice where overstatement risk > precision.
- **Citations everywhere.** Every assumption carries a source field tracing to ASC 820, IPEV Guidelines, benchmark versions, or company data.
- **Overrideable assumptions.** Any assumption marked `overrideable` can be adjusted; overrides are tracked in the audit trail.

## CLI

```bash
cd backend && source .venv/bin/activate
python cli.py demo                                    # built-in demo (Acme AI, Series A SaaS)
python cli.py batch tests/fixtures/batch_25_portfolio.xlsx  # value a full portfolio
python cli.py example | python cli.py value -         # generate + value example JSON
python cli.py value company.json --json | jq '.'      # raw JSON output
python cli.py template                                # download batch template
python cli.py test                                    # run test suite
```

## Testing

```bash
pytest tests/ -v              # 61 unit/integration tests
python cli.py batch tests/fixtures/batch_10_companies.xlsx   # 10 companies, 8 sectors
python cli.py batch tests/fixtures/batch_5_edge_cases.xlsx   # edge cases (pre-rev, stale, mega)
```

Three synthetic portfolio fixtures: 10-company (diverse sectors), 25-company (full fund simulation, $10.6B), 5-company (edge cases: pre-revenue SAFE, stale rounds, hyper-growth).

## API

```bash
# Batch import (creates companies + runs valuations)
curl -X POST localhost:8000/api/v1/import/batch -F "file=@portfolio.xlsx" -F "created_by=auditor"

# Single company + valuation (with optional overrides)
curl -X POST localhost:8000/api/v1/companies/{id}/valuations \
  -H "Content-Type: application/json" -d '{"created_by":"auditor","overrides":{"revenue_multiple":8.0}}'

# Export valuation as PDF/Excel/JSON
curl localhost:8000/api/v1/valuations/{id}/export/pdf -o report.pdf
```

## Stack

**Backend:** Python, FastAPI, SQLAlchemy, Pydantic v2, SQLite  |  **Frontend:** React 19, TypeScript, Tailwind v4, Vite  |  **Tests:** 61 tests + 3 mock portfolio fixtures
