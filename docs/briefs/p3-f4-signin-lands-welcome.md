# Brief: F4 -- sign-in lands a new organiser on Welcome (BUILD-visual, normal lane, Opus)

Owner decision 2026-10-29: a brand-new organiser who signs in lands on the Welcome find / claim / create page `/account/p3/start`, but ONLY when the `organiserP3` flag is on (flag stays OFF; nothing is switched on in this PR).

## Facts to prove first (standing header)
- Read the login journeys map (open PR #1142, branch `claude/p3-journey-audit`, `docs/audits/`): `git fetch origin claude/p3-journey-audit`. It lists where `/auth` sends each kind of person after sign-in (existing organiser, dancer, invite claim, brand-new organiser).
- Prove the data source: how the app decides "new organiser" (no organiser entity membership / no page). Read the live RPC/policy bodies read-only on prod and say which table/column it depends on. Do not copy permission logic into the client if an RPC answers it.
- Zero bytes to the /app first load: run `npm run check:bundle-budget` on main and the branch; never edit `perf-budgets.json` or `vite.config.ts`.

## Build
1. After sign-in, with `organiserP3` ON: new organiser (no page, no membership) -> `/account/p3/start`. Existing organiser -> their current landing (unchanged). Dancer/other -> unchanged. Invite-claim links keep their own destination.
2. With `organiserP3` OFF: behaviour is byte-for-byte what it is today.
3. One shared mapping (person kind -> landing path), table-driven test covering every kind x flag on/off. Red first: show the new-organiser row failing on the unchanged code. No copy pointing at a missing control.

## Checks
Every applicable CI job step run in your sandbox, per-job table in the PR body (Verified on real data block filled in: shapes = counts of organiser memberships on prod, read-only). 390x844 walk of the Welcome landing after sign-in on a fresh (new organiser) test shape. Design Gate: this routes only, no new visible UI; say so.

## Output
Handover `docs/handovers/p3-f4-signin-lands-welcome.md` with Verified / Not verified. One push at the end, last commit subject ending `[worker-done <ticket>]`. Context under 50%. Never merge or approve.
