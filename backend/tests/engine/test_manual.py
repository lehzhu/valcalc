from datetime import date
from decimal import Decimal
from valuation_engine.models import MethodType
from valuation_engine.methods.manual import ManualOverride

def test_manual_override_records_value():
    result = ManualOverride().compute(fair_value=Decimal("50000000"), justification="Based on recent comparable transaction",
        prior_computed_value=Decimal("42000000"), valuation_date=date(2026, 1, 1))
    assert result.method == MethodType.MANUAL
    assert result.value == Decimal("50000000")
    assert result.value_low == Decimal("50000000")
    assert result.value_high == Decimal("50000000")

def test_manual_override_logs_delta():
    result = ManualOverride().compute(fair_value=Decimal("50000000"), justification="Market intel",
        prior_computed_value=Decimal("42000000"), valuation_date=date(2026, 1, 1))
    assert "Record override delta" in [s.description for s in result.steps]

def test_manual_override_without_prior():
    result = ManualOverride().compute(fair_value=Decimal("25000000"), justification="Independent expert assessment",
        prior_computed_value=None, valuation_date=date(2026, 1, 1))
    assert result.value == Decimal("25000000")
    assert len(result.steps) >= 1
