# Handover: claim-first organiser invite (dt_6158b3d67076)

Brief: `brief/claim-first-organiser-invite:docs/briefs/claim-first-organiser-invite.md` (sha 16dd877).
Branch: `claude/claim-first-organiser-invite`. Flag: `VITE_ENABLE_CLAIM_FIRST_INVITE=true` (OFF = /invite unchanged).

## Done
- `/invite/:token` (join/JoinPage) with the flag on: an OPEN link whose next step would be the email box or
  "A bit about you" shows the **claim screen first** (`join/ClaimFirst.tsx`): organisation logo (or first letter),
  name, "You are taking over this organisation", who sent it, "Yes, that's mine. Continue", WhatsApp help.
  The confirm writes nothing (no RPC); it is kept per tab per link (sessionStorage, last 12 chars of the token).
- After confirm: signed out -> email/code as before; signed in without a finished profile -> **"Now about you"**
  (same AboutStep, same `saveMyDancerProfile` write path, no new RPC). Label "Your own first name", help
  "Like Maria or Carlos. Not <org>.". Typing exactly the organisation's name (case/accents/punctuation ignored)
  keeps Continue disabled with the reason beside the field.
- Never shown on: code step, join (finished profile), done (already on team), dead links (expired/revoked/used),
  wrong account, stops.
- Tests: `join/__tests__/claimFirst.matrix.test.tsx` (80): 7 prod shapes x 4 invitees x flag on/off, plus claim,
  About refusal, model tables. Walk: `tests/e2e/walk-claim-first-invite.spec.ts`, shots in `docs/walk/claim-first-invite/`.

## Left / next steps
- **Logo needs an admin-repo migration**: `organiser_invite_preview_v1` does not return a logo. The client already
  reads an optional `organiser_logo_url` (https only). Admin repo: add `'organiser_logo_url', op.avatar_url` (or the
  canonical logo column) to the preview's jsonb. Until then the claim screen shows the first letter.
  (Prod survey: every invite's organiser but one has a logo.)
- The original inbox message was truncated after point 3; copy is kept plain. Owner may want wording changes.
- Turn the flag on in Vercel when happy; then Ricky's phone test.
- No RLS/ACL change, no new write path, no prod writes.

## fix1 (2026-11-13, ticket dt_5bb93d30f06c)

Brief: `docs/briefs/claim-first-organiser-invite-fix1.md` on `brief/claim-first-organiser-invite-fix1`.

- Done: `ClaimFirst.tsx` logo `<img>` now has `loading="lazy"` (`AUDIT_STRICT=1 npm run check:images`: 0 missing).
- Done: `claimFirst.matrix.test.tsx` builds the real redeem key (`organiser_id`, which `interpretRedeem` reads) from parts,
  so the `lint:architecture` allowlist entry for this test was removed again; `scripts/lint-runtime-architecture.mjs` now equals main.
- Found, not changed (out of scope): the `on_team` case still passes when the redeem key is wrong (a mutation to `'nope'` stays 80/80),
  so that mock's key is not what the test proves. A follow-up could assert the Done target for an already-member.
- contract-check at 0c8f5bd was red on live-DB checks that do not name this PR's files:
  `purge_stale_dates_v1` unruled delete path / `check_occurrence_delete_booking_safety_v1` missing (admin migration 20260810220000),
  and the event-write door guard live report (`healthy=false`, 5 violations). Needs the admin repo, not this branch.

## Round 2 (2026-11-14, ticket dt_287819c708d5) — brief `docs/briefs/invite-claim-then-about-you.md`
- Done: "Now about you" shows the organisation ("You are taking over / <name>") above the person fields.
- Done: the organisation-name check is now SOFT (`nameIsCloseToOrganisation`: same name, a typo, or the whole name plus a word). Amber `role=status` line; Continue is NOT blocked. Flag off = unchanged.
- Tests: `claimFirst.matrix.test.tsx` 86 pass; join folder 734 pass. Walk (flag on) 4/4, shots refreshed. Note: the walk needs `VITE_ENABLE_CLAIM_FIRST_INVITE=true` or C1/C3 time out (same on main).
- tsc (tsconfig.app.json): 0 errors in touched files; 5 pre-existing errors in untouched join test files.
- Left: logo still needs admin `organiser_invite_preview_v1` to return `organiser_logo_url` (admin repo). Not verified: real prod SELECT shape survey this run, real-device phone, teamsueno2026 (untouched by flag-gated code, not exercised).
