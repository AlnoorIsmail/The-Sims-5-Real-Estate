# Simulation Rules

## Authority Model

Resident agents propose actions. The game master adjudicates whether each action
is allowed and what changes in the world.

Agents do not directly mutate state. The simulation engine applies validated
state deltas.

The game master creates morning briefs, global events, and adjudicated outcomes.
It does not puppet normal resident behavior.

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

## Daily Flow

- The game master emits a morning brief before character actions start.
- Characters act autonomously during a 45-second sim-day window.
- Day close stops new actions, lets the active action finish, then asks the game
  master for a summary.

## Four-block Pub/Sub

Divide the visible map into four blocks. Agents subscribe to the block where
their Phaser character currently stands.

- same-block agents hear and see local public actions
- direct targets always receive targeted actions
- game-master/global events bypass block limits
- moving intent does not update subscription
- `walk_to` updates subscription only after Phaser movement completes

## Atomic Actions

Actions resolve in order. If a target is busy, the proposing agent must wait,
interrupt through an allowed action, or choose another action.

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
