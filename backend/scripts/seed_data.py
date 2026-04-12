"""Seed the database with sample companies and run valuations for demo purposes."""
import sys
sys.path.insert(0, ".")

from datetime import date
from decimal import Decimal
from db.session import SessionLocal, engine
from db.models import Base, User, Company
from services.valuation_service import run_company_valuation

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Create demo user
user = User(name="Demo Auditor", email="demo@audit.com")
db.add(user)
db.commit()

# Company 1: Pre-revenue seed with round
c1 = Company(
    name="NeuralPath AI",
    stage="seed",
    sector="ai_ml",
    revenue_status="pre_revenue",
    last_round_date=date(2025, 8, 15),
    last_round_valuation=Decimal("12000000"),
    last_round_amount=Decimal("4000000"),
    last_round_investor="Andreessen Horowitz",
    auditor_notes="Strong founding team, ex-Google AI researchers. Early traction with 3 enterprise pilots.",
    created_by="Demo Auditor",
)
db.add(c1)
db.commit()
db.refresh(c1)
run_company_valuation(db, c1, "Demo Auditor")

# Company 2: Growing revenue SaaS (Series A, $4.2M ARR)
c2 = Company(
    name="CloudSecure Pro",
    stage="series_a",
    sector="cybersecurity",
    revenue_status="growing_revenue",
    current_revenue=Decimal("4200000"),
    last_round_date=date(2025, 3, 1),
    last_round_valuation=Decimal("35000000"),
    last_round_amount=Decimal("12000000"),
    last_round_investor="Accel",
    auditor_notes="SOC2 certified. 40+ enterprise customers. Net revenue retention >120%.",
    created_by="Demo Auditor",
)
db.add(c2)
db.commit()
db.refresh(c2)
run_company_valuation(db, c2, "Demo Auditor")

# Company 3: Series C+ with projections ($18M ARR)
c3 = Company(
    name="PayFlow",
    stage="series_c_plus",
    sector="fintech",
    revenue_status="scaled_revenue",
    current_revenue=Decimal("18000000"),
    last_round_date=date(2024, 11, 1),
    last_round_valuation=Decimal("120000000"),
    last_round_amount=Decimal("30000000"),
    last_round_investor="Tiger Global",
    projections={
        "periods": [
            {"year": 2026, "revenue": "27000000", "ebitda": "4000000", "growth_rate": 0.50},
            {"year": 2027, "revenue": "40000000", "ebitda": "8000000", "growth_rate": 0.48},
            {"year": 2028, "revenue": "56000000", "ebitda": "14000000", "growth_rate": 0.40},
            {"year": 2029, "revenue": "73000000", "ebitda": "22000000", "growth_rate": 0.30},
            {"year": 2030, "revenue": "88000000", "ebitda": "30000000", "growth_rate": 0.21},
        ],
    },
    auditor_notes="Category leader in SMB payments. Path to profitability clear by 2028.",
    created_by="Demo Auditor",
)
db.add(c3)
db.commit()
db.refresh(c3)
run_company_valuation(db, c3, "Demo Auditor")

db.close()
print("Seed data created: 3 companies with valuations")
