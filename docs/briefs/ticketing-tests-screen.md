# Brief: tests for the Tickets screen and the magic-link return (Sonnet, normal lane)
Repo bachata-website. Branch claude/ticketing-tests-screen. Tests only: NO production code changes, no flags, no migrations, no SQL. Do not touch src/components/ui/dialog.tsx or the calendar density files.

## Why
A read-only audit of main found two untested paths in the ticketing go-live:
1. The dashboard Tickets screen (src/modules/dancer-app/screens/tickets: TicketsScreen, TicketCard, model, useOrderStatus, useTicketCard) has no dedicated tests; only shell, DancerHome ticketsRow and rpcContract tests touch it.
2. Nothing tests that the magic-link sign-in (src/pages/Auth.tsx signInWithOtp emailRedirectTo, AuthCallback.tsx) returns a buyer to /account/my-tickets.

## Build
- Add focused vitest + RTL tests for (1): loading, empty, ticket list render, a paused/locked state, and the view-only locked behaviour the code actually implements. Assert on what the code does today; read the files first. Use the repo's existing test helpers and mock patterns for Supabase RPCs.
- Add a test for (2): the redirect target built for a my-tickets sign-in, and the callback landing on /account/my-tickets. If the code does not currently support a return target, write the test for what it does and state that gap in the PR body; do not change production code.
- If a test reveals a real bug, do NOT fix it: add it to the PR body under "Found, not fixed".
- Register any new e2e spec by name in the explicit list in scripts/check-e2e-spec-coverage.mjs only if you add one (prefer unit tests only).

## Done when
npm run test:unit passes for the new files, npm run lint clean on them, PR body has "Verified on real data" and "Phone QA" sections (say honestly what was not verified, e.g. no real phone, no pre-ship if not run). Files over 2 KB: use scripts/safe-edit.py / safe-write.py. JSX entities as &mdash; etc.
