# Demo Script

Rehearse this twice, timed. You have **3 minutes**.

> Full demo-day guidance: [submissions repo -> demo-day-guide](https://github.com/abu-dhabi-ai-proptech-challenge/submissions/blob/main/docs/demo-day-guide.md)

---

## 0:00-0:20 - The Problem

> "A landlord can miss risk until it becomes complaints, churn, unpaid rent, or
> emergency spending. We show those consequences before the decision is made."

No team intro. Start with the operator pain.

## 0:20-0:40 - What We Built

> "We built a Decision Intelligence simulator for real estate operations.
> Resident agents react to building events, a game master adjudicates the
> consequences, and the landlord sees reputation, budget, occupancy, and
> placeholder ROI move together."

Then start showing the app.

## 0:40-2:20 - Live Demo

Walk this exact flow:

1. Start state: fixed-seed 2x3 building, visible residents/prospects, landlord
   budget, reputation, satisfaction, occupancy, maintenance pressure, and
   `Placeholder ROI`.
2. Input/action: open a simulated `maintenance` event card, such as AC,
   elevator, plumbing, or power strain.
3. What the AI does: resident agents surface pressure through movement, speech,
   complaints, rent concern, or prospect hesitation; the game master adjudicates
   state changes and logs why they happened.
4. Landlord action: repair, renovate, offer a small incentive, or delay.
5. Output and why it matters: budget/capital events change, resident-facing
   metrics move, and the synthetic `Placeholder ROI` proxy updates. Say clearly:
   "This ROI is a local placeholder, not a trained prediction."

**Pre-demo checklist:**

- [ ] App running locally, demo tab open, nothing else visible.
- [ ] Fixed seed and event card ready.
- [ ] Mock/deterministic mode ready if Chroma, Gemini, or provider keys fail.
- [ ] Fallback recording of this exact flow ready.
- [ ] Notifications off, font size readable.
- [ ] `Placeholder ROI` label visible anywhere ROI appears.

## 2:20-2:50 - The Aha

> "The useful part is not one score. It is seeing one landlord decision ripple
> through people and business metrics at the same time: cash cost now,
> maintenance pressure down, residents calmer, reputation protected, and churn
> risk lower."

Judging narrative: this is Decision Intelligence because agents make hidden
resident pressure visible before the operator commits money.

## 2:50-3:00 - Close

> "Today this runs locally with synthetic scenario events and placeholder ROI.
> With the teammate ML branch, the ROI boundary can become trained investment
> modeling while the same simulation loop stays in place. Thank you."

---

## Q&A Prep

- **What did you build today vs. before?** A local decision simulator foundation
  with a locked demo story, visible agent loop, and honest placeholder metrics.
- **What happens with 100x the data?** The future ML branch can replace the
  placeholder ROI proxy with trained models behind the same ROI boundary.
- **Why AI instead of rules?** Agents make varied resident/prospect reactions
  visible; the deterministic engine keeps outcomes auditable.
- **Who is the first real user?** A landlord, asset manager, or property
  operator responsible for a multi-unit residential building.
- **Is the ROI trained?** No. It is explicitly placeholder/synthetic until the
  teammate ML integration lands.
