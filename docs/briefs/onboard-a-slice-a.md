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

## Owner clicks 2026-11-17
- Silent create rate limit: 5 per person per day.
- Ticket card for a passed or cancelled event: greyed, QR hidden, plain reason ('This night has passed' / 'This night was cancelled').
- Split: admin repo migration (ensure_my_dancer_profile_v1) lands first by its own worker. This brief's Website worker does items 2-5 only.
- Under 18: no age check.
- Rollout: flags on for everyone at once; rollback = flags off.
- Silent create fails: never block payment; carry on to Stripe, retry on next visit, small plain note.
- 'Not you?' keeps basket. Copy exactly: 'Tickets go to {email}. Not you?'
- Refunded or cancelled order: QR voided, card says 'This ticket was refunded'.
- Owner had no preference, so recommended defaults apply: different-email sign-in = keep separate + note 'Your ticket is under another email' (linking = later duplicate-accounts arc); funnel counts = one daily status line, no new screen; accessibility = labels on every control, focus order, 44px taps, contrast checked in the walk.

## UPDATE 2026-11-17 (DB is LIVE on prod, admin #1950 merged)
- `public.ensure_my_dancer_profile_v1()` is applied. No args. Returns jsonb `{"profile_id": uuid, "created": bool}`. EXECUTE: authenticated only.
- Errors: SQLSTATE 42501 message `not_signed_in` (no session); SQLSTATE 54000 message `rate_limited` (max 5 creations per person per day). Map them to the Website's existing error-code names; if no DancerErrorCode type exists in src, use plain string codes `not_signed_in` / `rate_limited` and do not invent a new error framework.
- Call it silently after sign-in. A failure must never block sign-in or payment. Types: types.ts may not list the RPC yet; cast the rpc name locally rather than hand-editing types.ts (the auto-heal PR regenerates it).
