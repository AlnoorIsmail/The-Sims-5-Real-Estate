# Simulation Rules

## Authority Model

Resident agents propose actions. The game master adjudicates whether each action
is allowed and what changes in the world.

Agents do not directly mutate state. The simulation engine applies validated
state deltas.

## V1 Action Vocabulary

Use a small fixed verb set:

- `move_to`
- `say_to`
- `emote`
- `request_repair`
- `file_complaint`
- `pay_rent`
- `skip_rent`
- `social_interaction`
- `move_in`
- `move_out`
- `idle`
- `altercate`


Add new verbs only when a demo scene cannot be expressed with these.

## Core Consequence Axes

- resident satisfaction
- resident relationships
- landlord reputation
- occupancy and churn risk
- rent/payment reliability
- maintenance pressure
- incident severity
- placeholder ROI

## Determinism

Keep the non-LLM simulation path deterministic for tests and fallback demos.
Random events should come from seeded inputs when practical.
