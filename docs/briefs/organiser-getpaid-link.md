# Brief: organiser Get paid link, part A -- the single Get paid screen (link builder, start screen, after Stripe)

Brief-version: 2
Branch: claude/organiser-getpaid-link
Lane: normal, Sonnet. bachata-website; src + tests + docs, NO migration, no supabase/**, no workflow edit. Money-adjacent: you never approve or merge. ONE push at the end. Do NOT touch the event screens, the calendar-protected files named in CLAUDE.md, the auth callback, the OTP routing helper or the invite join screens (part B, branch claude/organiser-getpaid-auth, owns those and runs in parallel; you must not import from its files).
Serves: a non-technical organiser (first: Ritmo Latino, no Stripe row yet) who gets ONE link on WhatsApp, signs in by email link, connects Stripe alone, and sees he can sell tickets. Success = charges_enabled on his page without our help.

## What main lacks
Found by the 2026-11-07 read of origin/main 4504f7fb0:
- a link that carries "go to Get paid after sign-in" -- grep: P3_TICKET_PATHS (only getPaid and stripeBack today; this slice adds names)
- a single-purpose Get paid screen: today's is You > Get paid inside P3PushedShell with a Back-to-You link, plus a setup-steps card and Money so far (GetPaid.tsx, GetPaidScreen / GetPaidBody)
- a "you're ready" state with an Add a ticket button; once connected only the tag and title change today
- polling after Stripe: GetPaidContent refetches the Stripe state ONCE on stripe=return and says "reload the page"

## Files
src/modules/organiser/p3/tickets/paths.ts (exists: add the start path and the link builder)
src/modules/organiser/p3/tickets/GetPaid.tsx (exists: add the start screen beside GetPaidScreen; do not change GetPaidScreen's markup or test ids)
src/modules/organiser/p3/tickets/data.ts (exists: read only)
src/modules/organiser/p3/shell/P3Routes.tsx (exists: one new route, own frame, before the P3Shell group, behind flags.organiserTicketing)
src/modules/organiser/p3/tickets/__tests__/getPaidStart.matrix.test.tsx (new)
tests/e2e/walk-getpaid-start.spec.ts (new)
scripts/auto-walk-manifest.mjs (exists: one WALKS entry and one MAP row)
docs/handover/organiser-getpaid-link.md (new)

## What to build
THE ROUTE PATH CONSTANT, agreed with part B: `/account/p3/get-paid` with the query `?o=<organiserId>` (encodeURIComponent). B writes the same literal in its own files; do not import across. Add a test line asserting `getPaidStartPath('x y')` equals exactly `/account/p3/get-paid?o=x%20y`.
1. The link and the start screen. In paths.ts add `getPaidStartPath(organiserId)` and `getPaidSignInLink(origin, organiserId)` = `${origin}/auth?mode=signin&returnTo=${encodeURIComponent(getPaidStartPath(id))}` (for an organiser who already has a login). New route `get-paid` under the P3 area, own full-screen frame like `start` and `you/details` (no tab bar), behind flags.organiserTicketing, with the existing graceful fallback if the flag is off. The screen `GetPaidStart` (lazy) shows ONLY: heading "Get paid for your tickets", one short note "What Stripe will ask you" (3 plain bullets: your name and date of birth, your bank details so it can pay you, a few words on what you sell; Stripe asks, we never see it), one big Connect Stripe button (reuse useStartOnboarding(org.id).go; 44 px or taller, explicit px not rem), and its error / switched-off note. Organiser = payingOrganiser(home.data, params.get('o')); when `o` is given and not on the account, say "This link is for a page that is not on your account" with a way to the normal Home, never silently show another page; when `o` is missing use payingOrganiser's fallback. A non-manager sees NO button, only "Ask <the owner's name> to connect payments" (owner's name when the home payload already carries it, else "the page owner"; add no read), never a dead button. P3 tokens, no new colours.
2. After Stripe. Add an optional `from: 'start'` argument to `stripeBack` (default unchanged, so You > Get paid keeps working) so Stripe returns to the start path with `&stripe=return|refresh`. On `stripe=return` with state not connected, poll the Stripe state every 3 s for up to 60 s (existing useStripe refetch; stop on connected, on unmount, on timeout): "Checking with Stripe..." then, at timeout, "Stripe is still finishing. This can take a minute." with a "Check again" button. Connected shows "You're ready to sell tickets" and ONE button "Add a ticket" to P3_PATHS.events, or straight to that event when the organiser has exactly one live listed series (reuse the isListedSeries / live test payingOrganiser uses). State 'started' (details still due) labels the button "Carry on with Stripe". `stripe=refresh` says the Stripe link ran out and the button carries on.

## Tests
Table-driven, ONE shared mapping per fact. getPaidStart.matrix.test.tsx rows: signed out (the route sits behind AuthGuard, redirects to /auth?mode=signin&returnTo=<start path>); signed in, no organiser page (no-page card with the way to set up, no dead button); org x role (owner, manager, contributor) x stripe state (none, started, connected) x charges_enabled false/true (assert the connected mapping once) x arrival (fresh; stripe=return pending then connected; stripe=return timeout at 60 s with fake timers; stripe=refresh; startOnboarding error via reasonMessage; not_configured / switched off) x `o` (matches, missing, unknown). Assert: exactly one primary button, no text pointing at a control that is not on screen, "Add a ticket" only when connected, polling stops on connected and on unmount. Link builder: encodes the id, sanitizeReturnTo accepts the result, never off-site. Mutate once each (drop the polling stop, drop the `o` mismatch guard) and see rows fail. Walk spec modelled on the sales report walk spec: fresh, started, return pending, connected, non-manager, wrong `o`; pictures to GETPAID_SHOTS; taps 44 px or more, no sideways scroll; WALKS + MAP entry in scripts/auto-walk-manifest.mjs.

## Verify
New tests, the auto-walk manifest test, the existing getPaid matrix test and the p3 tickets folder, `npm run typecheck`, `npm run check:mojibake` (entities in JSX, not raw Unicode).

## Done when
Both deliverables in, tests green, the handover with Verified / Not verified (Not verified names: a real Stripe round trip, real email delivery, part B's sign-in landing); last commit subject ends with your worker-done marker; one push; do not edit the PR body.
