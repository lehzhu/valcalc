def _create_company(client, **overrides):
    defaults = {
        "name": "Test Co",
        "stage": "series_a",
        "sector": "b2b_saas",
        "revenue_status": "growing_revenue",
        "current_revenue": "5000000",
        "created_by": "Alice",
    }
    defaults.update(overrides)
    resp = client.post("/api/v1/companies", json=defaults)
    return resp.json()["id"]


def test_run_valuation(client):
    company_id = _create_company(client)
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={
        "created_by": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["primary_method"] == "comps"
    assert float(data["fair_value"]) > 0
    assert data["version"] == 1
    assert data["audit_trail"] is not None


def test_valuation_versioning(client):
    company_id = _create_company(client)
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    assert resp.json()["version"] == 2


def test_list_valuations_for_company(client):
    company_id = _create_company(client)
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Bob"})

    resp = client.get(f"/api/v1/companies/{company_id}/valuations")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_valuation_detail(client):
    company_id = _create_company(client)
    create_resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    val_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/valuations/{val_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "method_results" in data
    assert "audit_trail" in data


def test_override_valuation(client):
    company_id = _create_company(client)
    create_resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    val_id = create_resp.json()["id"]

    resp = client.post(f"/api/v1/valuations/{val_id}/override", json={
        "fair_value": "60000000",
        "justification": "Recent comparable transaction at higher multiple",
        "created_by": "Alice",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["fair_value"] == "60000000.00"
    assert data["overrides"] is not None


def test_pre_revenue_valuation(client):
    company_id = _create_company(
        client,
        name="Pre Rev",
        stage="seed",
        revenue_status="pre_revenue",
        current_revenue=None,
        last_round={
            "date": "2025-06-01",
            "pre_money_valuation": "10000000",
            "amount_raised": "3000000",
        },
    )
    resp = client.post(f"/api/v1/companies/{company_id}/valuations", json={"created_by": "Alice"})
    assert resp.status_code == 201
    assert resp.json()["primary_method"] == "last_round_adjusted"
