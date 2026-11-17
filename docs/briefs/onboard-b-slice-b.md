# Brief: buyer onboarding slice B, 'What are you?' save + organiser card (careful lane, flag OFF)

Read first: ~/.claude/plans/LIVE-feat-event-truth-p1p3.md, DECISIONS-ticket-buyer-onboarding-2026-11-17.md, and the DESIGN-REGISTRY rows 'Buyer onboarding B+C' and 'Ticket picker'. Slice A (#1763, merged) is the base; reuse `buyerOnboardingFlag` (new flag value, default OFF).

## Scope (slice B only; C reminder email waits for its own prototype round)
1. DB (admin repo bachata-admin-11april, own worker, migration first): `set_my_buyer_roles_v1(p_roles text[])`, SECURITY DEFINER, signed-in only, saves roles on the caller's dancer_profiles row. Allowed values: dancer, organiser, teacher, dj; empty array allowed (skippable); unknown value raises. Explicit GRANT/REVOKE. Read path: roles come back in the existing my-profile read. Organiser attendee view (organiser_attendees read) exposes roles ONLY for buyers of that organiser's events, never public.
2. Website: 'What are you?' first step of the 'Finish your profile' card on My tickets. Choices: Dancer / Organiser / Teacher / DJ, multi-pick, skippable, resumable. Save through the RPC. Errors via api/errors.ts (one list, table-driven test).
3. Organiser pick: card on My tickets 'Set up your organiser page' linking to the EXISTING organiser create flow. No new screens.
4. Private: role is never shown on the public dancer page.

## Rules
Never apply DDL from the Website repo. Flag OFF. Real-data checks per CLAUDE.md (read-only counts, prod project stsdtacfauprzrdebmzg). 390x844 walk, 44px taps, labels on every control. HTML entities in JSX. One PR per repo.

## Owner clicks 2026-11-17
Four roles, multi-pick, skippable. Organiser pick = link card, nothing else. Role private to organisers the buyer bought from. No age check.
