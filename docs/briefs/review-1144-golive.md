# Brief: independent review of Website PR #1144 (P3 Go live wiring), read-only

You did not build it. Review `claude/p3-golive-wiring` (head 9d1c8f1d9, +671/-46, 7 code files) against `main`. Change no code.

What it does: the onboarding Go live step calls the RPC `complete_organiser_onboarding_v1` and handles every server answer (review variants, double-tap safe). Files: `src/modules/organiser/p3/onboarding/` OnboardingFlow.tsx, pageApi.ts, pageModel.ts, tests goLive.matrix + pageScreens.matrix, `tests/e2e/walk-p3-golive.spec.ts`.

Check: (1) read the live RPC body (Supabase SELECT/pg_proc only) and confirm every result the client maps exists, and every real result has a mapped screen, with no unmapped fallthrough; (2) double-tap and slow network: one command only, buttons disabled with a reason; (3) no client-side permission or eligibility decision that the server should own; (4) failure states each say what the person CAN do next; (5) nothing turns a flag on (organiserP3, organiserSelfServe, organiserTicketing stay as they are); (6) tests assert the mapping table, not a loosened copy; (7) copy: British English, no text pointing at a missing control; (8) screenshots in docs/handovers/p3-golive-wiring/ match the code states (look at 390x844 dark ones).

Output: `docs/reviews/review-1144-r1.md` on branch `claude/review-1144-r1`: verdict PASS / PASS with should-fix / FIX FIRST, numbered findings with severity BLOCK / SHOULD-FIX / NIT and file:line, concrete failing scenario for each BLOCK, Not verified. Docs-only; push once, subject ending `[worker-done <ticket>]`. Supabase read-only.
