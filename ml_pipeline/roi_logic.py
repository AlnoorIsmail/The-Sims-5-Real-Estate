from __future__ import annotations


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


def _margin_score(margin_pct: float) -> float:
    if margin_pct <= -20:
        return 0.0
    if margin_pct <= 0:
        return (margin_pct + 20) / 20 * 50
    if margin_pct >= 40:
        return 100.0
    return 50 + (margin_pct / 40 * 50)


def _profile_adjustment(profile: str) -> float:
    normalized = str(profile or "").strip().lower()
    if normalized in {"premium", "high", "high_value"}:
        return 5.0
    if normalized in {"established", "mid_high"}:
        return 3.0
    if normalized in {"industrial", "leisure", "innovation"}:
        return -2.0
    return 0.0


def calculate_real_estate_feasibility(
    predicted_price_per_sqm: float,
    predicted_estimated_value_aed: float,
    predicted_development_potential_score: float,
    district_profile: str,
    district_gross_yield_pct: float,
    district_infrastructure_score: float,
    acquisition_cost_aed: float,
    development_cost_aed: float,
) -> dict:
    total_cost = acquisition_cost_aed + development_cost_aed
    margin_aed = predicted_estimated_value_aed - total_cost
    margin_pct = (margin_aed / total_cost * 100) if total_cost else 0.0

    yield_score = _clamp(district_gross_yield_pct / 8 * 100)
    infrastructure_score = _clamp(district_infrastructure_score)
    potential_score = _clamp(predicted_development_potential_score)
    margin_component = _margin_score(margin_pct)

    score = (
        0.45 * margin_component
        + 0.25 * yield_score
        + 0.10 * potential_score
        + 0.20 * infrastructure_score
    )
    score = _clamp(score + _profile_adjustment(district_profile))

    if score >= 75 and margin_aed > 0:
        recommendation = "BUY"
    elif score >= 50:
        recommendation = "CONSIDER"
    else:
        recommendation = "DO NOT BUY"

    warnings: list[str] = [
        "Final recommendation uses transparent rule-based ROI logic, not a trained ROI model."
    ]
    if total_cost <= 0:
        warnings.append("Total project cost is zero or negative, so margin percentage is guarded.")
    if margin_aed <= 0:
        warnings.append("Predicted value does not exceed acquisition plus development cost.")
    if predicted_estimated_value_aed <= 0:
        warnings.append("Predicted estimated value is non-positive.")

    reason = (
        f"{recommendation}: score {score:.1f}/100 with {margin_pct:.1f}% margin, "
        f"{district_gross_yield_pct:.1f}% district yield, "
        f"{potential_score:.1f}/100 development potential, and "
        f"{infrastructure_score:.1f}/100 infrastructure."
    )

    return {
        "recommendation": recommendation,
        "success_score": round(score, 2),
        "predicted_price_per_sqm": round(predicted_price_per_sqm, 2),
        "predicted_estimated_value_aed": round(predicted_estimated_value_aed, 2),
        "predicted_development_potential_score": round(potential_score, 2),
        "district_profile": district_profile,
        "district_gross_yield_pct": round(district_gross_yield_pct, 2),
        "district_infrastructure_score": round(district_infrastructure_score, 2),
        "total_cost_aed": round(total_cost, 2),
        "margin_aed": round(margin_aed, 2),
        "margin_pct": round(margin_pct, 2),
        "reason": reason,
        "warnings": warnings,
    }
