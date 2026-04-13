from datetime import date
from decimal import Decimal
from valuation_engine.models import MethodResult, MethodType, ComputationStep, Assumption, Source

def _format_currency(value: Decimal) -> str:
    return f"${value:,.0f}"

class ManualOverride:
    def compute(self, fair_value: Decimal, justification: str, prior_computed_value: Decimal | None, valuation_date: date) -> MethodResult:
        steps, assumptions = [], []
        steps.append(ComputationStep(description="Record auditor-supplied fair value", formula="manual_entry",
            inputs={"fair_value": _format_currency(fair_value)}, output=_format_currency(fair_value)))
        assumptions.append(Assumption(name="Auditor justification", value=justification, rationale="Manual override by auditor", overrideable=False))
        if prior_computed_value is not None:
            delta = fair_value - prior_computed_value
            delta_pct = (delta / prior_computed_value * 100).quantize(Decimal("0.1"))
            steps.append(ComputationStep(description="Record override delta", formula="manual_value - computed_value",
                inputs={"manual_value": _format_currency(fair_value), "computed_value": _format_currency(prior_computed_value)},
                output=f"{_format_currency(delta)} ({delta_pct:+}%)"))
        return MethodResult(method=MethodType.MANUAL, value=fair_value, value_low=fair_value, value_high=fair_value,
            steps=steps, assumptions=assumptions, sources=[], is_primary=True)
