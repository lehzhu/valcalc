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


def seed(company_data: dict) -> None:
    c = Company(**company_data, created_by="Demo Auditor")
    db.add(c)
    db.commit()
    db.refresh(c)
    run_company_valuation(db, c, "Demo Auditor")
    print(f"  + {c.name} ({c.stage} / {c.sector})")


# --- 1. Pre-Seed, Pre-Revenue, Information Technology (no round -> manual fallback) ---
seed({
    "name": "Cortex Labs",
    "stage": "pre_seed",
    "sector": "information_technology",
    "revenue_status": "pre_revenue",
    "auditor_notes": "Two-person team, prototype only. Valued based on comparable pre-seed rounds in IT.",
})

# --- 2. Seed, Pre-Revenue, Information Technology (with round) ---
seed({
    "name": "NeuralPath AI",
    "stage": "seed",
    "sector": "information_technology",
    "revenue_status": "pre_revenue",
    "last_round_date": date(2025, 8, 15),
    "last_round_valuation": Decimal("12000000"),
    "last_round_amount": Decimal("4000000"),
    "last_round_investor": "Andreessen Horowitz",
    "auditor_notes": "AI infrastructure startup. Strong founding team, ex-Google researchers. 3 enterprise pilots.",
})

# --- 3. Seed, Early Revenue, Communication Services ---
seed({
    "name": "Glow Social",
    "stage": "seed",
    "sector": "communication_services",
    "revenue_status": "early_revenue",
    "current_revenue": Decimal("350000"),
    "last_round_date": date(2025, 5, 20),
    "last_round_valuation": Decimal("8000000"),
    "last_round_amount": Decimal("2500000"),
    "last_round_investor": "Initialized Capital",
    "auditor_notes": "Social commerce platform. 50K MAU, early monetization via 3% take rate.",
})

# --- 4. Series A, Growing Revenue, Information Technology ---
seed({
    "name": "CloudSecure Pro",
    "stage": "series_a",
    "sector": "information_technology",
    "revenue_status": "growing_revenue",
    "current_revenue": Decimal("4200000"),
    "last_round_date": date(2025, 3, 1),
    "last_round_valuation": Decimal("35000000"),
    "last_round_amount": Decimal("12000000"),
    "last_round_investor": "Accel",
    "auditor_notes": "Cybersecurity SaaS. SOC2 certified. 40+ enterprise customers. NRR >120%.",
})

# --- 5. Series A, Early Revenue, Energy (old round -> time decay) ---
seed({
    "name": "SolarGrid Systems",
    "stage": "series_a",
    "sector": "energy",
    "revenue_status": "early_revenue",
    "current_revenue": Decimal("900000"),
    "last_round_date": date(2023, 6, 1),
    "last_round_valuation": Decimal("20000000"),
    "last_round_amount": Decimal("6000000"),
    "last_round_investor": "Breakthrough Energy",
    "auditor_notes": "Round is 3+ years old — significant time decay expected. Pivoted to B2B solar monitoring SaaS.",
})

# --- 6. Series B, Growing Revenue, Information Technology (with projections) ---
seed({
    "name": "DataPipe.io",
    "stage": "series_b",
    "sector": "information_technology",
    "revenue_status": "growing_revenue",
    "current_revenue": Decimal("9500000"),
    "last_round_date": date(2025, 1, 15),
    "last_round_valuation": Decimal("75000000"),
    "last_round_amount": Decimal("22000000"),
    "last_round_investor": "Index Ventures",
    "projections": {
        "periods": [
            {"year": 2027, "revenue": "16000000", "ebitda": "1500000", "growth_rate": 0.68},
            {"year": 2028, "revenue": "25000000", "ebitda": "5000000", "growth_rate": 0.56},
            {"year": 2029, "revenue": "36000000", "ebitda": "10000000", "growth_rate": 0.44},
            {"year": 2030, "revenue": "47000000", "ebitda": "16000000", "growth_rate": 0.31},
        ],
    },
    "auditor_notes": "Data integration platform. Strong PMF. CAC payback <12 months.",
})

