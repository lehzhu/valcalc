import json
from pathlib import Path
from fastapi import APIRouter, Body
from api.schemas import BenchmarkOut, BenchmarkSector
from valuation_engine.benchmarks.loader import load_benchmarks, list_sectors, clear_cache, _DATA_DIR

router = APIRouter(prefix="/api/v1/benchmarks", tags=["benchmarks"])


@router.get("", response_model=BenchmarkOut)
def get_benchmarks():
    return load_benchmarks()


@router.get("/sectors", response_model=list[BenchmarkSector])
def get_sectors():
    return list_sectors()


@router.put("")
def upload_benchmarks(data: dict = Body(...)):
    """Upload new benchmark data. Expects full benchmark JSON with metadata.version field."""
    version = data.get("metadata", {}).get("version", "unknown")
    path = _DATA_DIR / f"benchmarks-{version}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    clear_cache()
    return {"status": "ok", "version": version, "path": str(path)}
