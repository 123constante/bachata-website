# Public dancer page, mockup F13 (teal)

Owner GO 2026-10-18. Brief: `briefs/dancer-page-f13.md` on `arc/briefs-dancer-rebuild`.

## Named design departure
The page keeps the TEAL "dancer ID world" (page #06191F, cards #0D3340, borders #1F5566, text #EAF7FA, accent #5EE0E6, gold stamp #F2C14E) instead of the site Bachata palette. Reason: the owner chose teal for the dancer ID card; Website DESIGN.md allows named departures. Only the Going-next date uses site Bachata Amber #FF9900. Font is the site stack (inherited), not the mockup's drawing fonts. The code comment is in `PublicDancerPageV2.tsx` (`TEAL`).

## Order
Back/Share bar, teal card (DANCER label, 116px photo with flag, name, Role . City, facts DANCING/LEVEL/STYLE, SPEAKS), practice stamp (only when looking_for_partner), Going next, Contact (C8 Copy), Achievements, owner plans (owner only), low-key Join. No gallery, no description, no appearances list.

## Rules in the model (`model.ts`)
- facts: a column only if its value exists; none = no row. Level uses `experienceLevel` (one mapping).
- city = `cityOnly()` (postcode cut off). Role shown once.
- stamp goal = `practiceGoalText()` (first two goals, lower-case, joined with "and"); no goals = no Goal line. No role-wanted wording.
- contacts carry `label` (shown, truncated by CSS) and `copyText` (the full text Copy copies).
- Going next: `goingNextModel()` is OFF unless `optIn` is true (open question, recommended OFF). Nothing feeds it yet: Going is beta-only and private, and there is no dancer opt-in column. Wiring needs a backend opt-in (admin repo).

## Open for owner
- Going next default (built OFF). Needs an opt-in field plus a public read that exposes only opted-in events.
- Test lines "Proof Rebuild Song" on Ricky's profile: admin cleanup before launch (songs are no longer shown on this page anyway).
- `/practice-partners` wording already says "practice partners"; unchanged.
