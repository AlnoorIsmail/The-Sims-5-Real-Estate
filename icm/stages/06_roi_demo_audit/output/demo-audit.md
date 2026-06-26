# ROI And Demo Audit

## ROI Placeholder Explanation

The v1 ROI number is a transparent local proxy for demo purposes. It may combine
simulation signals such as:

- occupancy and rent collection
- maintenance pressure and capital events
- resident satisfaction and reputation
- incident severity and churn risk

Display it only as `Placeholder ROI` or `Synthetic ROI proxy`. It is not a
trained prediction, not investment advice, and not real Abu Dhabi market data.

The placeholder exists so judges can see the decision loop before the teammate
ML branch lands. When the ML contract is ready, replace or augment this formula
behind the app-owned ROI boundary without changing the demo story.

## Synthetic Run Summary

Use this as the recordable baseline, adjusting only to match runtime values:

1. Start a deterministic 2x3 building with a fixed seed, visible residents,
   prospects, and landlord `budgetAed`.
2. Open with a simulated `maintenance` event: AC, elevator, plumbing, or power
   strain increases resident anxiety and maintenance pressure.
3. Resident agents make the pressure visible through complaints, movement,
   direct speech, delayed rent concern, or prospect hesitation.
4. The game master adjudicates consequences and logs metric changes.
5. The landlord chooses a repair, renovation, incentive, or delay.
6. The app shows budget/capital-event changes plus reputation, satisfaction,
   occupancy, maintenance pressure, and `Placeholder ROI` movement.

Business interpretation: the landlord sees that a response can cost cash now
while reducing churn risk, protecting reputation, and improving the synthetic
ROI proxy. The no-action or delayed-action path should remain available as a
contrast, but it does not need a second full demo run.

## ML Handoff Notes

- Keep simulation metrics clean and named plainly.
- Do not invent the teammate model API, feature schema, scoring scale, or
  endpoint.
- The future ML branch owns trained ROI models, ensemble logic, synthetic
  challenge data, and live API data ingestion.
- The current branch owns only the placeholder ROI boundary and honest labeling.
- The UI should keep a stable ROI slot so the trained model can replace the
  placeholder later.

## Three-Minute Demo Checklist

- [ ] 0:00-0:20: state the landlord problem and business consequence.
- [ ] 0:20-0:40: show the product as a Decision Intelligence simulator.
- [ ] 0:40-1:05: start the fixed-seed building and simulated event card.
- [ ] 1:05-1:45: show resident/prospect agents creating visible signals.
- [ ] 1:45-2:20: make one landlord intervention and show state changes.
- [ ] 2:20-2:50: call out the aha: one action moves social and business
      outcomes together.
- [ ] 2:50-3:00: close with the ML handoff vision.

## Chroma/Gemini Setup Checklist And Mock Fallback

- [ ] If memory is being demonstrated, run local Chroma with `npm run chroma`.
- [ ] If Gemini embeddings are being demonstrated, set `GEMINI_API_KEY` and
      `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`.
- [ ] If Chroma is unavailable, continue with deterministic mock memory or no
      memory display.
- [ ] If Gemini or any model provider is unavailable, continue with mock
      resident proposals and deterministic game-master outcomes.
- [ ] The presenter should say the fallback is local/mock mode, not trained AI.

Chroma and Gemini are optional for the recordable v1 path. The demo must still
show the landlord decision loop without API keys.

## Local And Video Demo Readiness

- [ ] Run locally before recording.
- [ ] Use the same seed, building size, event card, and landlord action every
      time.
- [ ] Keep a recorded fallback of the exact three-minute flow.
- [ ] Confirm notifications are off and the browser tab only shows the demo.
- [ ] Confirm metric labels fit on screen and `Placeholder ROI` is visible.
- [ ] Confirm the event card says simulated scenario event.
- [ ] Confirm the close does not claim trained prediction.

## Acceptance Checklist

- [ ] The story, UI, and metrics describe the same run.
- [ ] The app does not claim trained ROI prediction before ML integration.
- [ ] Agentic behavior is visible in the run.
- [ ] The landlord decision changes at least one resident-facing metric and one
      business-facing metric.
- [ ] Budget changes have capital-event explanations.
- [ ] The local mock path works without Chroma, Gemini, or provider keys.
- [ ] The presenter can explain the placeholder ROI in one sentence.

## Known Limitations

- Stage 06 is a docs/audit foundation, not proof that runtime is complete.
- Current status still says the app shell is divergent from the simulator goal.
- Phaser UI, generated building movement, and test hooks are not complete in
  this stage.
- Placeholder ROI is synthetic and directional only.
- Scenario event cards are curated and simulated, not live news.
- Chroma/Gemini behavior still needs runtime verification.
- Full moderation, tenant-screening safeguards, and production financial
  validation are post-hackathon scope.

## Final Pre-Demo Checks

- [ ] Build or local run check passes for the current app state.
- [ ] Demo route opens without secrets.
- [ ] Mock mode can advance the scenario.
- [ ] `Placeholder ROI` label appears anywhere ROI appears.
- [ ] Landlord action, capital event, and metrics all line up.
- [ ] Fallback recording is ready.
