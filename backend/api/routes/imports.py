from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import io

from services.document_parser import parse_upload, generate_template

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
    """Download a sample Excel template for data import."""
    content = generate_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=valcalc-import-template.xlsx"},
    )
