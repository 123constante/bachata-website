# Brief: P3 organiser area, WHOLE-AREA ACCEPTANCE CONTRACT (docs only; claude/p3-acceptance-contract; Website repo)

Owner 2026-10-30: "I should not have to check everything; you should have created the new shell at production grade." Slices were built and checked one by one; nobody owned the whole. This job writes the contract every later fix is judged against. DOCS ONLY: do not touch src/. Context cap 30%. Supabase read-only (counts only, no personal data). Push once, end with the [worker-done] marker named in the dispatch prompt.

## Step 1 (BEFORE anything else): INVENTORY.md
docs/design/p3-acceptance/INVENTORY.md: every SCREEN and every ROUTE of the P3 area on main (src/modules/organiser/p3/shell/P3Routes.tsx, paths.ts, screens/*, you/*, onboarding/*, events/*, new-event flow) plus every ENTRY POINT into it (sign-in/sign-up landing in src/lib/auth-otp-routing.ts and src/pages/AuthCallback.tsx, claim, invite, /account, dancer home links, Your areas /account/areas). Columns: id | screen/route | who can reach it | entry points | data it reads (RPC) | data it writes (RPC) | states it must handle | file:line.

## Step 2: the contract (docs/design/p3-acceptance/CONTRACT.md)
People (rows): (a) dancer only; (b) dancer who later adds teacher or DJ (the Your areas / DoYouSheet path); (c) new organiser with no page (sign-up as organiser, create a page, claim a page, wait on a request); (d) organiser with live events (many events, weekly/monthly/every-N-months/custom/dates series, courses, festivals, cancelled, past, over the 100-row API cap, no photo, drafts only).
For EACH person, write the journeys as numbered steps from the first tap to the end, with the expected screen text at each step, the empty/error/disabled-with-reason state of each step, and what must be impossible (no dead ends, no text pointing at a missing control, no screen reachable by someone who must not see it, an untouched save sends nothing).
Every journey gets an ID (J-a1 ...), the data shape it needs (a seeded test account spec: counts by status x format x past x cancelled), and a pass/fail line left blank for the walker.
Include the gap list: anything a journey needs that does not exist today (e.g. nothing prompts a dancer-only account to add teaching outside Go live; the sign-up screen does not say what each role leads to) with a severity.

## Step 3: shape survey and test accounts
Read-only prod counts of the shapes in the contract (status x format x repeat rule x past x cancelled x over-cap). Write docs/design/p3-acceptance/ACCOUNTS.md: the exact seed spec for each test account the walker needs (the lead creates them; do not write to prod).

## Step 4: coverage count
End CONTRACT.md with "Coverage: N inventory rows, N covered by a journey, list of uncovered and why". Zero silent omissions.
