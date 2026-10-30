# Brief: L5 -- an accepted organiser invite lands on the Welcome screen

Repo 123constante/bachata-website. Branch `claude/login-invite-welcome`. Normal lane, Sonnet. Max 3 source files plus tests. No migration, flags unchanged, no Auth.tsx.

## Owner decision 2026-10-30
After accepting an organiser invite the person lands on the "welcome to your page" screen (not the plain home page).

## Facts (verify them first)
- The helper already exists: `acceptedInviteLanding(organiserId, flags)` in `src/modules/organiser/p3/shell/paths.ts` (P3 Welcome `/account/p3/you/welcome?o=<id>` when organiserP3 AND organiserSelfServe are on, else R1 `ORG_PATHS.welcome(organiserId)`).
- `DoneScreen` in `src/modules/admin-organisers/join/JoinScreens.tsx` (~L164) ignores it: with selfServe on it links to `ORG_PATHS.home`, with selfServe off to `/`. Audit: `docs/audits/login-journeys-2026-10-29.md` (branch `claude/p3-journey-audit`), finding L5.

## Do
1. Make the Done screen's button go to the welcome landing, computed by the ONE helper (no second copy). Find where the redeem result carries the organiser id (the join model / redeem response); if the id is not available on Done, say so and thread it through the existing state, do not invent an RPC. selfServe OFF keeps the plain home link (no welcome screen exists to land on while the area is off).
2. Update the button copy only if it now misdescribes the destination (e.g. "Go to your page" stays true; check `JOIN_COPY.done`).
3. Table-driven test: every flag combination (organiserP3 x organiserSelfServe) x with and without an organiser id; red first on the unfixed code. A refusal or wrong-account screen must not change.

## Done =
Run touched tests and every applicable CI step. Push only (bot opens PR). PR body: "## Verified on real data" with "Shapes surveyed:" (none from the database: routing only, say so), "Checks run:", "NOT verified:", plus "## Phone QA". Final commit subject ends with [worker-done invite-welcome]. Stop at 30% context with a PARTIAL marker.
