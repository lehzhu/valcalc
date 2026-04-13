"""Parse uploaded Excel / CSV files into structured company data.

Supports two document layouts:
  1. **Projections sheet** – columns: Year, Revenue, EBITDA, Growth Rate
  2. **Company summary sheet** – key-value pairs for round info, revenue, stage, sector

The parser auto-detects layout by scanning header rows.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import openpyxl


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_upload(filename: str, content: bytes) -> dict[str, Any]:
    """Parse an uploaded file and return extracted company data.

    Returns a dict with optional keys matching CompanyCreate / CompanyUpdate:
      - name, stage, sector, revenue_status
      - current_revenue
      - last_round: {date, pre_money_valuation, amount_raised, lead_investor}
      - projections: {periods: [{year, revenue, ebitda, growth_rate}, ...]}
    Only keys that were successfully extracted are included.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xlsx", "xls"):
        return _parse_excel(content)
    elif ext == "csv":
        return _parse_csv(content)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Upload .xlsx or .csv files.")


def generate_template() -> bytes:
    """Generate a sample Excel template with two sheets."""
    wb = openpyxl.Workbook()

    # Sheet 1 – Company Info
    ws1 = wb.active
    ws1.title = "Company Info"
    kv_rows = [
        ("Field", "Value", "Notes"),
        ("Company Name", "", "e.g., Acme Corp"),
        ("Stage", "", "pre_seed / seed / series_a / series_b / series_c_plus / late_pre_ipo"),
        ("Sector", "", "e.g., saas, fintech, healthtech, ai_ml (see API /benchmarks/sectors)"),
        ("Revenue Status", "", "pre_revenue / early_revenue / growing_revenue / scaled_revenue"),
        ("Current Annual Revenue", "", "e.g., 5000000"),
        ("Last Round Date", "", "YYYY-MM-DD"),
        ("Last Round Pre-Money Valuation", "", "e.g., 30000000"),
        ("Last Round Amount Raised", "", "e.g., 10000000"),
        ("Last Round Lead Investor", "", "e.g., Sequoia Capital"),
    ]
    for row in kv_rows:
        ws1.append(row)
    for col in range(1, 4):
        ws1.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 32

    # Sheet 2 – Projections
    ws2 = wb.create_sheet("Projections")
    ws2.append(("Year", "Revenue", "EBITDA", "Growth Rate (%)"))
    current_year = date.today().year
    for y in range(current_year + 1, current_year + 6):
        ws2.append((y, "", "", ""))
    for col in range(1, 5):
        ws2.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Excel parsing
# ---------------------------------------------------------------------------

def _parse_excel(content: bytes) -> dict[str, Any]:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    result: dict[str, Any] = {}

    for ws in wb.worksheets:
        title = ws.title.lower().strip()
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        # Detect layout from headers
        headers = [str(c).strip().lower() if c is not None else "" for c in rows[0]]

        if _is_projection_headers(headers):
            projections = _extract_projections_from_rows(headers, rows[1:])
            if projections:
                result["projections"] = {"periods": projections}
        elif _is_kv_layout(headers) or "company" in title or "info" in title or "summary" in title:
            kv = _extract_kv_from_rows(rows)
            result.update(kv)
        else:
            # Try projections first, fall back to kv
            projections = _extract_projections_from_rows(headers, rows[1:])
            if projections:
                result["projections"] = {"periods": projections}
            else:
                kv = _extract_kv_from_rows(rows)
                if kv:
                    result.update(kv)

    wb.close()
    return result


# ---------------------------------------------------------------------------
# CSV parsing
# ---------------------------------------------------------------------------

def _parse_csv(content: bytes) -> dict[str, Any]:
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise ValueError("Empty CSV file")

    headers = [c.strip().lower() for c in rows[0]]

    if _is_projection_headers(headers):
        projections = _extract_projections_from_rows(headers, [tuple(r) for r in rows[1:]])
        if projections:
            return {"projections": {"periods": projections}}
    # Fall back to key-value
    kv = _extract_kv_from_rows([tuple(r) for r in rows])
    return kv


# ---------------------------------------------------------------------------
# Layout detection
# ---------------------------------------------------------------------------

_PROJECTION_KEYWORDS = {"year", "revenue", "ebitda", "growth"}

def _is_projection_headers(headers: list[str]) -> bool:
    return len(set(headers) & _PROJECTION_KEYWORDS) >= 2


