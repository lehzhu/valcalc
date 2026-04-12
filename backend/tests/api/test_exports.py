def _setup_valuation(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Export Test Co",
        "stage": "series_a_plus",
        "sector": "b2b_saas",
        "revenue_status": "early_revenue",
        "current_revenue": "5000000",
        "created_by": "Alice",
    })
    company_id = resp.json()["id"]
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    return resp.json()["id"]


def test_export_json(client):
    val_id = _setup_valuation(client)
    resp = client.get(f"/api/v1/valuations/{val_id}/export/json")
    assert resp.status_code == 200
    data = resp.json()
    assert "company" in data
    assert "valuation" in data
    assert data["company"]["name"] == "Export Test Co"


def test_export_xlsx(client):
    val_id = _setup_valuation(client)
    resp = client.get(f"/api/v1/valuations/{val_id}/export/xlsx")
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers["content-type"]


def test_get_benchmarks(client):
    resp = client.get("/api/v1/benchmarks")
    assert resp.status_code == 200
    data = resp.json()
    assert "sectors" in data
    assert "b2b_saas" in data["sectors"]


def test_get_sectors(client):
    resp = client.get("/api/v1/benchmarks/sectors")
    assert resp.status_code == 200
    sectors = resp.json()
    assert len(sectors) == 10
    assert any(s["key"] == "b2b_saas" for s in sectors)
