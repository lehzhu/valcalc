from decimal import Decimal

from valuation_engine.models import MethodType
from valuation_engine.explanation import generate_explanation


def test_comps_explanation():
    text = generate_explanation(
        method=MethodType.COMPS,
        fair_value=Decimal("42000000"),
        sector="b2b_saas",
        key_inputs={"revenue": "$3.4M", "multiple": "12.5x"},
    )
    assert "comparable" in text.lower() or "comps" in text.lower() or "multiple" in text.lower()
    assert "$42" in text or "42.0M" in text


def test_last_round_explanation():
    text = generate_explanation(
        method=MethodType.LAST_ROUND_ADJUSTED,
        fair_value=Decimal("40000000"),
        sector="ai_ml",
        key_inputs={"post_money": "$40M", "months_elapsed": "8"},
    )
    assert "round" in text.lower() or "last" in text.lower()


def test_dcf_explanation():
    text = generate_explanation(
        method=MethodType.DCF,
        fair_value=Decimal("120000000"),
        sector="fintech",
        key_inputs={"discount_rate": "22%", "projection_years": "5"},
    )
    assert "dcf" in text.lower() or "cash flow" in text.lower() or "discounted" in text.lower()
