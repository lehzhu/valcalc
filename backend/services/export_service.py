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
