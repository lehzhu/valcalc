"""Focused regression tests for batch rollback, rich import fields, and override persistence."""
import io
import openpyxl
from db.models import Company


def _make_batch_xlsx(rows: list[list]) -> bytes:
    """Build a minimal batch xlsx in memory. First row is headers."""
    wb = openpyxl.Workbook()
    ws = wb.active
    for r_idx, row in enumerate(rows, 1):
        for c_idx, val in enumerate(row, 1):
            ws.cell(row=r_idx, column=c_idx, value=val)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── 1. Failed batch row does not persist a ghost company ────────────

def test_failed_batch_row_does_not_persist_company(client, db_session):
    """A row that fails valuation should leave no company record behind."""
    content = _make_batch_xlsx([
        ["Company Name", "Stage", "Sector", "Revenue Status", "Current Annual Revenue",
         "Last Round Date", "Pre-Money Valuation", "Amount Raised"],
        # Good row — has round data, will succeed
        ["Good Co", "series_a", "information_technology", "growing_revenue",
         "5000000", "2025-06-01", "30000000", "10000000"],
        # Bad row — invalid stage will cause engine to blow up
        ["Bad Co", "INVALID_STAGE", "information_technology", "growing_revenue",
         "5000000", "2025-06-01", "30000000", "10000000"],
    ])

    resp = client.post(
        "/api/v1/import/batch",
        files={"file": ("test.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"created_by": "Tester"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["succeeded"] == 1
    assert data["failed"] == 1

    # The good company exists
    companies = db_session.query(Company).all()
    names = [c.name for c in companies]
    assert "Good Co" in names
    # The bad company must NOT exist
    assert "Bad Co" not in names


# ── 2. Single-company import preserves rich calibration fields ──────

def test_create_company_preserves_rich_fields(client):
    """financials, qualitative, cap_table, and external_mapping round-trip through create."""
    body = {
        "name": "Rich Co",
        "stage": "series_a",
        "sector": "information_technology",
        "revenue_status": "growing_revenue",
        "current_revenue": "5000000",
        "created_by": "Alice",
        "financials": {
            "revenue_at_last_round": "2500000",
            "gross_margin": "0.72",
            "runway_months": 18,
        },
        "qualitative": {
            "board_plan_status": "exceeded",
            "customer_concentration": "low",
            "regulatory_risk": "low",
        },
        "cap_table": {
            "security_type": "Series A Preferred",
            "liquidation_preferences": "1x non-participating",
            "option_pool_pct": "15",
        },
        "external_mapping": {
            "index_movement_pct": "0.05",
        },
    }
    resp = client.post("/api/v1/companies", json=body)
    assert resp.status_code == 201
    created = resp.json()

    # Verify all rich fields persisted
    assert created["financials"]["gross_margin"] == "0.72"
    assert created["qualitative"]["board_plan_status"] == "exceeded"
    assert created["cap_table"]["security_type"] == "Series A Preferred"
    assert created["external_mapping"]["index_movement_pct"] == "0.05"

    # Verify they survive a GET round-trip
    get_resp = client.get(f"/api/v1/companies/{created['id']}")
    fetched = get_resp.json()
    assert fetched["financials"]["runway_months"] == 18
    assert fetched["qualitative"]["customer_concentration"] == "low"
    assert fetched["cap_table"]["option_pool_pct"] == "15"


# ── 3. Override persists into valuation audit trail ─────────────────

def test_override_persists_prior_value_in_audit_trail(client):
    """An override must record the prior computed value and method in the audit trail."""
    # Create company with round data so last_round_adjusted runs
    resp = client.post("/api/v1/companies", json={
        "name": "Override Co",
        "stage": "series_a",
        "sector": "information_technology",
        "revenue_status": "growing_revenue",
        "current_revenue": "5000000",
        "last_round": {
            "date": "2025-06-01",
            "pre_money_valuation": "30000000",
            "amount_raised": "10000000",
        },
        "created_by": "Alice",
    })
    company_id = resp.json()["id"]

    # Run a valuation
    val_resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={
        "created_by": "Alice",
    })
    val = val_resp.json()
    val_id = val["id"]
    original_value = val["fair_value"]
    original_method = val["primary_method"]

    # Override it
    override_resp = client.post(f"/api/v1/valuations/{val_id}/override", json={
        "fair_value": "99000000",
        "justification": "Comparable M&A transaction",
        "created_by": "Bob",
    })
    assert override_resp.status_code == 200
    overridden = override_resp.json()

    # Method changed to manual
    assert overridden["primary_method"] == "manual"
    assert overridden["fair_value"] == "99000000.00"

    # Overrides dict records prior state
    assert overridden["overrides"]["prior_value"] == original_value
    assert overridden["overrides"]["prior_method"] == original_method
    assert overridden["overrides"]["justification"] == "Comparable M&A transaction"
    assert overridden["overrides"]["applied_by"] == "Bob"

    # Reasoning trace reflects the override
    trace = overridden["reasoning_trace"]
    assert trace["conclusion"]["method"] == "manual"
    assert "Bob" in trace["method_selection"]["rationale"]