# --- 7. Series B, Growing Revenue, Consumer Discretionary (negative EBITDA) ---
seed({
    "name": "ShopLocal Marketplace",
    "stage": "series_b",
    "sector": "consumer_discretionary",
    "revenue_status": "growing_revenue",
    "current_revenue": Decimal("7200000"),
    "last_round_date": date(2024, 9, 10),
    "last_round_valuation": Decimal("55000000"),
    "last_round_amount": Decimal("18000000"),
    "last_round_investor": "Lightspeed",
    "projections": {
        "periods": [
            {"year": 2027, "revenue": "12000000", "ebitda": "-2000000", "growth_rate": 0.67},
            {"year": 2028, "revenue": "20000000", "ebitda": "-500000", "growth_rate": 0.67},
            {"year": 2029, "revenue": "30000000", "ebitda": "3000000", "growth_rate": 0.50},
            {"year": 2030, "revenue": "42000000", "ebitda": "8000000", "growth_rate": 0.40},
        ],
    },
    "auditor_notes": "Local merchant marketplace. Burning cash on acquisition. Path to profitability in 2029.",
})

# --- 8. Series C+, Scaled Revenue, Financials (full data) ---
seed({
    "name": "PayFlow",
    "stage": "series_c_plus",
    "sector": "financials",
    "revenue_status": "scaled_revenue",
    "current_revenue": Decimal("18000000"),
    "last_round_date": date(2024, 11, 1),
    "last_round_valuation": Decimal("120000000"),
    "last_round_amount": Decimal("30000000"),
    "last_round_investor": "Tiger Global",
    "projections": {
        "periods": [
            {"year": 2027, "revenue": "27000000", "ebitda": "4000000", "growth_rate": 0.50},
            {"year": 2028, "revenue": "40000000", "ebitda": "8000000", "growth_rate": 0.48},
            {"year": 2029, "revenue": "56000000", "ebitda": "14000000", "growth_rate": 0.40},
            {"year": 2030, "revenue": "73000000", "ebitda": "22000000", "growth_rate": 0.30},
            {"year": 2031, "revenue": "88000000", "ebitda": "30000000", "growth_rate": 0.21},
        ],
    },
    "auditor_notes": "SMB payments. Category leader. Path to profitability clear by 2028.",
})

# --- 9. Series C+, Scaled Revenue, Information Technology ---
seed({
    "name": "Nexus Analytics",
    "stage": "series_c_plus",
    "sector": "information_technology",
    "revenue_status": "scaled_revenue",
    "current_revenue": Decimal("32000000"),
    "last_round_date": date(2025, 2, 1),
    "last_round_valuation": Decimal("280000000"),
    "last_round_amount": Decimal("60000000"),
    "last_round_investor": "Sequoia Capital",
    "projections": {
        "periods": [
            {"year": 2027, "revenue": "48000000", "ebitda": "12000000", "growth_rate": 0.50},
            {"year": 2028, "revenue": "67000000", "ebitda": "20000000", "growth_rate": 0.40},
            {"year": 2029, "revenue": "87000000", "ebitda": "30000000", "growth_rate": 0.30},
            {"year": 2030, "revenue": "104000000", "ebitda": "40000000", "growth_rate": 0.20},
            {"year": 2031, "revenue": "118000000", "ebitda": "48000000", "growth_rate": 0.13},
        ],
    },
    "auditor_notes": "Enterprise BI platform. 200+ clients including 15 Fortune 500. 95% gross retention.",
})

# --- 10. Late / Pre-IPO, Scaled Revenue, Healthcare ---
seed({
    "name": "MediScan Diagnostics",
    "stage": "late_pre_ipo",
    "sector": "healthcare",
    "revenue_status": "scaled_revenue",
    "current_revenue": Decimal("85000000"),
    "last_round_date": date(2025, 4, 1),
    "last_round_valuation": Decimal("750000000"),
    "last_round_amount": Decimal("100000000"),
    "last_round_investor": "General Atlantic",
    "projections": {
        "periods": [
            {"year": 2027, "revenue": "120000000", "ebitda": "25000000", "growth_rate": 0.41},
            {"year": 2028, "revenue": "160000000", "ebitda": "40000000", "growth_rate": 0.33},
            {"year": 2029, "revenue": "200000000", "ebitda": "55000000", "growth_rate": 0.25},
            {"year": 2030, "revenue": "240000000", "ebitda": "72000000", "growth_rate": 0.20},
            {"year": 2031, "revenue": "276000000", "ebitda": "88000000", "growth_rate": 0.15},
        ],
    },
    "auditor_notes": "AI-powered diagnostic imaging. FDA-cleared for 12 indications. IPO expected within 18 months.",
})

db.close()
print("Seed data created: 10 companies with valuations")
