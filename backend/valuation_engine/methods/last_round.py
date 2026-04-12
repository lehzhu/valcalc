from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from valuation_engine.models import CompanyInput, MethodResult, MethodType, ComputationStep, Assumption, Source
from valuation_engine.benchmarks.loader import get_sector_benchmarks, get_benchmark_version

def _format_currency(value: Decimal) -> str:
    if value >= 1_000_000_000: return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000: return f"${value / 1_000_000:.1f}M"
    if value >= 1_000: return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"

class LastRoundAdjusted:
    QUARTERLY_DECAY_RATE = Decimal("0.02")
    DECAY_FREE_MONTHS = 12
    RANGE_SPREAD = Decimal("0.15")

    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        last_round = company.last_round
        steps, assumptions, sources = [], [], []

        # Step 1: Post-money
        post_money = last_round.pre_money_valuation + last_round.amount_raised
        steps.append(ComputationStep(description="Calculate post-money valuation", formula="pre_money + amount_raised",
            inputs={"pre_money": _format_currency(last_round.pre_money_valuation), "amount_raised": _format_currency(last_round.amount_raised)},
            output=_format_currency(post_money)))

        # Step 2: Time adjustment
        months_elapsed = (valuation_date.year - last_round.date.year) * 12 + (valuation_date.month - last_round.date.month)
        if months_elapsed <= self.DECAY_FREE_MONTHS:
            time_factor = Decimal("1.0")
            time_rationale = f"Round is {months_elapsed} months old (< {self.DECAY_FREE_MONTHS}), no decay applied"
        else:
            decay_months = months_elapsed - self.DECAY_FREE_MONTHS
            decay_quarters = Decimal(str(decay_months)) / Decimal("3")
            total_decay = self.QUARTERLY_DECAY_RATE * decay_quarters
            time_factor = max(Decimal("1.0") - total_decay, Decimal("0.5"))
            time_rationale = f"Round is {months_elapsed} months old, {decay_quarters.quantize(Decimal('0.1'))} quarters of decay at {self.QUARTERLY_DECAY_RATE * 100}% per quarter"

        time_adjusted = (post_money * time_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(description="Apply time adjustment", formula="post_money × time_factor",
            inputs={"post_money": _format_currency(post_money), "time_factor": f"{time_factor:.4f}", "months_elapsed": str(months_elapsed)},
            output=_format_currency(time_adjusted)))
        assumptions.append(Assumption(name="Time decay rate", value=f"-{self.QUARTERLY_DECAY_RATE * 100}% per quarter after {self.DECAY_FREE_MONTHS} months", rationale=time_rationale, overrideable=True))

        # Step 3: Market/sector adjustment
        try:
            sector_data = get_sector_benchmarks(company.sector)
            trend_factor = Decimal(str(sector_data["sector_trend_factor"]))
            benchmark_version = get_benchmark_version()
            sources.append(Source(name=f"Sector Benchmark - {sector_data.get('display_name', company.sector)}", version=benchmark_version, effective_date=date.fromisoformat("2025-03-31")))
        except KeyError:
            trend_factor = Decimal("0")
            benchmark_version = "N/A"

        market_factor = Decimal("1") + trend_factor
        final_value = (time_adjusted * market_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(description="Apply market/sector adjustment", formula="time_adjusted × (1 + sector_trend_factor)",
            inputs={"time_adjusted": _format_currency(time_adjusted), "sector_trend_factor": f"{trend_factor:+.2%}"},
            output=_format_currency(final_value)))
        assumptions.append(Assumption(name="Sector trend adjustment", value=f"{trend_factor:+.2%}", rationale=f"Sector trend factor for {company.sector}", source=f"Benchmark {benchmark_version}", overrideable=True))

        value_low = (final_value * (Decimal("1") - self.RANGE_SPREAD)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        value_high = (final_value * (Decimal("1") + self.RANGE_SPREAD)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        return MethodResult(method=MethodType.LAST_ROUND_ADJUSTED, value=final_value, value_low=value_low, value_high=value_high,
            steps=steps, assumptions=assumptions, sources=sources, is_primary=False)
