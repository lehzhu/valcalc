#!/usr/bin/env python3
"""ValCalc CLI — value private companies from the command line.

Usage:
    python cli.py demo                           # run the built-in example
    python cli.py batch portfolio.xlsx            # value an entire portfolio
    python cli.py value company.json              # value a single company (JSON)
    python cli.py template                        # save batch template to disk
    python cli.py test                            # run the test suite
"""
import argparse
import json
import sys
import os
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.engine import run_valuation


# ── Colors ──────────────────────────────────────────────────────────────

def _c(code: int, text: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"\033[{code}m{text}\033[0m"

def _bold(t: str) -> str: return _c(1, t)
def _dim(t: str) -> str: return _c(2, t)
def _green(t: str) -> str: return _c(32, t)
def _yellow(t: str) -> str: return _c(33, t)
def _red(t: str) -> str: return _c(31, t)
def _cyan(t: str) -> str: return _c(36, t)


# ── Formatting ──────────────────────────────────────────────────────────

def _fmtcur(value) -> str:
    n = Decimal(str(value))
    if n >= 1_000_000_000: return f"${n / 1_000_000_000:.1f}B"
    if n >= 1_000_000: return f"${n / 1_000_000:.1f}M"
    if n >= 1_000: return f"${n / 1_000:.0f}K"
    return f"${n:.0f}"


def print_result(result, name: str = "") -> None:
    """Pretty-print a valuation result to stdout."""
    trace = result.reasoning_trace
    conclusion = trace["conclusion"]
    ms = trace["method_selection"]

    # Header
    print()
    if name:
        print(f"  {_bold(name)}")
    print(f"  {_bold(_green(conclusion['fair_value_display']))}  {_dim(conclusion['range'])}")
    print(f"  {_dim('Method:')} {conclusion['method_display']}")
    print()

    # Cross-checks
    if ms.get("secondary_methods"):
        print(f"  {_dim('Cross-checks:')}")
        for sm in ms["secondary_methods"]:
            label = sm['method'].replace('_', ' ').title()
            print(f"    {label:.<25s} {sm['range']}")
        print()

    # Steps (reversed: conclusion first)
    print(f"  {_bold('Calibration Steps')}")
    for step in trace["calibration_steps"]:
        desc = step['description']
        res = step['result']
        if "conclusion" in desc.lower():
            print(f"    {_green('→')} {desc}: {_bold(res)}")
        else:
            print(f"    {_dim('→')} {desc}: {res}")
    print()

    # Assumptions
    if trace.get("assumptions_table"):
        print(f"  {_bold('Assumptions')}")
        for a in trace["assumptions_table"]:
            flag = _dim(" [overrideable]") if a["overrideable"] else ""
            print(f"    {a['name']}: {_yellow(a['value'])}{flag}")
            print(f"      {_dim(a['rationale'])}")
        print()

    # Sources
    if trace.get("data_sources"):
        print(f"  {_dim('Sources:')}")
        for s in trace["data_sources"]:
            print(f"    {_dim('•')} {s['name']} ({s['version']})")
        print()


def print_batch_summary(results: list[dict]) -> None:
    """Print a summary table from batch results."""
    ok = [r for r in results if r["status"] == "ok"]
    err = [r for r in results if r["status"] == "error"]

    # Find max name length
    max_name = max((len(r.get("company_name", "")) for r in results), default=20)
    max_name = min(max_name, 35)

    print()
    print(f"  {_bold(f'{len(ok)}/{len(results)} companies valued')}")
    if err:
        print(f"  {_red(f'{len(err)} failed')}")
    print()

    # Header
    hdr = f"  {'Company':<{max_name}}  {'Fair Value':>12}  {'Method':<15}  {'Cross-checks'}"
    print(_dim(hdr))
    print(_dim("  " + "─" * (max_name + 50)))

    for r in results:
        name = r.get("company_name", "?")[:max_name]
        if r["status"] == "ok":
            fv = _fmtcur(r["fair_value"])
            method = r.get("primary_method", "").replace("_", " ").title()
            methods_run = r.get("methods_run", [])
            cross = ", ".join(
                m["method"].replace("_", " ").title()
                for m in methods_run
                if m["method"] != r.get("primary_method")
            ) or _dim("none")
            print(f"  {name:<{max_name}}  {_green(f'{fv:>12}')}  {method:<15}  {cross}")
        else:
            print(f"  {name:<{max_name}}  {_red('ERROR'):>12}  {_red(r.get('error', '?')[:40])}")

    if ok:
        total = sum(Decimal(r["fair_value"]) for r in ok)
        print(_dim("  " + "─" * (max_name + 50)))
        print(f"  {'Total':<{max_name}}  {_bold(_green(f'{_fmtcur(total):>12}'))}")
    print()


# ── Parsing ─────────────────────────────────────────────────────────────

def parse_company_input(data: dict) -> CompanyInput:
    """Parse a JSON dict into a CompanyInput dataclass."""
    last_round = None
    if data.get("last_round"):
        lr = data["last_round"]
        last_round = FundingRound(
            date=date.fromisoformat(lr["date"]),
            pre_money_valuation=Decimal(str(lr["pre_money_valuation"])),
            amount_raised=Decimal(str(lr["amount_raised"])),
            lead_investor=lr.get("lead_investor"),
        )

    projections = None
    if data.get("projections") and data["projections"].get("periods"):
        periods = [
            ProjectionPeriod(
                year=p["year"],
                revenue=Decimal(str(p["revenue"])),
                ebitda=Decimal(str(p["ebitda"])) if p.get("ebitda") else None,
                growth_rate=p.get("growth_rate"),
            )
            for p in data["projections"]["periods"]
        ]
        projections = FinancialProjections(
            periods=periods,
            discount_rate=data["projections"].get("discount_rate"),
        )

    return CompanyInput(
        name=data["name"],
        stage=CompanyStage(data["stage"]),
        sector=data["sector"],
        revenue_status=RevenueStatus(data["revenue_status"]),
        last_round=last_round,
        current_revenue=Decimal(str(data["current_revenue"])) if data.get("current_revenue") else None,
        cap_table=data.get("cap_table"),
        financials=data.get("financials"),
        projections=projections,
        qualitative=data.get("qualitative"),
        external_mapping=data.get("external_mapping"),
        auditor_notes=data.get("auditor_notes"),
    )


# ── Demo data ───────────────────────────────────────────────────────────

DEMO_COMPANY = {
    "name": "Acme AI",
    "stage": "series_a",
    "sector": "information_technology",
    "revenue_status": "growing_revenue",
    "current_revenue": "5000000",
    "last_round": {
        "date": "2025-06-01",
        "pre_money_valuation": "30000000",
        "amount_raised": "10000000",
        "lead_investor": "Sequoia Capital"
    },
    "financials": {
        "current_revenue": "5000000",
        "revenue_at_last_round": "2500000",
        "gross_margin": "0.72",
        "runway_months": 18
    },
    "qualitative": {
        "board_plan_status": "exceeded",
        "customer_concentration": "low",
        "regulatory_risk": "low"
    },
    "cap_table": {
        "security_type": "Series A Preferred",
        "liquidation_preferences": "1x non-participating",
        "option_pool_pct": "15"
    },
}


# ── Commands ────────────────────────────────────────────────────────────

def cmd_demo(_args) -> None:
    """Run the built-in example company through the valuation engine."""
    company = parse_company_input(DEMO_COMPANY)
    result = run_valuation(company)
    print_result(result, name="Acme AI")


def cmd_value(args) -> None:
    """Value a single company from a JSON file."""
    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        with open(args.input) as f:
            data = json.load(f)

    company = parse_company_input(data)
    val_date = date.fromisoformat(args.date) if args.date else date.today()
    result = run_valuation(company, valuation_date=val_date)

    if args.json:
        import dataclasses

        def _json_safe(obj):
            if obj is None: return None
            if isinstance(obj, dict): return {k: _json_safe(v) for k, v in obj.items()}
            if isinstance(obj, list): return [_json_safe(v) for v in obj]
            if isinstance(obj, Decimal): return str(obj)
            if hasattr(obj, "isoformat"): return obj.isoformat()
            if hasattr(obj, "value") and not isinstance(obj, (str, int, float, bool)): return obj.value
            if dataclasses.is_dataclass(obj) and not isinstance(obj, type): return _json_safe(dataclasses.asdict(obj))
            return obj

        output = {
            "fair_value": str(result.fair_value),
            "fair_value_low": str(result.fair_value_low),
            "fair_value_high": str(result.fair_value_high),
            "primary_method": result.primary_method.value,
            "explanation": result.explanation,
            "reasoning_trace": result.reasoning_trace,
            "method_results": _json_safe([dataclasses.asdict(r) for r in result.method_results]),
            "audit_trail": _json_safe(dataclasses.asdict(result.audit_trail)),
        }
        json.dump(output, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print_result(result, name=data.get("name", ""))


def cmd_batch(args) -> None:
    """Value an entire portfolio from an Excel or CSV file."""
    from services.batch_service import parse_batch_file, run_batch_valuation, generate_batch_template
    from db.session import engine, Base
    from sqlalchemy.orm import Session as SASession

    Base.metadata.create_all(engine)

    with open(args.file, "rb") as f:
        content = f.read()

    companies = parse_batch_file(args.file, content)
    if not companies:
        print(_red("  No companies found in file."))
        return

    print(f"  {_dim(f'Parsed {len(companies)} companies from')} {os.path.basename(args.file)}")
    print(f"  {_dim('Running valuations...')}")

    with SASession(engine) as db:
        results = run_batch_valuation(
            db=db,
            companies_data=companies,
            created_by=args.user or "CLI",
            valuation_date=date.fromisoformat(args.date) if args.date else None,
        )

    if args.json:
        json.dump({"total": len(results), "results": results}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print_batch_summary(results)


def cmd_template(args) -> None:
    """Save the batch import template to disk."""
    from services.batch_service import generate_batch_template
    out = args.output or "valcalc-batch-template.xlsx"
    content = generate_batch_template()
    with open(out, "wb") as f:
        f.write(content)
    print(f"  Template saved to {_green(out)}")


def cmd_test(_args) -> None:
    """Run the test suite."""
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
    sys.exit(result.returncode)


def cmd_example(_args) -> None:
    """Print example JSON input."""
    json.dump(DEMO_COMPANY, sys.stdout, indent=2)
    sys.stdout.write("\n")


def cmd_refresh(args) -> None:
    """Refresh benchmark data from market data APIs."""
    import logging
    if args.verbose:
        logging.basicConfig(level=logging.INFO, format="  %(message)s")
    else:
        logging.basicConfig(level=logging.WARNING, format="  %(message)s")

    from valuation_engine.market_data.refresh import refresh_benchmarks

    print(f"  {_dim('Refreshing benchmarks from market data sources...')}")
    print()

    # Show which sources are available
    from valuation_engine.market_data import finnhub_client, alphavantage
    sources = ["SEC EDGAR (free)", "Kaggle investment data"]
    if finnhub_client.is_available():
        sources.append("Finnhub")
    else:
        print(f"  {_yellow('Finnhub:')} no API key (set FINNHUB_API_KEY)")
    if alphavantage.is_available():
        sources.append("Alpha Vantage")
    else:
        print(f"  {_yellow('Alpha Vantage:')} no API key (set ALPHAVANTAGE_API_KEY)")

    print(f"  {_dim('Sources:')} {', '.join(sources)}")
    print()

    result = refresh_benchmarks()
    if not result:
        print(f"  {_yellow('No data fetched. Existing benchmarks unchanged.')}")
        return

    meta = result["metadata"]
    sectors = result["sectors"]
    print(f"  {_green('Benchmarks updated')}")
    print(f"  {_dim('Version:')} {meta['version']}")
    print(f"  {_dim('Source:')} {meta['source']}")
    print(f"  {_dim('Sectors:')} {len(sectors)}")
    print()

    # Show a summary table
    print(f"  {_dim(f'{'Sector':<28s}  {'Rev Mult':>10s}  {'Growth':>8s}  {'Trend':>8s}')}")
    print(f"  {_dim('─' * 60)}")
    for key, s in sectors.items():
        rm = s.get("revenue_multiple", {})
        med = rm.get("median", "?")
        gr = s.get("median_growth_rate", 0)
        tr = s.get("sector_trend_factor", 0)
        print(f"  {s['display_name']:<28s}  {str(med) + 'x':>10s}  {gr:>7.0%}  {tr:>+7.2%}")
    print()


# ── Main ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="valcalc",
        description="ValCalc — value private companies from the command line",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python cli.py demo                        Run built-in example
  python cli.py batch portfolio.xlsx        Value a full portfolio
  python cli.py value company.json          Value one company (JSON)
  python cli.py value company.json --json   Output raw JSON
  python cli.py template                    Download batch template
  python cli.py example                     Print example JSON input
  python cli.py test                        Run test suite
  python cli.py refresh                     Refresh benchmarks from live APIs""",
    )
    sub = parser.add_subparsers(dest="command")

    # demo
    p_demo = sub.add_parser("demo", help="Run built-in example valuation")
    p_demo.set_defaults(func=cmd_demo)

    # value
    p_val = sub.add_parser("value", help="Value a single company from JSON")
    p_val.add_argument("input", nargs="?", default="-", help="JSON file path, or '-' for stdin")
    p_val.add_argument("--json", action="store_true", help="Output raw JSON")
    p_val.add_argument("--date", type=str, default=None, help="Valuation date (YYYY-MM-DD)")
    p_val.set_defaults(func=cmd_value)

    # batch
    p_batch = sub.add_parser("batch", help="Value a portfolio from Excel/CSV")
    p_batch.add_argument("file", help="Excel (.xlsx) or CSV file path")
    p_batch.add_argument("--json", action="store_true", help="Output raw JSON")
    p_batch.add_argument("--date", type=str, default=None, help="Valuation date (YYYY-MM-DD)")
    p_batch.add_argument("--user", type=str, default=None, help="Created-by name (default: CLI)")
    p_batch.set_defaults(func=cmd_batch)

    # template
    p_tmpl = sub.add_parser("template", help="Save batch template Excel to disk")
    p_tmpl.add_argument("-o", "--output", type=str, help="Output path (default: valcalc-batch-template.xlsx)")
    p_tmpl.set_defaults(func=cmd_template)

    # example
    p_ex = sub.add_parser("example", help="Print example company JSON")
    p_ex.set_defaults(func=cmd_example)

    # test
    p_test = sub.add_parser("test", help="Run the test suite")
    p_test.set_defaults(func=cmd_test)

    # refresh
    p_refresh = sub.add_parser("refresh", help="Refresh benchmarks from market data APIs")
    p_refresh.add_argument("-v", "--verbose", action="store_true", help="Show detailed progress")
    p_refresh.set_defaults(func=cmd_refresh)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
