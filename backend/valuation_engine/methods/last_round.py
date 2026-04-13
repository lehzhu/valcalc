"""Recent Financing + Calibration Method.

Starts from the most recent arm's-length transaction price and calibrates
forward based on:
  1. Time elapsed since the round
  2. Company financial performance (revenue trajectory, burn, margins)
  3. Market/sector movements
  4. Qualitative factors (milestones, events, risk)
  5. Cap table complexity (preferences, options, SAFEs — noted but not yet
     modeled at the equity-allocation level)

Each adjustment is individually sourced and traced.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from valuation_engine.models import (
    CompanyInput, MethodResult, MethodType, ComputationStep, Assumption, Source,
)
from valuation_engine.benchmarks.loader import get_sector_benchmarks, get_benchmark_version


def _fmt(value: Decimal) -> str:
    return f"${value:,.0f}"


class LastRoundAdjusted:
    """Recent financing calibration — the primary valuation method."""

    QUARTERLY_DECAY_RATE = Decimal("0.02")
    DECAY_FREE_MONTHS = 12
    RANGE_SPREAD = Decimal("0.15")

    def compute(
        self,
        company: CompanyInput,
        valuation_date: date,
        overrides: dict | None = None,
    ) -> MethodResult:
        overrides = overrides or {}
        last_round = company.last_round
        steps: list[ComputationStep] = []
        assumptions: list[Assumption] = []
        sources: list[Source] = []

        # --- Retrieve extended data from company (JSON blobs) ---
        financials = getattr(company, "financials", None) or {}
        qualitative = getattr(company, "qualitative", None) or {}
        external = getattr(company, "external_mapping", None) or {}
        cap_table = getattr(company, "cap_table", None) or {}

        # =================================================================
        # STEP 1: Anchor — post-money from last round
        # =================================================================
        post_money = last_round.pre_money_valuation + last_round.amount_raised
        steps.append(ComputationStep(
            description="Anchor: post-money valuation from last financing",
            formula="pre_money + amount_raised",
            inputs={
                "pre_money": _fmt(last_round.pre_money_valuation),
                "amount_raised": _fmt(last_round.amount_raised),
                "round_date": last_round.date.isoformat(),
                "investor": last_round.lead_investor or "Not disclosed",
            },
            output=_fmt(post_money),
        ))
        sources.append(Source(
            name="Last financing round",
            version=f"Round dated {last_round.date.isoformat()}",
            effective_date=last_round.date,
        ))

        running_value = post_money

        # =================================================================
        # STEP 2: Time adjustment
        # =================================================================
        decay_rate = Decimal(str(overrides.get("time_decay_rate", self.QUARTERLY_DECAY_RATE)))
        months_elapsed = (
            (valuation_date.year - last_round.date.year) * 12
            + (valuation_date.month - last_round.date.month)
        )

        if months_elapsed <= self.DECAY_FREE_MONTHS:
            time_factor = Decimal("1.0")
            time_rationale = (
                f"Round is {months_elapsed} months old "
                f"(within {self.DECAY_FREE_MONTHS}-month grace period), no decay applied"
            )
        else:
            decay_months = months_elapsed - self.DECAY_FREE_MONTHS
            decay_quarters = Decimal(str(decay_months)) / Decimal("3")
            total_decay = decay_rate * decay_quarters
            time_factor = max(Decimal("1.0") - total_decay, Decimal("0.5"))
            time_rationale = (
                f"Round is {months_elapsed} months old, "
                f"{decay_quarters.quantize(Decimal('0.1'))} quarters beyond grace period, "
                f"decay at {decay_rate * 100}%/quarter"
            )

        running_value = (running_value * time_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(
            description="Time adjustment for staleness of last transaction",
            formula="anchor × time_factor",
            inputs={
                "anchor": _fmt(post_money),
                "time_factor": f"{time_factor:.4f}",
                "months_elapsed": str(months_elapsed),
            },
            output=_fmt(running_value),
        ))
        assumptions.append(Assumption(
            name="Time decay rate",
            value=f"-{self.QUARTERLY_DECAY_RATE * 100}%/quarter after {self.DECAY_FREE_MONTHS}mo",
            rationale=time_rationale,
            source="ASC 820-10-35: calibration to transaction price should reflect passage of time",
            overrideable=True,
        ))

        # =================================================================
        # STEP 3: Financial performance adjustment
        # =================================================================
        if "performance_adjustment" in overrides:
            perf_factor = Decimal("1") + Decimal(str(overrides["performance_adjustment"]))
            perf_inputs = {"override": f"{overrides['performance_adjustment']:+.1%}"}
            perf_rationale_parts = ["Auditor override"]
        else:
            perf_factor = Decimal("1.0")
            perf_inputs = {}
            perf_rationale_parts = []

            # Revenue trajectory
            current_rev = financials.get("current_revenue") or (
                str(company.current_revenue) if company.current_revenue else None
            )
            prior_rev = financials.get("revenue_at_last_round")
            if current_rev and prior_rev:
                try:
                    cur = Decimal(str(current_rev))
                    prior = Decimal(str(prior_rev))
                    if prior > 0:
                        rev_growth = (cur - prior) / prior
                        rev_adj = min(max(rev_growth * Decimal("0.5"), Decimal("-0.30")), Decimal("0.30"))
                        perf_factor += rev_adj
                        perf_inputs["revenue_growth"] = f"{rev_growth:+.1%}"
                        perf_inputs["revenue_adjustment"] = f"{rev_adj:+.1%}"
                        perf_rationale_parts.append(
                            f"Revenue grew {rev_growth:+.1%} since round "
                            f"(${prior / 1_000_000:.1f}M → ${cur / 1_000_000:.1f}M)"
                        )
                except Exception:
                    pass

            # Gross margin signal
            gross_margin = financials.get("gross_margin")
            if gross_margin is not None:
                try:
                    gm = Decimal(str(gross_margin))
                    if gm >= Decimal("0.70"):
                        gm_adj = Decimal("0.05")
                        perf_rationale_parts.append(f"Strong gross margin ({gm:.0%})")
                    elif gm < Decimal("0.40"):
                        gm_adj = Decimal("-0.05")
                        perf_rationale_parts.append(f"Weak gross margin ({gm:.0%})")
                    else:
                        gm_adj = Decimal("0")
                    perf_factor += gm_adj
                    perf_inputs["gross_margin"] = f"{gm:.0%}"
                except Exception:
                    pass

            # Runway signal
            runway_months = financials.get("runway_months")
            if runway_months is not None:
                try:
                    rw = int(runway_months)
                    if rw < 6:
                        rw_adj = Decimal("-0.10")
                        perf_rationale_parts.append(f"Critical runway ({rw} months)")
                    elif rw < 12:
                        rw_adj = Decimal("-0.05")
                        perf_rationale_parts.append(f"Short runway ({rw} months)")
                    else:
                        rw_adj = Decimal("0")
                    perf_factor += rw_adj
                    perf_inputs["runway_months"] = str(rw)
                except Exception:
                    pass

        if perf_factor != Decimal("1.0"):
            running_value = (running_value * perf_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            steps.append(ComputationStep(
                description="Financial performance calibration",
                formula="time_adjusted × performance_factor",
                inputs=perf_inputs,
                output=_fmt(running_value),
            ))
            assumptions.append(Assumption(
                name="Performance adjustment",
                value=f"{perf_factor - 1:+.1%}",
                rationale="; ".join(perf_rationale_parts) if perf_rationale_parts else "Based on financial data since last round",
                source="Company financial data" if not ("performance_adjustment" in overrides) else "Auditor override",
                overrideable=True,
            ))

        # =================================================================
        # STEP 4: Market / sector adjustment
        # =================================================================
        if "sector_trend" in overrides:
            trend_factor = Decimal(str(overrides["sector_trend"]))
            benchmark_version = "Auditor override"
        else:
            # Check for user-provided index movement first
            index_movement = external.get("index_movement_pct")
            if index_movement is not None:
                try:
                    trend_factor = Decimal(str(index_movement))
                    if abs(trend_factor) > 1:  # Assume percentage if > 1
                        trend_factor = trend_factor / 100
                    benchmark_version = "User-provided market data"
                    src_name = external.get("index_name", "Market index")
                    sources.append(Source(
                        name=f"{src_name} movement since last round",
                        version="User-provided",
                        effective_date=valuation_date,
                    ))
                except Exception:
                    trend_factor = Decimal("0")
                    benchmark_version = "N/A"
            else:
                try:
                    sector_data = get_sector_benchmarks(company.sector)
                    trend_factor = Decimal(str(sector_data["sector_trend_factor"]))
                    benchmark_version = get_benchmark_version()
                    sources.append(Source(
                        name=f"Sector Benchmark - {sector_data.get('display_name', company.sector)}",
                        version=benchmark_version,
                        effective_date=date.fromisoformat("2025-03-31"),
                    ))
                except KeyError:
                    trend_factor = Decimal("0")
                    benchmark_version = "N/A"

        market_factor = Decimal("1") + trend_factor
        running_value = (running_value * market_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        steps.append(ComputationStep(
            description="Market/sector calibration",
            formula="performance_adjusted × (1 + market_movement)",
            inputs={
                "market_movement": f"{trend_factor:+.2%}",
                "source": benchmark_version,
            },
            output=_fmt(running_value),
        ))
        assumptions.append(Assumption(
            name="Market/sector adjustment",
            value=f"{trend_factor:+.2%}",
            rationale=f"Sector movement for {company.sector} since last round",
            source=f"Benchmark {benchmark_version}",
            overrideable=True,
        ))

        # =================================================================
        # STEP 5: Qualitative adjustment
        # =================================================================
        if "qualitative_adjustment" in overrides:
            qual_factor = Decimal("1") + Decimal(str(overrides["qualitative_adjustment"]))
            qual_inputs = {"override": f"{overrides['qualitative_adjustment']:+.1%}"}
            qual_rationale_parts = ["Auditor override"]
        else:
            qual_factor = Decimal("1.0")
            qual_inputs = {}
            qual_rationale_parts = []

            # Board plan performance
            board_plan_status = qualitative.get("board_plan_status")
            if board_plan_status:
                status = str(board_plan_status).lower()
                if "exceeded" in status or "beat" in status:
                    qual_factor += Decimal("0.10")
                    qual_rationale_parts.append("Exceeded board plan")
                elif "missed" in status or "below" in status:
                    qual_factor -= Decimal("0.10")
                    qual_rationale_parts.append("Missed board plan")
                elif "met" in status or "on track" in status:
                    qual_rationale_parts.append("On track with board plan")
                qual_inputs["board_plan"] = board_plan_status

            # Major events since round
            major_events = qualitative.get("major_events")
            if major_events:
                qual_inputs["major_events"] = str(major_events)[:100]

            # Customer concentration risk
            customer_concentration = qualitative.get("customer_concentration")
            if customer_concentration:
                conc = str(customer_concentration).lower()
                if "high" in conc or any(c.isdigit() and int(c) > 3 for c in conc.split() if c.isdigit()):
                    qual_factor -= Decimal("0.05")
                    qual_rationale_parts.append(f"Customer concentration risk: {customer_concentration}")
                qual_inputs["customer_concentration"] = str(customer_concentration)

            # Regulatory risk
            regulatory_risk = qualitative.get("regulatory_risk")
            if regulatory_risk:
                risk = str(regulatory_risk).lower()
                if "high" in risk or "material" in risk:
                    qual_factor -= Decimal("0.05")
                    qual_rationale_parts.append(f"Elevated regulatory risk")
                qual_inputs["regulatory_risk"] = str(regulatory_risk)

        if qual_factor != Decimal("1.0"):
            running_value = (running_value * qual_factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            steps.append(ComputationStep(
                description="Qualitative calibration",
                formula="market_adjusted × qualitative_factor",
                inputs=qual_inputs,
                output=_fmt(running_value),
            ))
            assumptions.append(Assumption(
                name="Qualitative adjustment",
                value=f"{qual_factor - 1:+.1%}",
                rationale="; ".join(qual_rationale_parts) if qual_rationale_parts else "Based on qualitative factors",
                source="Auditor override" if "qualitative_adjustment" in overrides else "Management/auditor assessment",
                overrideable=True,
            ))

        # =================================================================
        # STEP 6: Cap table notes (informational — not yet equity-allocated)
        # =================================================================
        cap_notes: list[str] = []
        if cap_table.get("security_type"):
            cap_notes.append(f"Security: {cap_table['security_type']}")
        if cap_table.get("liquidation_preferences"):
            cap_notes.append(f"Liq pref: {cap_table['liquidation_preferences']}")
        if cap_table.get("option_pool_pct"):
            cap_notes.append(f"Option pool: {cap_table['option_pool_pct']}%")
        if cap_table.get("safes_notes"):
            cap_notes.append(f"SAFEs/notes: {cap_table['safes_notes']}")
        if cap_table.get("convertibility"):
            cap_notes.append(f"Convertibility: {cap_table['convertibility']}")

        if cap_notes:
            steps.append(ComputationStep(
                description="Cap table complexity (noted, not equity-allocated)",
                formula="Enterprise value before equity allocation",
                inputs={n.split(":")[0].strip(): n.split(":", 1)[1].strip() for n in cap_notes},
                output=f"{_fmt(running_value)} (enterprise level — equity allocation not modeled)",
            ))
            assumptions.append(Assumption(
                name="Equity allocation",
                value="Not modeled",
                rationale="Cap table noted for audit documentation. OPM/waterfall analysis required for per-share fair value.",
                source="IPEV Guidelines Section 3.5; ASC 820-10-35",
                overrideable=False,
            ))

        # =================================================================
        # Final value and range
        # =================================================================
        final_value = running_value
        value_low = (final_value * (Decimal("1") - self.RANGE_SPREAD)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        value_high = (final_value * (Decimal("1") + self.RANGE_SPREAD)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )

        # Summary step
        steps.append(ComputationStep(
            description="Calibrated fair value conclusion",
            formula="anchor × time × performance × market × qualitative",
            inputs={
                "anchor": _fmt(post_money),
                "final": _fmt(final_value),
                "range": f"{_fmt(value_low)} – {_fmt(value_high)}",
            },
            output=_fmt(final_value),
        ))

        return MethodResult(
            method=MethodType.LAST_ROUND_ADJUSTED,
            value=final_value,
            value_low=value_low,
            value_high=value_high,
            steps=steps,
            assumptions=assumptions,
            sources=sources,
            is_primary=False,
        )
