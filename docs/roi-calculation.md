# ROI Calculation Summary

The final investment recommendation is not a trained ROI model. It is a
transparent rule-based feasibility score built on top of the model predictions
and district context.

## Inputs Used

The ROI calculator consumes these prediction outputs:

| Input | Source | Meaning |
| --- | --- | --- |
| `predicted_price_per_sqm` | Price model | Predicted market price per square meter in AED |
| `predicted_estimated_value_aed` | Parcel value model | Predicted parcel value in AED |
| `predicted_development_potential_score` | Development model | Predicted development potential on a 0 to 100 scale |

It also consumes district and cost context:

| Input | Source | Meaning |
| --- | --- | --- |
| `district_profile` | `districts.csv` | District category such as `mid`, `premium`, or `industrial` |
| `district_gross_yield_pct` | `districts.csv` | District gross yield as a percent |
| `district_infrastructure_score` | `districts.csv` | Infrastructure score on a 0 to 100 scale |
| `acquisition_cost_aed` | Scenario assumption | Cost to acquire the parcel |
| `development_cost_aed` | Scenario assumption | Cost to develop the parcel |

In the current demo scenario:

```text
acquisition_cost_aed = predicted_estimated_value_aed * 0.70
development_cost_aed = predicted_estimated_value_aed * 0.20
```

## Step 1: Calculate Cost And Margin

```text
total_cost_aed = acquisition_cost_aed + development_cost_aed
margin_aed = predicted_estimated_value_aed - total_cost_aed
margin_pct = margin_aed / total_cost_aed * 100
```

If `total_cost_aed` is zero, `margin_pct` is safely set to `0`.

## Step 2: Convert Signals Into 0 To 100 Scores

### Yield Score

District yield is normalized against an 8 percent benchmark:

```text
yield_score = clamp(district_gross_yield_pct / 8 * 100, 0, 100)
```

### Infrastructure Score

Infrastructure already uses a 0 to 100 scale:

```text
infrastructure_score = clamp(district_infrastructure_score, 0, 100)
```

### Development Potential Score

Development potential also uses a 0 to 100 scale:

```text
potential_score = clamp(predicted_development_potential_score, 0, 100)
```

### Margin Score

Margin is converted into a 0 to 100 score using three anchors:

| Margin percent | Margin score |
| --- | ---: |
| `<= -20%` | `0` |
| `0%` | `50` |
| `>= 40%` | `100` |

Values between those anchors are linearly interpolated.

## Step 3: Calculate Final Success Score

The weighted score is:

```text
success_score =
  0.45 * margin_score
  + 0.25 * yield_score
  + 0.10 * potential_score
  + 0.20 * infrastructure_score
```

Then a district profile adjustment is applied:

| District profile | Adjustment |
| --- | ---: |
| `premium`, `high`, `high_value` | `+5` |
| `established`, `mid_high` | `+3` |
| `affordable`, `mid`, unknown | `0` |
| `industrial`, `leisure`, `innovation` | `-2` |

The final score is clamped to `0` to `100`.

## Step 4: Convert Score Into Recommendation

```text
BUY if success_score >= 75 and margin_aed > 0
CONSIDER if success_score >= 50
DO NOT BUY otherwise
```

## Current Example

The latest generated sample decision is:

| Field | Value |
| --- | ---: |
| District | Al Bahia |
| Parcel | PRC-0280 |
| Recommendation | CONSIDER |
| Success score | 74.51 |
| Predicted price per sqm | AED 7,171.61 |
| Predicted estimated value | AED 25,756,704 |
| Predicted development potential | 73.56 |
| Gross yield | 8.0% |
| Infrastructure score | 67.0 |
| Margin | 11.11% |

The result is `CONSIDER` because the score is just below the `BUY` threshold of
75, even though the predicted margin is positive.

## Important Limitation

This is a transparent business-rule layer on top of ML predictions. It should be
described as an explainable feasibility score, not as a trained ROI prediction
model.
