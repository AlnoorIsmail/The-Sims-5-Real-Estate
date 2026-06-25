# ROI And ML Handoff

## V1 ROI Placeholder

Use a transparent local formula for demo purposes. It should be explainable from
simulation metrics such as occupancy, rent collection, maintenance load,
resident satisfaction, reputation, and incident severity.

Label placeholder ROI clearly. Do not claim it is trained or predictive.

## Future ML Branch

A teammate will train ensemble ROI models using synthetic challenge data and
live API data. That branch owns the final model interface and feature contract.

This branch should prepare clean simulation metrics, but it must not guess the
future model API.

## Integration Default

When the ML contract exists, replace or augment the placeholder ROI calculator
behind a small app-owned boundary. Keep the UI behavior stable where possible.
