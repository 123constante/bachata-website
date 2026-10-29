# BRIEF: login dead-ends F1 + F2 (Website, normal lane, Sonnet builds, Opus reviews later)

Branch `claude/p3-login-deadends`, repo bachata-website. ONE slice, one final push (plus an early checkpoint, subject ending [skip preview]).

## Source of truth
Audit on branch `claude/p3-journey-audit`: `docs/audits/login-journeys-2026-10-29.md` (fetch it: `git fetch origin claude/p3-journey-audit; git show FETCH_HEAD:docs/audits/login-journeys-2026-10-29.md`). Read Journey 2, Journey 3 and GAPS F1, F2. Re-verify each file:line on `origin/main` before editing (the audit may be stale by a few commits).

## Owner words
"I want the entire area of the login ... production grade from the moment they click sign in to the end, from the moment an organiser clicks the invite link to claim their profile, from the moment an organiser signs up." A person must never end on a page that looks like nothing happened, or on "not found".

## Fix F1: invite Done button is a dead end when `organiserSelfServe` is OFF
`src/modules/join/JoinScreens.tsx` (around :169) links to `/account/o`, which redirects to `/` when the flag is off. Required behaviour:
- Flag ON: unchanged (goes to `/account/o`).
- Flag OFF: show a clear end state "You're on the team of <page name>" with ONE plain next action that works with the flag off (the page's public organiser page if a route exists, else the homepage), never a button that bounces. Decide from what routes exist; say which in the PR body.
- Read the flag the same way the rest of the module does (`flags.organiserSelfServe` in `src/lib/featureFlags.ts`); no new flag.

## Fix F2: the retired path `/create-organiser-profile` is a 404
Still referenced by: `landingPathAfterAuth` / LEGACY_ROLE_ROUTES in `src/lib/auth-otp-routing.ts`, `ProfileEntryFlow.tsx:57`, `ProfileEntryRouter.tsx:16`, `GetListedHoloCta.tsx:5`, `VendorDashboard.tsx:44`, `OrganiserDashboard.tsx:94` (verify each). Required:
- Grep the WHOLE `src/` and `app/` for every string that points at a retired path (this one and any other path with no route; check the route table in `src/components/AnimatedRoutes.tsx` and `app/routes`). Fix every hit, not only the six.
- Replacement target: the nearest page that exists and does the job. For "Get listed" / organiser sign-up with the flag off, use an existing route or the existing WhatsApp/help link used on other stop screens. Do NOT invent a new page. If nothing fits, send to `/` and say so.
- Add ONE table-driven test: every internal path literal the auth-routing and CTA code can produce (all roles x flag on/off) resolves to a route that exists in the route table. Red first: run it against unfixed code and show it fails on `/create-organiser-profile`.

## Standing header lines
- Prove the data source first (no gate or reader here, but state which routes you verified exist).
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and on the branch, identical; never edit perf-budgets.json or vite.config.ts.
- Overlay geometry: any new sheet/toast stays inside 390x844 and does not scroll the page.
- Table-driven consistency tests: every screen x every shape (flag on/off x each redeem result that reaches Done); no text pointing at a missing control; empty states say what the person can do.
- Run every CI job step that applies (read `.github/workflows`), per-job table in the PR body, Verified / Not verified block, honest "Not verified: live Vercel flag values".
- No raw Unicode punctuation in JSX (use entities). Large files via `scripts/safe-edit.py` / `safe-write.py`. Walk the changed screens at 390x844 (harness screenshots into `docs/handovers/p3-login-deadends/`).

## Do not
Touch the database, admin repo, edge functions, flags or their defaults, `.github/workflows`, calendar density-exempt files. Do not change sign-in logic beyond the dead paths. F3 (go-live wiring), F4 (P3 sign-in default), F5 and all L items are OUT of this slice.

## Hand-off
PR body with Verified / Not verified and per-job table; handover `docs/handovers/p3-login-deadends.md`. Context cap 50%; PARTIAL marker if needed.
