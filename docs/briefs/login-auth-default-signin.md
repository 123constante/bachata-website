# Brief: L1 -- bare /auth link defaults to SIGN-IN, not sign-up

Repo 123constante/bachata-website. Branch `claude/login-auth-default-signin`. Normal lane, Sonnet. Max 3 source files plus tests. Login is parked (`/auth` live but unlinked): change behaviour only for a bare `/auth` with no `mode`.

## Context
Audit `docs/audits/login-journeys-2026-10-29.md` (branch `claude/p3-journey-audit`) finding L1: `/auth` with no `mode` shows SIGN-UP (`src/pages/Auth.tsx` ~L116), so a returning person following a bare `/auth` link sees "Join the community". Default to sign-in; the other tab stays one tap away.

## Do
1. Read how `mode` is parsed in `Auth.tsx`; make the absent/unknown mode resolve to sign-in. Explicit `?mode=signup` (and any value that means sign-up today) must still open sign-up. Invite links and `returnTo` must behave exactly as now.
2. Table-driven test: every `mode` value (absent, empty, signin, signup, junk) x with and without `returnTo`/invite, red first (say the absent/junk rows failed on the unfixed code).
3. Search the repo for links to bare `/auth` that expect sign-up (grep `'/auth'`, `"/auth"`, `to="/auth`); if any exist, list them in the PR body and change them to `?mode=signup` only if they clearly mean sign-up.

## Done =
Run touched tests and every applicable CI step. Push only (bot opens PR). PR body: "## Verified on real data" with "Shapes surveyed:" (say none, routing/copy only, and why), "Checks run:", "NOT verified:", plus "## Phone QA" (390x844 look at both tabs). Final commit subject ends with [worker-done auth-default]. Stop at 30% context with a PARTIAL marker.
