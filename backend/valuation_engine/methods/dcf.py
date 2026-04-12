from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from valuation_engine.models import CompanyInput, CompanyStage, RevenueStatus, MethodResult, MethodType, ComputationStep, Assumption, Source

def _format_currency(value: Decimal) -> str:
    if abs(value) >= 1_000_000_000: return f"${value / 1_000_000_000:.1f}B"
    if abs(value) >= 1_000_000: return f"${value / 1_000_000:.1f}M"
    if abs(value) >= 1_000: return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"

_BASE_DISCOUNT_RATES = {
    CompanyStage.PRE_SEED: 0.55, CompanyStage.SEED: 0.45,
    CompanyStage.SERIES_A: 0.35, CompanyStage.SERIES_B: 0.28,
    CompanyStage.SERIES_C_PLUS: 0.22, CompanyStage.LATE_PRE_IPO: 0.15,
}

_REVENUE_WACC_ADJUSTMENT = {
    RevenueStatus.PRE_REVENUE: 0.05,
    RevenueStatus.EARLY_REVENUE: 0.03,
    RevenueStatus.GROWING_REVENUE: 0.0,
    RevenueStatus.SCALED_REVENUE: -0.02,
}
EBITDA_TO_FCF = Decimal("0.75")
TERMINAL_GROWTH_RATE = Decimal("0.03")
SENSITIVITY_PP = Decimal("0.03")

class DiscountedCashFlow:
    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        steps, assumptions, sources = [], [], []
        projections = company.projections
        periods = projections.periods

        if projections.discount_rate is not None:
            discount_rate = Decimal(str(projections.discount_rate))
            rate_source = "User-supplied"
        else:
            base_rate = Decimal(str(_BASE_DISCOUNT_RATES.get(company.stage, 0.25)))
            rev_adj = Decimal(str(_REVENUE_WACC_ADJUSTMENT.get(company.revenue_status, 0.0)))
            discount_rate = base_rate + rev_adj
            rate_parts = [f"Base {base_rate:.0%} for {company.stage.value} stage"]
            if rev_adj != 0:
                rate_parts.append(f"{rev_adj:+.0%} for {company.revenue_status.value.replace('_', ' ')}")
            rate_source = ", ".join(rate_parts)

        assumptions.extend([
            Assumption(name="Discount rate (WACC)", value=f"{discount_rate:.0%}", rationale=rate_source, overrideable=True),
            Assumption(name="EBITDA-to-FCF conversion", value=f"{EBITDA_TO_FCF:.0%}", rationale="Simplified: FCF ≈ 75% of EBITDA (accounts for capex and working capital)", overrideable=True),
            Assumption(name="Terminal growth rate", value=f"{TERMINAL_GROWTH_RATE:.0%}", rationale="Long-run GDP-aligned perpetuity growth rate", overrideable=True),
        ])

        fcfs, fcf_details = [], []
        for period in periods:
            ebitda = period.ebitda or Decimal("0")
            fcf = (ebitda * EBITDA_TO_FCF).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            fcfs.append(fcf)
            fcf_details.append(f"Y{period.year}: {_format_currency(fcf)}")
        steps.append(ComputationStep(description="Project free cash flows from EBITDA", formula="FCF = EBITDA × 0.75",
            inputs={"periods": ", ".join(fcf_details)}, output=f"{len(fcfs)} periods projected"))

        pv_fcfs, discount_details = [], []
        for i, fcf in enumerate(fcfs):
            year = i + 1
            pv = (fcf / (Decimal("1") + discount_rate) ** year).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            pv_fcfs.append(pv)
            discount_details.append(f"Y{year}: {_format_currency(pv)}")
        sum_pv_fcfs = sum(pv_fcfs)
        steps.append(ComputationStep(description="Discount projected cash flows to present value", formula="PV = FCF / (1 + r)^t",
            inputs={"discount_rate": f"{discount_rate:.0%}", "discounted_flows": ", ".join(discount_details)}, output=_format_currency(sum_pv_fcfs)))

        final_fcf = fcfs[-1]
        n = len(fcfs)
        terminal_value = (final_fcf * (Decimal("1") + TERMINAL_GROWTH_RATE) / (discount_rate - TERMINAL_GROWTH_RATE)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        pv_terminal = (terminal_value / (Decimal("1") + discount_rate) ** n).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(description="Calculate and discount terminal value", formula="TV = FCF_final × (1 + g) / (r - g), then PV = TV / (1 + r)^n",
            inputs={"final_fcf": _format_currency(final_fcf), "terminal_growth": f"{TERMINAL_GROWTH_RATE:.0%}", "terminal_value": _format_currency(terminal_value)},
            output=f"PV of terminal: {_format_currency(pv_terminal)}"))

        enterprise_value = sum_pv_fcfs + pv_terminal
        steps.append(ComputationStep(description="Sum discounted cash flows and terminal value", formula="EV = Σ PV(FCFs) + PV(TV)",
            inputs={"sum_pv_fcfs": _format_currency(sum_pv_fcfs), "pv_terminal": _format_currency(pv_terminal)}, output=_format_currency(enterprise_value)))

        def _compute_ev(rate):
            pv_sum = sum(fcf / (Decimal("1") + rate) ** (i + 1) for i, fcf in enumerate(fcfs))
            tv = final_fcf * (Decimal("1") + TERMINAL_GROWTH_RATE) / (rate - TERMINAL_GROWTH_RATE)
            return (pv_sum + tv / (Decimal("1") + rate) ** n).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        ev_high = _compute_ev(discount_rate - SENSITIVITY_PP)
        ev_low = _compute_ev(discount_rate + SENSITIVITY_PP)

        return MethodResult(method=MethodType.DCF, value=enterprise_value, value_low=ev_low, value_high=ev_high,
            steps=steps, assumptions=assumptions, sources=sources, is_primary=False)
