"""CLI entry point for the valuation engine.

Accepts a JSON file (or stdin) with company data, runs the valuation,
and prints the full reasoning trace to stdout.

Usage:
    python cli.py company.json
    python cli.py --example          # print example input JSON
    cat company.json | python cli.py -
"""
import argparse
import json
import sys
from datetime import date
from decimal import Decimal

from valuation_engine.models import (
    CompanyInput, CompanyStage, RevenueStatus,
    FundingRound, FinancialProjections, ProjectionPeriod,
)
from valuation_engine.engine import run_valuation


EXAMPLE_INPUT = {
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
    "projections": {
        "periods": [
            {"year": 2026, "revenue": "8000000", "ebitda": "1000000"},
            {"year": 2027, "revenue": "14000000", "ebitda": "3000000"},
            {"year": 2028, "revenue": "22000000", "ebitda": "6000000"}
        ]
    }
}


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


def format_reasoning_trace(trace: dict) -> str:
    """Format the reasoning trace as readable text output."""
    lines: list[str] = []
    sep = "=" * 72

    # ── Conclusion (shown first) ─────────────────────────────
    conclusion = trace["conclusion"]
    lines.append(sep)
    lines.append(f"  FAIR VALUE ESTIMATE: {conclusion['fair_value_display']}")
    lines.append(f"  Range: {conclusion['range']}")
    lines.append(f"  Method: {conclusion['method_display']}")
    lines.append(sep)
    lines.append("")
    lines.append(f"  {conclusion['summary']}")
    lines.append("")

    # ── Method Selection ─────────────────────────────────────
    ms = trace["method_selection"]
    lines.append("─── Method Selection " + "─" * 51)
    lines.append(f"  Primary: {ms['primary'].replace('_', ' ').title()}")
    lines.append(f"  Rationale: {ms['rationale']}")
    if ms["secondary_methods"]:
        for sm in ms["secondary_methods"]:
            lines.append(f"  Cross-check: {sm['method'].replace('_', ' ').title()} → {sm['range']}")
    lines.append("")

    # ── Calibration Steps (reversed: conclusion → anchor) ────
    lines.append("─── Calibration Steps (conclusion → anchor) " + "─" * 27)
    for step in trace["calibration_steps"]:
        lines.append(f"")
        lines.append(f"  Step {step['order']}: {step['description']}")
        lines.append(f"    Equation:  {step['equation']}")
        for k, v in step["working"].items():
            lines.append(f"    {k:.<30s} {v}")
        lines.append(f"    ────────────────────────────────")
        lines.append(f"    Result:    {step['result']}")

    lines.append("")

    # ── Assumptions ──────────────────────────────────────────
    lines.append("─── Assumptions " + "─" * 56)
    for a in trace["assumptions_table"]:
        override_flag = " [overrideable]" if a["overrideable"] else " [fixed]"
        lines.append(f"  {a['name']}: {a['value']}{override_flag}")
        lines.append(f"    Rationale: {a['rationale']}")
        lines.append(f"    Source: {a['source']}")
    lines.append("")

    # ── Data Sources ─────────────────────────────────────────
    lines.append("─── Data Sources " + "─" * 55)
    for s in trace["data_sources"]:
        lines.append(f"  • {s['name']} ({s['version']}, effective {s['effective_date']})")
    lines.append("")
    lines.append(sep)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Run valuation engine on company data (JSON input)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python cli.py --example > company.json\n  python cli.py company.json",
    )
    parser.add_argument("input", nargs="?", default="-",
                        help="Path to JSON file, or '-' for stdin")
    parser.add_argument("--example", action="store_true",
                        help="Print example input JSON and exit")
    parser.add_argument("--json", action="store_true",
                        help="Output raw JSON instead of formatted text")
    parser.add_argument("--valuation-date", type=str, default=None,
                        help="Valuation date (YYYY-MM-DD), defaults to today")
    args = parser.parse_args()

    if args.example:
        json.dump(EXAMPLE_INPUT, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return

    # Read input
    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        with open(args.input) as f:
            data = json.load(f)

    # Parse
    company = parse_company_input(data)

    # Run
    val_date = date.fromisoformat(args.valuation_date) if args.valuation_date else date.today()
    result = run_valuation(company, valuation_date=val_date)

    if args.json:
        # JSON output: include everything
        from valuation_engine.explanation import _format_currency
        import dataclasses

        def _json_safe(obj):
            if obj is None:
                return None
            if isinstance(obj, dict):
                return {k: _json_safe(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_json_safe(v) for v in obj]
            if isinstance(obj, Decimal):
                return str(obj)
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            if hasattr(obj, "value") and not isinstance(obj, (str, int, float, bool)):
                return obj.value
            if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
                return _json_safe(dataclasses.asdict(obj))
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
        # Formatted text output
        print(format_reasoning_trace(result.reasoning_trace))


if __name__ == "__main__":
    main()
