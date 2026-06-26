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

- `move_to`: targets a location or character endpoint; includes `speed: "walk" | "run"`
- `say_to`: targets a character; may include `interrupt: true`
- `request_repair`: targets `LandlordAgent`
- `file_complaint`: targets `LandlordAgent`
- `pay_rent`: targets `LandlordAgent`
- `skip_rent`: targets `LandlordAgent`
- `move_in`: landlord-mediated lifecycle action
- `move_out`: landlord-mediated lifecycle action
- `altercate`: targets a character and escalates to game-master adjudication
- `idle`: explicit no-op or wait


Add new verbs only when a demo scene cannot be expressed with these.

## Landlord Gateway

The human user is the landlord. `LandlordAgent` is a non-autonomous gateway that
delivers resident requests to the UI and returns user responses to the game
master for adjudication.

These character actions target `LandlordAgent` directly:

- `request_repair`
- `file_complaint`
- `pay_rent`
- `skip_rent`

`move_in` and `move_out` are landlord-mediated: residents or prospects can
request them, but approval, vacancy, cost, and consequences are resolved through
the landlord/game-master flow.

## Landlord Request Queue

Use a fast one-at-a-time FIFO buffer so autonomous agents do not drop or
overwrite landlord requests.

Priority jumps are allowed only for:

- `altercate` spillover affecting safety, reputation, or the landlord
- `skip_rent`

Landlord action cards include:

- requester
- action type
- summary
- urgency
- suggested choices
- free-text reply
- timeout/default

If the human ignores a card, timeout resolves as "no landlord action taken"; the
game master applies consequences.

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
- `move_to` updates subscription only after Phaser movement completes

## Atomic Actions

Actions resolve in order. If a target is busy, the proposing agent must wait,
interrupt through an allowed action, or choose another action.

`say_to(..., interrupt: true)` is allowed when the target is visible/reachable,
but it is socially discouraged. The interrupting agent prompt should understand
that interrupting is rude unless urgent, and interrupted agents should react
according to context, mood, and relationship memory.

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
