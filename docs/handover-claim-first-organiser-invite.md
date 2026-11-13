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