def _is_kv_layout(headers: list[str]) -> bool:
    return any(h in ("field", "key", "parameter", "item") for h in headers)


# ---------------------------------------------------------------------------
# Projection extraction
# ---------------------------------------------------------------------------

def _extract_projections_from_rows(
    headers: list[str], data_rows: list[tuple],
) -> list[dict[str, Any]]:
    col_map = {}
    for i, h in enumerate(headers):
        h_clean = h.replace(" ", "_").replace("(%)", "").strip("_")
        if "year" in h_clean:
            col_map["year"] = i
        elif "revenue" in h_clean and "growth" not in h_clean:
            col_map["revenue"] = i
        elif "ebitda" in h_clean:
            col_map["ebitda"] = i
        elif "growth" in h_clean:
            col_map["growth_rate"] = i

    if "year" not in col_map or "revenue" not in col_map:
        return []

    periods = []
    for row in data_rows:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        try:
            year = int(float(str(row[col_map["year"]])))
        except (ValueError, TypeError, IndexError):
            continue

        rev_raw = _cell_value(row, col_map["revenue"])
        if rev_raw is None:
            continue

        period: dict[str, Any] = {"year": year, "revenue": str(rev_raw)}

        if "ebitda" in col_map:
            ebitda = _cell_value(row, col_map["ebitda"])
            if ebitda is not None:
                period["ebitda"] = str(ebitda)

        if "growth_rate" in col_map:
            gr = _cell_value(row, col_map["growth_rate"])
            if gr is not None:
                # Normalize: if > 1, assume it's a percentage (e.g. 25 -> 0.25)
                if gr > 1:
                    gr = gr / 100
                period["growth_rate"] = float(gr)

        periods.append(period)

    return periods


# ---------------------------------------------------------------------------
# Key-value extraction
# ---------------------------------------------------------------------------

_FIELD_MAP = {
    "company name": "name",
    "name": "name",
    "stage": "stage",
    "sector": "sector",
    "industry": "sector",
    "revenue status": "revenue_status",
    "revenue_status": "revenue_status",
    "current revenue": "current_revenue",
    "current annual revenue": "current_revenue",
    "annual revenue": "current_revenue",
    "revenue": "current_revenue",
    "last round date": "lr_date",
    "round date": "lr_date",
    "funding date": "lr_date",
    "last round pre-money valuation": "lr_valuation",
    "last round valuation": "lr_valuation",
    "pre-money valuation": "lr_valuation",
    "pre money valuation": "lr_valuation",
    "pre-money": "lr_valuation",
    "last round amount raised": "lr_amount",
    "amount raised": "lr_amount",
    "round size": "lr_amount",
    "last round lead investor": "lr_investor",
    "lead investor": "lr_investor",
    "investor": "lr_investor",
}


