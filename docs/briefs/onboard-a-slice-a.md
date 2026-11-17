# Brief: buyer onboarding follow-up, slice A (careful lane, flag OFF)

Owner decisions: ~/.claude/plans/LIVE-feat-event-truth-p1p3.md and DECISIONS-ticket-buyer-onboarding-2026-11-17.md (read both). Everything behind a flag, one branch, one PR. Flags stay OFF.

## Scope (slice A only; B = 'What are you?' save, C = reminder email come later)
1. DB (admin repo bachata-admin-11april, migration first): idempotent `ensure_my_dancer_profile_v1()` SECURITY DEFINER, signed-in only, inserts the auto_stub dancer_profiles row (id = auth.uid()) if missing, returns it. Explicit GRANT/REVOKE. Rate-limited. Measured prod: 61 users, 2 without a row, so the dead end is rare but real.
2. Website: on sign-in / when onboarding finds no_profile, call it silently, then continue. 'Message us' dead end (OnboardingScreen.tsx, api/errors.ts no_profile) stays only as the fallback if the call itself fails.
3. ONE error list: every error path of this flow mapped to plain-words copy in api/errors.ts (no loose strings), with a table-driven test.
4. Free/paid checkout landing: after checkout return the buyer lands on teaser Home with the ticket QR.
5. Picker B1 (TicketPickerB1.tsx): signed-in buyer skips email+code (already built); add line 'Tickets go to <email>. Not you?' above Continue. 'Not you?' signs out, keeps basket, runs email+code for the new email. Tiny copy only; DESIGN-REGISTRY row B1 binds the look.

## Rules
Never apply DDL from the Website repo. Real-data checks per CLAUDE.md definition of done. 390x844 walk. Use HTML entities in JSX.
