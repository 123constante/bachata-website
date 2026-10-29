# BRIEF: login journeys audit (Website, READ-ONLY audit, Sonnet, normal lane)

Branch `claude/p3-journey-audit`, repo bachata-website. Output ONE docs file `docs/audits/login-journeys-2026-10-29.md` plus a handover line in it. No source changes. Supabase read-only (SELECT only, counts only, no personal data).

## Why
Owner (a beginner, wants the whole login area production grade): "from the moment they click sign in from the homepage to the end, from the moment an organiser clicks the invite link to claim their profile, from the moment an organiser signs up via the sign in / sign up page." We need a map of what exists, what works, what is broken or missing, so fixes can be queued in priority order.

## Do
Work from `origin/main` (fetch first). For each of THREE journeys list every screen/route/state in order with file:line, then GAPS.
1. SIGN IN from the homepage: sign-in button -> /auth (auth module, AuthGuard, returnTo handling, magic link / Google / password if present, /auth/callback) -> where a signed-in person lands (dancer app /app, organiser /account, organiser P3 /account/p3), first-time vs returning, and every flag involved (featureFlags.ts organiserP3, organiserSelfServe, organiserTicketing; DB flag organiser_onboarding_gate). Note `/auth` is live but unlinked today: say what links to it and what happens to a person who gets there.
2. INVITE LINK CLAIM: find organiser_invite_preview_v*, redeem_organiser_invite_v1 and the Website routes/components that call them (grep). Cover: valid, expired, already used, wrong account signed in, signed out (sign in then return to the link), organiser already has a page, and where they land after claiming. Read the RPC bodies live read-only to state exact result codes and make sure every code has a screen with a next action.
3. NEW ORGANISER SIGN-UP: sign up -> email confirm -> welcome/onboarding (/account/p3/start OnboardingFlow, you/details PersonFlow, you/add AddPageScreen, claim or create page, go-live via complete_organiser_onboarding_v1) -> first screen after. Include the arrival paths from the invite and from plain sign-up, and the ambassador-city rule (send for review).

## Output format (the file)
Per journey a table: step | route | component file:line | error / empty / expired behaviour | flag-dependent?. Then GAPS ordered FIX FIRST / FIX LATER with a one-line reason each. Look for: dead ends and loops, states with no next action, a signed-in person landing on a 404 or the wrong area, copy that points at a missing control, flag-on vs flag-off differences, a route with no auth guard that needs one, a state a real prod-shaped person would hit (counts only, read-only SELECT of shapes: organisers with owner / without owner, pending invites by status, people with and without dancer rows). Plain English summary of 10 lines at the top for a non-technical owner.

## Do not
Change source, tests, workflows, flags or the database. No raw Unicode punctuation in the file (ASCII). One push at the end (plus one early checkpoint, subject ending [skip preview]). Context cap 50%; PARTIAL marker if needed.
