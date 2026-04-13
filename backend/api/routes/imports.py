from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from db.session import get_db
from services.document_parser import parse_upload, generate_template
from services.batch_service import parse_batch_file, run_batch_valuation, generate_batch_template

router = APIRouter(prefix="/api/v1/import", tags=["import"])


@router.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """Parse an uploaded Excel or CSV file and return extracted company data.

    Returns a JSON object with fields matching the company create/update schema.
    The frontend can use these values to pre-populate form fields.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    try:
        result = parse_upload(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Ensure it follows the expected format.")

    if not result:
        raise HTTPException(status_code=422, detail="No data could be extracted from the file. Check column headers match the template.")

    return result


@router.get("/template")
def download_template():
    """Download a sample Excel template for single-company data import."""
    content = generate_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=valcalc-import-template.xlsx"},
    )


@router.get("/batch-template")
def download_batch_template():
    """Download an Excel template for bulk multi-company import."""
    content = generate_batch_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=valcalc-batch-template.xlsx"},
    )


@router.post("/batch")
async def batch_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a multi-company Excel/CSV file. Creates companies and runs valuations.

    Returns a list of results, one per company, with fair values and method breakdowns.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    try:
        companies_data = parse_batch_file(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not companies_data:
        raise HTTPException(status_code=422, detail="No companies could be parsed from the file.")

    # Extract created_by from first company or default
    created_by = "Batch Import"

    results = run_batch_valuation(
        db=db,
        companies_data=companies_data,
        created_by=created_by,
    )

    return {
        "total": len(companies_data),
        "succeeded": sum(1 for r in results if r["status"] == "ok"),
        "failed": sum(1 for r in results if r["status"] == "error"),
        "results": results,
    }
