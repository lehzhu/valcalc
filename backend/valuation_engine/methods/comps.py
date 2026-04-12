from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from valuation_engine.models import CompanyInput, CompanyStage, RevenueStatus, MethodResult, MethodType, ComputationStep, Assumption, Source
from valuation_engine.benchmarks.loader import get_sector_benchmarks, get_benchmark_version

def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000: return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000: return f"${value / 1_000_000:.1f}M"
    if value >= 1_000: return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"

_BASE_STAGE_DISCOUNTS = {
    CompanyStage.PRE_SEED: Decimal("0.35"), CompanyStage.SEED: Decimal("0.30"),
    CompanyStage.SERIES_A: Decimal("0.20"), CompanyStage.SERIES_B: Decimal("0.12"),
    CompanyStage.SERIES_C_PLUS: Decimal("0.07"), CompanyStage.LATE_PRE_IPO: Decimal("0.04"),
}

_REVENUE_DLOM_ADJUSTMENT = {
    RevenueStatus.EARLY_REVENUE: Decimal("0.05"),
    RevenueStatus.GROWING_REVENUE: Decimal("0.0"),
    RevenueStatus.SCALED_REVENUE: Decimal("-0.02"),
}

class ComparableCompanyMultiples:
    def compute(self, company: CompanyInput, valuation_date: date, custom_multiples: dict | None = None) -> MethodResult:
        steps, assumptions, sources = [], [], []
        revenue = company.current_revenue

        if custom_multiples:
            multiples = custom_multiples
            multiple_source = "Custom peer group"
            benchmark_version = "custom"
        else:
            sector_data = get_sector_benchmarks(company.sector)
            multiples = sector_data["revenue_multiple"]
            multiple_source = f"Sector Benchmark - {sector_data.get('display_name', company.sector)}"
            benchmark_version = get_benchmark_version()
            sources.append(Source(name=multiple_source, version=benchmark_version, effective_date=date(2025, 3, 31)))

        median_multiple = Decimal(str(multiples["median"]))
        p25_multiple = Decimal(str(multiples["p25"]))
        p75_multiple = Decimal(str(multiples["p75"]))

        steps.append(ComputationStep(description="Look up sector revenue multiple", formula="sector → {p25, median, p75}",
            inputs={"sector": company.sector, "p25": f"{p25_multiple}x", "median": f"{median_multiple}x", "p75": f"{p75_multiple}x"},
            output=f"{median_multiple}x (median)"))

        base_value = (revenue * median_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        base_low = (revenue * p25_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        base_high = (revenue * p75_multiple).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        steps.append(ComputationStep(description="Calculate base valuation", formula="revenue × median_multiple",
            inputs={"revenue": _format_currency(revenue), "multiple": f"{median_multiple}x"}, output=_format_currency(base_value)))
        assumptions.append(Assumption(name="Revenue multiple", value=f"{median_multiple}x",
            rationale=f"Median revenue multiple for {company.sector}", source=f"Benchmark {benchmark_version}", overrideable=True))

        # Growth adjustment
        growth_adjustment = Decimal("1.0")
        if not custom_multiples:
            sector_data = get_sector_benchmarks(company.sector)
            sector_median_growth = Decimal(str(sector_data.get("median_growth_rate", 0.25)))
            if company.projections and company.projections.periods:
                company_growth = Decimal(str(company.projections.periods[0].growth_rate or 0))
                growth_diff = company_growth - sector_median_growth
                growth_adjustment = max(Decimal("0.7"), min(Decimal("1") + (growth_diff * Decimal("0.5")), Decimal("1.5")))
                steps.append(ComputationStep(description="Apply growth rate adjustment", formula="base × growth_adjustment",
                    inputs={"company_growth": f"{company_growth:.0%}", "sector_median_growth": f"{sector_median_growth:.0%}", "adjustment_factor": f"{growth_adjustment:.4f}"},
                    output=_format_currency((base_value * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP))))
                assumptions.append(Assumption(name="Growth adjustment", value=f"{growth_adjustment:.4f}x",
                    rationale=f"Company growth ({company_growth:.0%}) vs sector median ({sector_median_growth:.0%})", overrideable=True))

        adjusted_value = (base_value * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        adjusted_low = (base_low * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        adjusted_high = (base_high * growth_adjustment).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        base_discount = _BASE_STAGE_DISCOUNTS.get(company.stage, Decimal("0.15"))
        rev_adj = _REVENUE_DLOM_ADJUSTMENT.get(company.revenue_status, Decimal("0.0"))
        discount = max(Decimal("0.0"), base_discount + rev_adj)
        discount_factor = Decimal("1") - discount
        final_value = (adjusted_value * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        final_low = (adjusted_low * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        final_high = (adjusted_high * discount_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        discount_parts = [f"{base_discount:.0%} DLOM for {company.stage.value} stage"]
        if rev_adj != 0:
            discount_parts.append(f"{rev_adj:+.0%} for {company.revenue_status.value.replace('_', ' ')}")

        steps.append(ComputationStep(description="Apply DLOM (illiquidity discount)", formula="adjusted_value × (1 - DLOM)",
            inputs={"adjusted_value": _format_currency(adjusted_value), "stage": company.stage.value, "DLOM": f"{discount:.0%}"},
            output=_format_currency(final_value)))
        assumptions.append(Assumption(name="DLOM (illiquidity discount)", value=f"-{discount:.0%}",
            rationale="; ".join(discount_parts), overrideable=True))

        return MethodResult(method=MethodType.COMPS, value=final_value, value_low=final_low, value_high=final_high,
            steps=steps, assumptions=assumptions, sources=sources, is_primary=False)
