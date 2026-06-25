# Stage 06: ROI And Demo Audit

Make sure the slice is honest, demoable, and ready for the ML handoff.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/roi-ml-handoff.md` | Frozen `roi_prediction.v1` input/output contract |
| Layer 3 | `../../_config/product-vision.md` | Demo promise |
| Layer 3 | `../../_config/technical-constraints.md` | Local demo and fallback needs |
| Layer 4 | `../01_product_brief/output/product-brief.md` | Demo beats |
| Layer 4 | `../02_data_state_model/output/state-model.md` | ROI inputs |
| Layer 4 | `../03_sim_engine/output/sim-engine-spec.md` | State changes |
| Layer 4 | `../05_phaser_ui/output/phaser-ui-spec.md` | What judges see |
| Layer 4 | `../../../docs/demo-script.md` | Existing demo script skeleton |

## Process

Define the audit pass:

- confirm placeholder ROI is labeled and explainable
- summarize one synthetic run in business terms
- verify ROI input and output match `roi_prediction.v1`
- list what may be replaced behind the boundary without changing the contract
- check the demo path against judging criteria
- identify the minimum fallback if model calls fail, using the same output shape

Do not expand scope. Cut weak extras before adding new features.

## Outputs

Write to `output/demo-audit.md`:

- ROI placeholder explanation
- synthetic run summary
- ML handoff contract notes
- 3-minute demo checklist
- known limitations
- final pre-demo checks

## Verify

- The app does not claim trained ROI prediction before the ML integration lands.
- The app uses `contract_version: "roi_prediction.v1"` at the ROI boundary.
- Required ROI input fields are present, finite, and in the documented units.
- Required ROI output fields are present and not renamed.
- The demo shows AI or agentic behavior doing visible work.
- A local mock path still works without API keys.
- The story, UI, and metrics all describe the same run.
