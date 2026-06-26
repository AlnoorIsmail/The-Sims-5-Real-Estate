# Stage 01: Product Brief

Lock the smallest demo story before building.

## Inputs

| Layer | Path | Use |
| --- | --- | --- |
| Layer 3 | `../../_config/product-vision.md` | Product, user, and demo direction |
| Layer 3 | `../../_config/technical-constraints.md` | Hackathon and repo constraints |
| Layer 3 | `../../_config/tone-safety.md` | Tone and consequence boundaries |
| Layer 3 | `../../_config/game-master-events.md` | Daily event deck and news-feed seam |
| Layer 4 | `../../../challenge-repo/README.md` | Challenge framing |
| Layer 4 | `../../../challenge-repo/docs/judging-criteria.md` | Scoring priorities |

## Process

Define one buildable demo path:

- who the landlord/user is
- what scenario starts the run
- what the resident agents make visible
- what the landlord can do
- what changes in reputation and ROI placeholder
- which game-master event card opens the demo day
- what is out of scope for the hackathon slice

Keep it short enough to drive implementation decisions.

## Outputs

Write to `output/product-brief.md`:

- demo promise
- target user
- 3-minute demo beats
- must-show states
- explicit non-goals

## Verify

- The brief maps to Decision Intelligence.
- The demo can be explained in one minute before showing the app.
- Nothing in the brief depends on the teammate's future ML model.
