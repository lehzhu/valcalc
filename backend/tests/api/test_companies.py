def test_create_user(client):
    resp = client.post("/api/v1/users", json={"name": "Alice", "email": "alice@audit.com"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice"


def test_list_users(client):
    client.post("/api/v1/users", json={"name": "Alice", "email": "alice@audit.com"})
    resp = client.get("/api/v1/users")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_create_company(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Acme Corp",
        "stage": "seed",
        "sector": "information_technology",
        "revenue_status": "pre_revenue",
        "created_by": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Acme Corp"
    assert data["id"] is not None


def test_create_company_with_round(client):
    resp = client.post("/api/v1/companies", json={
        "name": "Beta Inc",
        "stage": "series_a",
        "sector": "financials",
        "revenue_status": "growing_revenue",
        "current_revenue": "5000000",
        "last_round": {
            "date": "2025-06-01",
            "pre_money_valuation": "30000000",
            "amount_raised": "10000000",
            "lead_investor": "Sequoia",
        },
        "created_by": "Bob",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["last_round_valuation"] == "30000000.00"


def test_list_companies(client):
    client.post("/api/v1/companies", json={
        "name": "Co 1", "stage": "seed", "sector": "information_technology",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    client.post("/api/v1/companies", json={
        "name": "Co 2", "stage": "series_c_plus", "sector": "financials",
        "revenue_status": "scaled_revenue", "created_by": "Alice",
    })
    resp = client.get("/api/v1/companies")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "information_technology",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.get(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme"


def test_update_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "information_technology",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.put(f"/api/v1/companies/{company_id}", json={"name": "Acme 2.0"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme 2.0"


def test_delete_company(client):
    create_resp = client.post("/api/v1/companies", json={
        "name": "Acme", "stage": "seed", "sector": "information_technology",
        "revenue_status": "pre_revenue", "created_by": "Alice",
    })
    company_id = create_resp.json()["id"]
    resp = client.delete(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 204
    resp = client.get(f"/api/v1/companies/{company_id}")
    assert resp.status_code == 404
