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
    def compute(self, company: CompanyInput, valuation_date: date, overrides: dict | None = None) -> MethodResult:
        overrides = overrides or {}
        steps, assumptions, sources = [], [], []
        projections = company.projections
        periods = projections.periods

        if "discount_rate" in overrides:
            discount_rate = Decimal(str(overrides["discount_rate"]))
            rate_source = "Auditor override"
        elif projections.discount_rate is not None:
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

        terminal_growth = Decimal(str(overrides.get("terminal_growth_rate", TERMINAL_GROWTH_RATE)))
        ebitda_fcf = Decimal(str(overrides.get("ebitda_to_fcf", EBITDA_TO_FCF)))

        # Guard against division by zero in terminal value calculation
        if discount_rate <= terminal_growth:
            raise ValueError(
                f"Discount rate ({discount_rate:.2%}) must exceed terminal growth rate ({terminal_growth:.2%}). "
                f"Adjust WACC or terminal growth to produce a valid DCF."
            )

        assumptions.extend([
            Assumption(name="Discount rate (WACC)", value=f"{discount_rate:.0%}", rationale=rate_source, overrideable=True),
            Assumption(name="EBITDA-to-FCF conversion", value=f"{ebitda_fcf:.0%}", rationale="Simplified: FCF ≈ 75% of EBITDA (accounts for capex and working capital)", overrideable=True),
            Assumption(name="Terminal growth rate", value=f"{terminal_growth:.0%}", rationale="Long-run GDP-aligned perpetuity growth rate", overrideable=True),
        ])

        fcfs, fcf_details = [], []
        for period in periods:
            ebitda = period.ebitda or Decimal("0")
            fcf = (ebitda * ebitda_fcf).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            fcfs.append(fcf)
            fcf_details.append(f"Y{period.year}: {_format_currency(fcf)}")
        steps.append(ComputationStep(description="Project free cash flows from EBITDA", formula=f"FCF = EBITDA × {ebitda_fcf}",
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
        terminal_value = (final_fcf * (Decimal("1") + terminal_growth) / (discount_rate - terminal_growth)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        pv_terminal = (terminal_value / (Decimal("1") + discount_rate) ** n).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(description="Calculate and discount terminal value", formula="TV = FCF_final × (1 + g) / (r - g), then PV = TV / (1 + r)^n",
            inputs={"final_fcf": _format_currency(final_fcf), "terminal_growth": f"{terminal_growth:.0%}", "terminal_value": _format_currency(terminal_value)},
            output=f"PV of terminal: {_format_currency(pv_terminal)}"))

        enterprise_value = sum_pv_fcfs + pv_terminal
        steps.append(ComputationStep(description="Sum discounted cash flows and terminal value", formula="EV = Σ PV(FCFs) + PV(TV)",
            inputs={"sum_pv_fcfs": _format_currency(sum_pv_fcfs), "pv_terminal": _format_currency(pv_terminal)}, output=_format_currency(enterprise_value)))

        def _compute_ev(rate, tg=terminal_growth):
            if rate <= tg:
                return enterprise_value  # Fall back to base if rate combo is invalid
            pv_sum = sum(fcf / (Decimal("1") + rate) ** (i + 1) for i, fcf in enumerate(fcfs))
            tv = final_fcf * (Decimal("1") + tg) / (rate - tg)
            return (pv_sum + tv / (Decimal("1") + rate) ** n).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        ev_high = _compute_ev(discount_rate - SENSITIVITY_PP)
        ev_low = _compute_ev(discount_rate + SENSITIVITY_PP)

        return MethodResult(method=MethodType.DCF, value=enterprise_value, value_low=ev_low, value_high=ev_high,
            steps=steps, assumptions=assumptions, sources=sources, is_primary=False)

    def compute_sensitivity(
        self, company: CompanyInput, valuation_date: date,
        wacc_steps: list[float] | None = None,
        tg_steps: list[float] | None = None,
    ) -> dict:
        """Compute a sensitivity grid of enterprise values across WACC and terminal growth combos."""
        projections = company.projections
        periods = projections.periods

        base_rate = Decimal(str(_BASE_DISCOUNT_RATES.get(company.stage, 0.25)))
        rev_adj = Decimal(str(_REVENUE_WACC_ADJUSTMENT.get(company.revenue_status, 0.0)))
        base_wacc = float(base_rate + rev_adj)
        base_tg = float(TERMINAL_GROWTH_RATE)

        if wacc_steps is None:
            wacc_steps = [base_wacc + d for d in [-0.06, -0.03, 0, 0.03, 0.06]]
        if tg_steps is None:
            tg_steps = [base_tg + d for d in [-0.02, -0.01, 0, 0.01, 0.02]]

        # Precompute FCFs
        fcfs = []
        for period in periods:
            ebitda = period.ebitda or Decimal("0")
            fcfs.append((ebitda * EBITDA_TO_FCF).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        final_fcf = fcfs[-1]
        n = len(fcfs)

        grid = []
        for wacc in wacc_steps:
            row = []
            for tg in tg_steps:
                w = Decimal(str(wacc))
                g = Decimal(str(tg))
                if w <= g:
                    row.append("N/A")
                    continue
                pv_sum = sum(fcf / (Decimal("1") + w) ** (i + 1) for i, fcf in enumerate(fcfs))
                tv = final_fcf * (Decimal("1") + g) / (w - g)
                ev = (pv_sum + tv / (Decimal("1") + w) ** n).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                row.append(str(ev))
            grid.append(row)

        return {
            "wacc_values": wacc_steps,
            "tg_values": tg_steps,
            "grid": grid,
            "base_wacc": base_wacc,
            "base_tg": base_tg,
        }