def _extract_kv_from_rows(rows: list[tuple]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    lr: dict[str, Any] = {}

    for row in rows:
        if len(row) < 2:
            continue
        key = str(row[0]).strip().lower() if row[0] is not None else ""
        val = row[1]
        if not key or val is None or str(val).strip() == "":
            continue

        field = _FIELD_MAP.get(key)
        if not field:
            # Fuzzy: strip extra words
            for pattern, mapped in _FIELD_MAP.items():
                if pattern in key:
                    field = mapped
                    break
        if not field:
            continue

        val_str = str(val).strip()

        if field == "name":
            result["name"] = val_str
        elif field == "stage":
            result["stage"] = _normalize_stage(val_str)
        elif field == "sector":
            result["sector"] = _normalize_sector(val_str)
        elif field == "revenue_status":
            result["revenue_status"] = _normalize_revenue_status(val_str)
        elif field == "current_revenue":
            num = _parse_money(val_str)
            if num is not None:
                result["current_revenue"] = str(num)
        elif field == "lr_date":
            d = _parse_date(val_str)
            if d:
                lr["date"] = d.isoformat()
        elif field == "lr_valuation":
            num = _parse_money(val_str)
            if num is not None:
                lr["pre_money_valuation"] = str(num)
        elif field == "lr_amount":
            num = _parse_money(val_str)
            if num is not None:
                lr["amount_raised"] = str(num)
        elif field == "lr_investor":
            lr["lead_investor"] = val_str

    if lr.get("date") and lr.get("pre_money_valuation"):
        lr.setdefault("amount_raised", "0")
        result["last_round"] = lr

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cell_value(row: tuple, idx: int) -> Decimal | None:
    if idx >= len(row):
        return None
    val = row[idx]
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace("$", "").replace("%", "")
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _parse_money(s: str) -> Decimal | None:
    """Parse money strings like '$30M', '5,000,000', '10000000'."""
    s = s.strip().replace(",", "").replace("$", "")
    # Handle suffixes: K, M, B
    multiplier = 1
    if s.upper().endswith("B"):
        multiplier = 1_000_000_000
        s = s[:-1]
    elif s.upper().endswith("M"):
        multiplier = 1_000_000
        s = s[:-1]
    elif s.upper().endswith("K"):
        multiplier = 1_000
        s = s[:-1]
    try:
        return Decimal(s.strip()) * multiplier
    except (InvalidOperation, ValueError):
        return None


def _parse_date(s: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    # Try Excel serial date
    try:
        serial = int(float(s))
        if 30000 < serial < 60000:
            return datetime(1899, 12, 30) + __import__("datetime").timedelta(days=serial)
    except (ValueError, TypeError):
        pass
    return None


_STAGE_ALIASES = {
    "pre-seed": "pre_seed", "preseed": "pre_seed", "pre seed": "pre_seed",
    "seed": "seed",
    "series a": "series_a", "a": "series_a",
    "series b": "series_b", "b": "series_b",
    "series c": "series_c_plus", "series c+": "series_c_plus", "c": "series_c_plus", "c+": "series_c_plus",
    "series d": "series_c_plus", "series e": "series_c_plus",
    "late": "late_pre_ipo", "pre-ipo": "late_pre_ipo", "pre ipo": "late_pre_ipo",
    "late / pre-ipo": "late_pre_ipo", "ipo": "late_pre_ipo",
}

def _normalize_stage(s: str) -> str:
    s_lower = s.lower().strip()
    if s_lower in _STAGE_ALIASES:
        return _STAGE_ALIASES[s_lower]
    # Already a valid key?
    valid = {"pre_seed", "seed", "series_a", "series_b", "series_c_plus", "late_pre_ipo"}
    if s_lower.replace(" ", "_") in valid:
        return s_lower.replace(" ", "_")
    return s_lower


_REVENUE_ALIASES = {
    "pre-revenue": "pre_revenue", "pre revenue": "pre_revenue", "none": "pre_revenue",
    "early": "early_revenue", "early revenue": "early_revenue", "<$1m": "early_revenue",
    "growing": "growing_revenue", "growing revenue": "growing_revenue", "$1-10m": "growing_revenue",
    "scaled": "scaled_revenue", "scaled revenue": "scaled_revenue", ">$10m": "scaled_revenue",
}

def _normalize_revenue_status(s: str) -> str:
    s_lower = s.lower().strip()
    if s_lower in _REVENUE_ALIASES:
        return _REVENUE_ALIASES[s_lower]
    valid = {"pre_revenue", "early_revenue", "growing_revenue", "scaled_revenue"}
    if s_lower.replace(" ", "_") in valid:
        return s_lower.replace(" ", "_")
    return s_lower


def _normalize_sector(s: str) -> str:
    s_lower = s.lower().strip().replace(" ", "_").replace("-", "_").replace("/", "_")
    # Map common names to GICS sector keys
    aliases = {
        "it": "information_technology", "tech": "information_technology",
        "technology": "information_technology", "software": "information_technology",
        "saas": "information_technology", "b2b_saas": "information_technology",
        "ai": "information_technology", "ai_ml": "information_technology",
        "cybersecurity": "information_technology", "enterprise_software": "information_technology",
        "health": "healthcare", "biotech": "healthcare", "pharma": "healthcare",
        "healthtech": "healthcare", "healthcare_biotech": "healthcare",
        "finance": "financials", "financial": "financials", "fintech": "financials",
        "consumer": "consumer_discretionary", "retail": "consumer_discretionary",
        "ecommerce": "consumer_discretionary", "e_commerce": "consumer_discretionary",
        "ecommerce_marketplace": "consumer_discretionary",
        "media": "communication_services", "telecom": "communication_services",
        "consumer_tech": "communication_services",
        "clean_energy": "energy", "cleantech": "energy", "climate": "energy",
        "climate_cleantech": "energy",
        "hardware": "industrials", "manufacturing": "industrials",
        "hardware_iot": "industrials", "iot": "industrials",
    }
    return aliases.get(s_lower, s_lower)
