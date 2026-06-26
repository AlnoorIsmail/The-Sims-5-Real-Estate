# Game Master Events

The game master creates daily world pressure, not direct puppet actions.

## V1 Event Deck

Use 12 curated hardcoded cards for the demo:

1. finance: interest-rate rumor affects investor confidence
2. health/news: illness wave raises resident anxiety and remote-work demand
3. amenities: new cafe or clinic opens nearby
4. data center: proposed data center boosts jobs but raises traffic/noise worry
5. factory/noise: nearby industrial activity lowers comfort and perceived value
6. maintenance: elevator, plumbing, AC, or power issue strains operations
7. jobs: local hiring surge improves rent reliability for some residents
8. regulation: new inspection or rental rule changes landlord risk
9. market shift: comparable rents move up or down in the district
10. neighbor conflict: noise, pets, guests, or shared-space tension escalates
11. service disruption: roadwork, transit delay, or utility outage affects mood
12. move-in pressure: a prospect wants a unit under imperfect conditions

Each card should define:

- `id`
- `scope`: global, building, generated-location, or character-targeted
- optional `locationId` and `locationType`
- `tags`
- affected metrics
- public text for the feed
- private context for the game master

## Future News Pipeline

Later, a news/data pipeline should produce the same event-card shape from
current signals. Examples: public news, market indicators, local development
announcements, health alerts, infrastructure notices, and amenity changes.

For the demo, use hardcoded cards and label them as simulated scenario events.

## Publication

Game-master/global events bypass generated location limits. Local events use
the generated location subscription model from `simulation-rules.md`.
