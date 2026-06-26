# Product Brief: Decision Intelligence Demo

## Demo Promise

Show a landlord one simulated day in a small apartment building where resident
agents react to an event, a game master adjudicates consequences, and the
landlord sees how one management choice moves resident experience and business
signals.

The demo is Decision Intelligence, not a generic game: it helps a property
operator compare community, operational, reputation, occupancy, budget, and
placeholder ROI effects before spending real money.

## Target User

Primary user: a landlord, asset manager, or property operator responsible for a
multi-unit residential building.

They need a fast way to ask: "If this event happens and I respond this way, what
could happen to residents, reputation, operations, and investment performance?"

## Three-Minute Demo Story

### 0:00-0:20 Problem

Landlords usually see delayed spreadsheets and complaints after the damage is
done. Small operational choices can turn into churn, lower reputation, missed
rent, or unnecessary spending.

### 0:20-0:40 What We Built

We built a local Decision Intelligence simulator for property operations.
Resident agents propose actions from their needs and state, the game master
adjudicates the world, and the landlord sees the effect on reputation, budget,
occupancy, maintenance pressure, satisfaction, and placeholder ROI.

### 0:40-1:05 Opening Scenario

Start a deterministic 2-floor by 3-unit building with a small cast of residents
and prospects. Open the day with a simulated scenario event card:

- `maintenance`: an AC or elevator issue strains operations.

The card must be labeled as simulated. It is not live news or real market data.

### 1:05-1:45 Agents Make Risk Visible

Residents react visibly through movement, speech, complaints, rent pressure, or
prospect hesitation. The game master records why the event matters and applies
auditable state changes.

The judging point: AI/agentic behavior is doing visible work by turning latent
resident pressure into concrete, decision-relevant signals.

### 1:45-2:20 Landlord Decision

The landlord chooses a response such as repairing the affected floor, renovating
a unit, offering a small incentive, or delaying action. The engine records the
capital event and updates budget plus business metrics.

The ROI value shown here is a clearly labeled placeholder/synthetic proxy. It is
not a trained prediction.

### 2:20-2:50 Aha Moment

The same action changes more than one number: it can cost cash now, reduce
maintenance pressure, calm residents, protect reputation, stabilize occupancy,
and improve the placeholder ROI proxy. Judges should see a decision model, not
only a dashboard.

### 2:50-3:00 Close

With real data and the teammate ML branch, the placeholder ROI boundary can be
replaced by trained investment modeling while the same simulation story remains.

## Must-Show States

- Generated building: default 2x3, configurable later within the spec range.
- Simulated scenario event card and public event log.
- Resident/prospect agent activity: movement, speech, waiting, complaint,
  rent, or prospect signals.
- Game-master adjudication explaining state changes.
- Landlord controls for at least one meaningful intervention.
- Landlord `budgetAed` and recent capital events.
- Satisfaction, reputation, occupancy, maintenance pressure, and
  `Placeholder ROI` label.
- Deterministic/mock fallback path that works without API keys.

## Placeholder ROI Explanation

The demo ROI is a local synthetic proxy based on simulation metrics such as
occupancy, rent collection, maintenance load, resident satisfaction,
reputation, incident severity, and capital events.

It must be labeled as `Placeholder ROI` or `Synthetic ROI proxy` wherever it is
shown. Do not call it trained, predictive, market-validated, or real Abu Dhabi
market data.

## ML Handoff

This stage does not define the future ML API. The teammate ML branch owns the
trained ROI model, feature contract, and data sources.

This branch should only prepare clean simulation metrics and keep the UI stable
enough that the placeholder calculator can later be replaced behind an app-owned
boundary.

## Local And Video Demo Readiness

- Use a fixed seed and deterministic scenario for the recorded path.
- Keep mock autonomy available when provider keys, Chroma, or Gemini are absent.
- Rehearse the exact three-minute run and keep a fallback recording ready.
- Do not depend on live news, live market data, or future ML integration.

## Acceptance Checklist

- [ ] The story can be explained in one minute before showing the app.
- [ ] The demo maps to Decision Intelligence for a landlord/property operator.
- [ ] The opening event is labeled simulated.
- [ ] Resident agents visibly produce decision-relevant signals.
- [ ] The landlord action changes budget, reputation, satisfaction, occupancy,
      maintenance pressure, or placeholder ROI.
- [ ] ROI is explicitly labeled placeholder/synthetic, not trained prediction.
- [ ] Mock/deterministic mode can complete the core path locally.

## Explicit Non-Goals

- No Phaser implementation in this docs pass.
- No LangGraph implementation in this docs pass.
- No trained ROI model or guessed ML contract.
- No live news/data pipeline.
- No real Abu Dhabi market-data claim.
- No production moderation or tenant-screening product claim.
- No broad simulation sandbox beyond the one recordable vertical slice.
