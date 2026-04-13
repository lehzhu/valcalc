from decimal import Decimal

from valuation_engine.models import MethodType
from valuation_engine.explanation import generate_explanation


def test_comps_explanation():
    text = generate_explanation(
        method=MethodType.COMPS,
        fair_value=Decimal("42000000"),
        sector="information_technology",
        key_inputs={"revenue": "$3.4M", "multiple": "12.5x"},
    )
    assert "comparable" in text.lower() or "comps" in text.lower() or "multiple" in text.lower()
    assert "$42" in text or "42.0M" in text


def test_last_round_explanation():
    text = generate_explanation(
        method=MethodType.LAST_ROUND_ADJUSTED,
        fair_value=Decimal("40000000"),
        sector="information_technology",
        key_inputs={"post_money": "$40M", "months_elapsed": "8"},
    )
    assert "round" in text.lower() or "last" in text.lower()


def test_manual_explanation():
    text = generate_explanation(
        method=MethodType.MANUAL,
        fair_value=Decimal("50000000"),
        sector="financials",
        key_inputs={},
    )
    assert "manual" in text.lower() or "auditor" in text.lower()
