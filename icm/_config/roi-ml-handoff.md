# ROI And ML Handoff

## V1 ROI Placeholder

Use a transparent local formula for demo purposes. It should be explainable from
simulation metrics such as occupancy, rent collection, maintenance load,
resident satisfaction, reputation, and incident severity.

Label placeholder ROI clearly. Do not claim it is trained or predictive.

## Future ML Branch

A teammate will train ensemble ROI models using synthetic challenge data and
live API data. That branch may replace the internals behind the ROI boundary,
but the app-facing input/output contract is frozen at
`roi_prediction.v1`.

The stable contract is documented in
`stages/06_roi_demo_audit/output/roi-prediction-contract.md`. Future work must
not rename required fields, change units, or change recommendation semantics
without creating a new versioned contract.

This branch should prepare clean simulation metrics and starter-kit model
predictions that map into `roi_prediction.v1`; it must not leak experimental
model features directly into the UI.

## Integration Default

When the ML contract exists, replace or augment the placeholder ROI calculator
behind a small app-owned boundary. Keep the UI behavior stable where possible.

The integration boundary returns either:

- `{ "ready": true, "decision": RoiDecisionV1 }`
- `{ "ready": false, "message": string, "command"?: string }`

Unknown extra fields may be ignored by the UI. Required v1 fields must remain
present whenever `ready` is true.
