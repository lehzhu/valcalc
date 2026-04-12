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
