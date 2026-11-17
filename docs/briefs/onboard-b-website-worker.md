# Brief: buyer onboarding slice B, WEBSITE half only (careful lane, flag OFF)

Read `docs/briefs/onboard-b-slice-b.md` (scope items 2-4 are yours; item 1, the DB, is DONE and live on prod).
Also read DECISIONS-ticket-buyer-onboarding-2026-11-17.md and the DESIGN-REGISTRY rows 'Buyer onboarding B+C' (+ round 2) and 'Ticket picker' under ~/.claude/plans/. Base = main (slice A #1763 merged).

## DB contract now live (admin #1956, migration 20261117214202, applied to prod)
- `set_my_buyer_roles_v1(p_roles text[]) returns text[]`, authenticated only. Allowed: dancer, organiser, teacher, dj. `{}` allowed. De-dupes, stored order dancer/organiser/teacher/dj.
- Errors (map ALL in api/errors.ts, table-driven test): 42501 `not_signed_in`, 22023 `invalid_roles` (null), `too_many_roles` (>4), `unknown_role`, P0002 `no_profile`.
- Read: `my_dancer_edit_v1` shape now returns `buyer_roles` (text[]). Resume = pre-tick what is saved.
- Organiser attendee views already return `buyer_roles` per paid order. Showing it in the organiser UI is OUT of scope here.
- Never apply DDL from this repo. Do not touch `buyer_roles` on any public read.

## Do
1. 'What are you?' = first step of the 'Finish your profile' card on My tickets. Dancer / Organiser / Teacher / DJ, multi-pick, skippable, resumable. Saves via the RPC through the existing dancer-app rpc/gateRpc layer (see slice A files: src/modules/dancer-app/api/*, src/modules/tickets/MyTicketsPage.tsx, TicketCard states).
2. Organiser picked: card on My tickets 'Set up your organiser page' linking to the EXISTING organiser create flow. No new screens.
3. Flag: reuse `src/lib/buyerOnboardingFlag.ts`; everything OFF by default; flag-off render must be byte-identical to today.
4. Fake backend + tests: extend fakeBackend with the RPC; matrix test for flag on/off, empty pick, skip, resume, each error code.

## Rules
390x844 walk (measured numbers, 44px taps, labels on every control), HTML entities in JSX, British English, plain warm copy, `npm run pre-ship`. One PR, bot-authored. Real-data check: read-only count of dancer_profiles with non-empty buyer_roles on prod (stsdtacfauprzrdebmzg) must be 0 before flag on; state the number.
