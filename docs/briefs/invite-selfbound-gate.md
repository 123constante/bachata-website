# Brief: self-bound invite links go through DancerProfileGate (continuation on PR #959)

Repo: 123constante/bachata-website. Branch: `claude/invite-type-email` (PR #959, head 0c7479dc, built by a previous worker; this is a continuation on the same branch, not a new PR). Lane: normal (Website only, no DB change). One push.

## Why (owner decision 2026-10-22, already made: do not reopen)
The owner chose "dancer profile first" for SELF-BOUND links: a link with no email that the organiser bound to their own typed email (#959's type-your-email step). Admin PR #956 (not yet applied) makes the server's redeem keep the dancer-profile gate when `organiser_invites.bound_via = 'self'`, and adds a fifth key `self_bound` to the `organiser_invite_preview_v1` answer:
- key ABSENT for an unbound link (and absent on today's prod server, which is still pre-#956),
- `false` for an admin-bound link (the sender typed the email),
- `true` for a self-bound link.

Today, `src/modules/admin-organisers/InviteRedeemPage.tsx` (~line 119) does
```ts
const bound = info?.emailHint != null;
if (bound) return <InviteRedeem preview={info} />;
```
which skips DancerProfileGate for EVERY bound link, self-bound links included. After #956, the server would refuse those redeems with the profile-gate answer instead of the page sending the person to finish their profile first.

## Task
1. `src/modules/admin-organisers/inviteModel.ts` `parsePreview`: add `selfBound: boolean` to `InvitePreview`, set to `r.self_bound === true` (missing, null or any non-true value = `false`). Do not change any other field.
2. `InviteRedeemPage.tsx`: skip the gate only for an admin-bound link: `const skipGate = info?.emailHint != null && info.selfBound !== true;`. A self-bound link renders `<DancerProfileGate fallback={checking}><InviteRedeem preview={info} /></DancerProfileGate>` like an unbound one. Update the comment above it in one line (bound by the SENDER skips; self-bound and unbound finish the dancer profile first).
3. Redeem still happens ONLY from the Join click (do not add an auto-redeem). Signed-out behaviour is unchanged (the gate passes signed-out visitors through to the page's own sign-in card / BindEmailStep).
4. Safe degrade: if the key is absent (today's prod), behaviour is EXACTLY as now. Prove this with a test.

## Tests (table-driven, one shared table)
In `src/modules/admin-organisers/__tests__/` (extend `invitePreview.test.tsx` for the parser; add or extend a page test for the routing):
- parser: `self_bound` true / false / absent / null / "true" (string) -> selfBound true / false / false / false / false.
- page: {unbound (no email_hint), admin-bound (email_hint, self_bound false), self-bound (email_hint, self_bound true), bound with key absent (pre-#956 server)} x {dancer profile complete, incomplete} x signed in. Expected: gate shown only when profile incomplete AND (unbound OR self-bound); admin-bound and key-absent bound go straight to InviteRedeem; when complete, InviteRedeem renders in every row; no redeem call happens without the Join click in any row.
- Update `routes.matrix.test.tsx` only if it needs the new field.
Run the targeted tests, `npx tsc --noEmit`, lint on the touched files, and every CI job step the workflows run (read `.github/workflows/*.yml`) that can run in your sandbox; put the per-job table in the PR body.

## PR body (edit #959's body, keep its existing sections)
Add a short "Self-bound links" paragraph, and keep `## Verified on real data` (Shapes surveyed: / Checks run: / NOT verified:) and `## Phone QA` (Sizes checked: 390x844, Walked:, Not verified:) valid: the checks fail without them. Say plainly that the self-bound path cannot be walked on prod until #956 is applied.

## Boundaries
Files: only `src/modules/admin-organisers/**` (+ the handover doc below). Do not touch BindEmailStep's behaviour, the admin repo, migrations, workflows, or .env files. Handover: append a "Continuation 2026-10-22: self-bound gate" section to `docs/handovers/invite-type-email.md` (done / left / verified / not verified).
