# Brief: dancer dashboard build, continuation 5 (admin #1534): ONE critique fix round on PR #1577

Lane normal. Branch `claude/profile-dash-dancer-build`, PR #1577. No DB change, no `supabase/**`. Read `docs/handover/profile-dash-dancer-build-4-handover.md` first. CI jobs were fixed in continuation 4; do not touch the bundle ratchets again unless a new chunk appears (then say why). `contract-check` is red on main: ignore.
An independent reviewer (impeccable-finish-reviewer) read all walk PNGs and the code. Fix exactly these, table-driven test for each (red first):

1. D4 evidence invalid: `docs/handover/profile-dash/walk/d4-claim.png` is a blank dark gradient. Recapture the initial "Claim your page" screen at 390x844 (wait for the card to render). Also capture states no_match, email_unproven, linked, unavailable; and the Edit screen scrolled to the disabled Save plus its reason line (`edit-untouched.png` stops at "I dance as"). Look at each PNG you produce; none may be blank.
2. `ClaimYourPage.tsx` ~439-444: "Not me" still shows after a result with no retry (no_match, ambiguous); dismissing drops the page's only explanation and Try again. Show the dismiss button only BEFORE the first result. After a result show only Message us plus the retry button where allowed.
3. `ClaimYourPage.tsx` ~411-420: dead end after "linked". `run()` shows "Your page is yours" and hides Try again and Message us. If `profile.refetch()` still returns no profile (cache lag, `already_linked` mapped to linked), the dancer is stuck with no action. Only use the success copy once the refetch has found the profile; otherwise keep a visible "Reload" button (and Message us).
4. `ProfileSwitcher.tsx` ~104: sheet has no max height. Add `max-h-[calc(100dvh-16px)] overflow-y-auto` (header and Close stay reachable); add a test or walk with many profiles (e.g. 3 organisers + sign-out confirm) at 390x844 asserting Close is inside the viewport.
5. `HomeScreen.tsx` ~82-92: a new account with no first_name/display_name shows "Good morning / there" with h1 "there". Show h1 "Welcome" and drop the greeting line in that case.
6. `HomeScreen.tsx` ~132-148: the `linked-notice` card ("We've linked your profile", two buttons) stacks above the main card for a claimed dancer, breaking the one-card calm screen and adding a second CTA. Fold it into one plain line inside the main card (no extra buttons), or drop it now that Claim shows its own success copy. Walk and capture it.
Nit: remove the stray doc comment above `SHOWING_LABEL` (`ProfileSwitcher.tsx` ~25-26).

## Rules
Contrast >= 4.5, taps >= 44px (px not rem). Run every check you can locally (vitest touched dirs, lint, check:mojibake, tsc -p tsconfig.app.json, the profile-dash-walk Playwright spec, `npm run build` + `npm run check:bundle-budget`). Push once; handover `docs/handover/profile-dash-dancer-build-5-handover.md` (NOT docs/briefs) with Verified / Not verified. The orchestrator edits the PR body (you have no gh).
