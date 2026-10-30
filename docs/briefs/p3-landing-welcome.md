# Brief: new organisers land on the rebuilt P3 Welcome; already-asked state is not a live button

Lane: normal (no DB change, no supabase/**). Model: Opus (routing = new rule). Website repo only. Branch: claude/p3-landing-welcome. One PR. Context cap 50%.
Stopping rule: one build, one independent review (lead runs it), one fix round, then the lead's walk.
Owner decisions 2026-10-30 (click answers): (1) when the organiser area is live (flag organiserP3 ON), a person with NO page yet, or waiting on an open access request, lands on the rebuilt P3 Welcome (`/account/p3/start`, light look), not on the older `/account/o` screens. (2) The already-asked button fix goes in before the flag flip.

## What the owner saw (local copy, flags ON, new account ty5001, 2026-10-30)
1. Sign-up, dancer details, then Add a page: tapped Tropicana (a live page with no claim email): the older dark screens took over, URL `/account/o/done`, "Asked to join Tropicana". Then Back to Home showed the older dark `Find your page` (stepper "Signed in > Your organiser > Your events", copy "During the beta, new pages are approved by hand"). The rebuilt Welcome only appeared when the owner typed `/account/p3/start` by hand ("Hey <name>, you made it!", 0%, button Find your page).
2. In the Find your page sheet for Tropicana: text "We have no email for this page. Ask to join and we will check." and in red "You already asked for access to this organiser. We will get back to you." while the Ask to join button stays live. Wanted: the page row shows "Waiting for an answer, asked <date>", the button is disabled or replaced, with the reason on screen (a disabled control says why).

## What to do
- Read `src/lib/accountRouting.ts` (decideAccountHome / ORGANISER_HOME_PATH, "someone waiting on an open access request lands on the organiser home: unchanged from before"), `src/lib/auth-otp-routing.ts`, `src/lib/p3StartPath.ts`, `src/pages/AuthCallback.tsx`, `src/components/AnimatedRoutes.tsx`, `src/modules/organiser/p3/shell/P3Routes.tsx` and the legacy `/account/o` Add a page / Find your page screens (`src/modules/organiser/**`, grep "Find your page", "approved by hand"). Find exactly which path sends a new organiser to `/account/o` when the P3 flag is ON, and why `/account/o` Add a page does not hand off to P3.
- Make the P3 flag ON case route: no page + no open request -> `/account/p3/start`; open request, no page -> P3 Welcome showing the pending request ("Waiting for an answer"); claim/ask-to-join from the P3 Find your page stays in P3 (done screen inside P3). With the flag OFF nothing changes (prove it with the same table).
- Table-driven routing test: person state {no dancer row, dancer complete + 0 pages, 0 pages + open request, 1 page, several pages, load error} x flag {on, off} x entry {sign-up callback, sign-in, /account, /account/o} -> destination. Red first on main for the cases the owner saw. One shared mapping, no duplicated copy.
- The already-asked state: in the P3 Find your page sheet and the P3 pending row, the button is replaced/disabled with "You asked on <date>. We will get back to you." in normal text, not an error. Test it.
- Do NOT touch `/account/o` screens beyond what the hand-off needs; never edit `perf-budgets.json` or `vite.config.ts`; `/app` first load +0 bytes (run `npm run check:bundle-budget` on main and the branch).
- Also report (do not fix): the wide-desktop layout on P3 `/account/p3/start` Find your page where the search box and the orange Create button ran off the right edge; check at 390x844 and 1280 wide and say if real.

## Done
PR body with real "Verified on real data" (shapes: the person states above, counts only from prod for pages/requests per person), Phone QA section, Not verified. Push with plain git (no --no-verify). Final message ends with [worker-done p3-landing] and lists files, test counts, bundle result, and the layout finding.
