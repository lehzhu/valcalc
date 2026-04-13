from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import Valuation, Company
from services.export_service import export_json, export_xlsx

router = APIRouter(prefix="/api/v1/valuations", tags=["exports"])


def _load(valuation_id: UUID, db: Session):
    valuation = db.query(Valuation).filter(Valuation.id == valuation_id).first()
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    company = db.query(Company).filter(Company.id == valuation.company_id).first()
    return valuation, company


@router.get("/{valuation_id}/export/json")
def export_as_json(
    valuation_id: UUID,
    include_justification: bool = Query(True),
    db: Session = Depends(get_db),
):
    valuation, company = _load(valuation_id, db)
    return export_json(valuation, company, include_justification=include_justification)


@router.get("/{valuation_id}/export/xlsx")
def export_as_xlsx(
    valuation_id: UUID,
    include_justification: bool = Query(True),
    db: Session = Depends(get_db),
):
    valuation, company = _load(valuation_id, db)
    content = export_xlsx(valuation, company, include_justification=include_justification)
    filename = f"valuation-{company.name.replace(' ', '_')}-v{valuation.version}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{valuation_id}/export/pdf")
def export_as_pdf(
    valuation_id: UUID,
    include_justification: bool = Query(True),
    db: Session = Depends(get_db),
):
    valuation, company = _load(valuation_id, db)
    html = _build_pdf_html(valuation, company, include_justification)

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="PDF generation failed: ensure WeasyPrint dependencies are installed",
        )

    filename = f"valuation-{company.name.replace(' ', '_')}-v{valuation.version}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _format_snapshot_val(val) -> str:
    if val is None:
        return "\u2014"
    if isinstance(val, dict):
        return ", ".join(f"{k}: {v}" for k, v in val.items())
    return str(val)


def _build_pdf_html(valuation, company, include_justification: bool = True) -> str:
    trail = valuation.audit_trail or {}

    # Build method sections
    methods_html = ""
    for mr in valuation.method_results:
        steps_html = ""
        for step in mr.get("steps", []):
            inputs_str = ", ".join(f"{k}: {v}" for k, v in step.get("inputs", {}).items())
            steps_html += (
                f"<tr><td>{step['description']}</td>"
                f"<td><code>{step['formula']}</code></td>"
                f"<td>{inputs_str}</td>"
                f"<td><strong>{step['output']}</strong></td></tr>"
            )

        method_label = mr["method"].replace("_", " ").title()
        primary_tag = ' <span class="primary-tag">PRIMARY</span>' if mr.get("is_primary") else ""
        methods_html += f"""
        <h3>{method_label}{primary_tag}</h3>
        <table><tr><th>Step</th><th>Formula</th><th>Inputs</th><th>Result</th></tr>{steps_html}</table>
        """

        if include_justification:
            assumptions_html = ""
            for a in mr.get("assumptions", []):
                assumptions_html += (
                    f"<tr><td>{a['name']}</td><td>{a['value']}</td>"
                    f"<td>{a.get('rationale', '')}</td><td>{a.get('source', '')}</td></tr>"
                )
            if assumptions_html:
                methods_html += f"""
                <h4>Assumptions &amp; Justifications</h4>
                <table><tr><th>Assumption</th><th>Value</th><th>Rationale</th><th>Source</th></tr>{assumptions_html}</table>
                """

    # Method weights
    weights_html = ""
    if trail.get("method_weights"):
        items = ", ".join(
            f"{k.replace('_', ' ').title()}: {v:.0%}"
            for k, v in trail["method_weights"].items() if v > 0
        )
        weights_html = f"<p><strong>Method Weights:</strong> {items}</p>"

    # Audit trail section
    audit_html = ""
    if include_justification:
        snapshot_rows = "".join(
            f"<tr><td>{k.replace('_', ' ').title()}</td><td>{_format_snapshot_val(v)}</td></tr>"
            for k, v in trail.get("input_snapshot", {}).items()
        )
        audit_html = f"""
        <h2>Audit Trail</h2>
        <p><strong>Method Selection:</strong> {trail.get('method_selection_rationale', 'N/A')}</p>
        <p><strong>Benchmark Version:</strong> {trail.get('benchmark_version', 'N/A')}</p>
        <p><strong>Engine Version:</strong> {trail.get('engine_version', 'N/A')}</p>

        <h3>Input Snapshot</h3>
        <table>
        <tr><th>Field</th><th>Value</th></tr>
        {snapshot_rows}
        </table>
        """

    return f"""
    <html>
    <head><style>
        @page {{ size: A4; margin: 30px 40px; }}
        body {{ font-family: Inter, Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 11px; line-height: 1.5; }}
        h1 {{ color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; font-size: 20px; }}
        h2 {{ color: #475569; margin-top: 20px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }}
        h3 {{ color: #4f46e5; font-size: 12px; margin-top: 16px; }}
        h4 {{ color: #64748b; font-size: 11px; margin: 8px 0 4px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10px; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }}
        th {{ background: #f8fafc; font-weight: 600; color: #475569; }}
        code {{ font-size: 9px; color: #64748b; }}
        .value {{ font-size: 28px; font-weight: 700; color: #4f46e5; margin: 4px 0; }}
        .range {{ color: #64748b; font-size: 12px; }}
        .meta {{ color: #64748b; font-size: 10px; }}
        .primary-tag {{ background: #4f46e5; color: white; padding: 1px 6px; border-radius: 3px; font-size: 9px; }}
        .summary-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; }}
    </style></head>
    <body>
        <h1>Valuation Memo &mdash; {company.name}</h1>
        <p class="meta">Version {valuation.version} &bull; {valuation.created_at.strftime('%B %d, %Y')} &bull; Prepared by {valuation.created_by}</p>

        <div class="summary-box">
            <p class="value">${valuation.fair_value:,.0f}</p>
            <p class="range">Range: ${valuation.fair_value_low:,.0f} &ndash; ${valuation.fair_value_high:,.0f}</p>
            <p style="margin-top: 8px;">Method: {valuation.primary_method.replace('_', ' ').title()}</p>
            <p style="margin-top: 4px; color: #475569;">{valuation.explanation}</p>
        </div>

        <h2>Methodology</h2>
        {weights_html}
        {methods_html}

        {audit_html}
    </body>
    </html>
    """
