# Review: Website slice 3c (auth code screens, consent, funnel)

Branch `claude/account-grid-3c` head dd1fe33c against base `claude/account-grid` b58f39d. Read-only review; no code changed.
Reviewer branch `claude/account-grid-3c-review`. Ticket dt_58b518efb439.

**VERDICT: 1 blocking** (plus 4 should, 5 notes)

## Blocking

### B1. Sign-in and sign-up now wait on an un-timed consent RPC; a slow or hung request leaves the person on a dead code box
`src/pages/Auth.tsx:343-358` (`handleCodeVerified`, `handleAccept`), `src/lib/termsConsent.ts:13-40`, called from
`src/components/MagicLinkConfirmation.tsx:122` via `onVerified={() => void handleCodeVerified()}` (`Auth.tsx:419`).

After `verifyOtp` succeeds, sign-IN `await`s `hasAcceptedTerms()` (`my_account_export_extras_v1`, the FULL personal export:
feedback, interest, consents, erase request, photo flags, rate-limit rows) and sign-UP `await`s `acceptTerms()` before
`continueToCallback()`. Neither has a timeout. `onVerified` returns synchronously, so `MagicLinkConfirmation`'s `finally`
immediately clears `isVerifying`: during the wait the code box is filled, re-enabled, and shows no "Checking" text.
**Failure scenario (reproduced):** a scratch copy of `AuthConsentFunnel.test.tsx` with `my_account_export_extras_v1` never
settling: after a correct code and 3 s, `callback=false boxDisabled=false checking=false`. On a phone on a weak signal the
person types a correct code and nothing happens; if they re-type, `verifyOtp` on the spent token fails, the box says "That
code is wrong or has expired" and the wrong-code count goes up (towards the D7 lock) while a navigation is still pending.
Even when the RPC answers, every sign-in gains one extra serial round trip. "Any failure answers true" only covers
errors, not slowness. Per the brief, a slowed or blocked sign-in counts as blocking.
**Fix:** wrap both calls in a short race (e.g. 2.5 s; on timeout `hasAcceptedTerms` answers true and `acceptTerms` answers
false); keep a visible busy state ("Signing you in&hellip;", box disabled) from code-OK until navigation, either by
making `onVerified` return a promise that `verify` awaits before `finally`, or by having Auth render a busy state. Better:
read consent with a narrow call (a `my_terms_accepted_v1(kind, version)` boolean, admin-side) instead of the whole export.
Add a table row "consent RPC never settles -> callback within the timeout" to `AuthConsentFunnel.test.tsx`.

## Should

### S1. `TERMS_VERSION` differs from PR #762, and there are two constants for one fact
`src/lib/termsConsent.ts:5` has `TERMS_VERSION = '2026-10-15'`; `claude/site-legal-pages` `src/lib/legalVersions.ts:3-4`
has `TERMS_VERSION = '2026-10-16'` and `PRIVACY_VERSION = '2026-10-16'`. **Failure scenario:** both merge; every sign-up
records `terms_privacy 2026-10-15` while `/terms` says "updated 2026-10-16". The consent record names a version of the text
that was never published, and the next bump of either constant alone re-asks everyone or no one. **Fix:** one shared
module (whichever lands second imports the other's `legalVersions.ts`); `termsConsent.ts` re-exports from it. Since the kind is
the combined `terms_privacy`, use one version (or `max` of the two) and add a test that the consent version equals the page
version.

### S2. Left 4 rated: if the dancer area is closed for a person, the accept card comes back on every sign-in and the button records nothing
`Auth.tsx:350-358`, `termsConsent.ts:13-19`. `accept_terms_v1` calls `_dancer_area_require_v1()` first (admin
`20261121150000`, `20261121060000`): with `dancer_area_open = false` an unlisted person gets `42501 area_closed`.
`my_account_export_extras_v1` is deliberately NOT gated, so it returns `consents: []` and the card shows; the tap swallows the
refusal and continues. Nobody is stuck (the tap still continues), but they are misled ("Accept and continue" stores nothing)
and nagged on every sign-in, against the owner rule (a control that cannot work is disabled with a reason, or not shown).
**Live today?** No. Prod (read-only SELECT, 2026-10-16): `dancer_area_open = true`, 1 listed address, 15 confirmed accounts,
0 `member_consents` rows, so accept works for everyone and all 15 existing accounts see the card once. It goes live the
moment the flag is closed. **Fix (pick one):** admin moves `accept_terms_v1` out of the beta gate (consent is not a dancer-area
feature, the same reasoning that left the export ungated); or the Website reads `dancer_area_gate_v1().allowed` and skips the
card (`hasAcceptedTerms` answers true) when false. Either way add a test row "area closed -> no card".

### S3. Funnel outcome `wrong` never fires: every wrong code is counted as `expired`
`src/components/MagicLinkConfirmation.tsx:126`. Supabase answers a wrong code with "Token has expired or is invalid" (the
repo's own fixtures use exactly this: `AuthCodeStep.test.tsx:74`, `journeyHarness.ts:171`). The message contains "expired",
so the ternary picks `expired` for every wrong code. **Failure scenario:** the admin funnel shows 0 wrong / N expired and the
owner concludes codes arrive too late. **Fix:** classify on `error.code` (`otp_expired` vs others) when present; when the
message is the ambiguous combined one, send `wrong` (or one bucket) and say so in a comment; add the message as a table row.

### S4. E-mailed-link sign-up records no consent (Left 2)
The link lands in `/auth/callback` (3b's file), which does not call `acceptTerms()`. A person who signs up by tapping the
link saw the clickwrap but has no record until a later typed-code sign-in shows the card; a link-only person is never
recorded. **Fix (3b):** in the callback for `mode=signup`, call `acceptTerms()` (with the B1 timeout) before routing. Not
fixable inside 3c's files; the handover already lists it.

## Notes

- N1. `src/components/auth/TermsAcceptCard.tsx:11` `'Saving…'` contains a raw U+2026; CLAUDE.md's HTML-entity rule bans pasted
  Unicode punctuation in source (mojibake risk). Use `'Saving…'` or `Saving&hellip;` in JSX.
- N2. `tests/fixtures/auth-funnel-contract.sql` is a hand-merged copy: the step CHECK is from 20261122190000, the landing-only
  outcome CHECK from 20261122250000 (the header cites 330000, which only changes the writer and the guard). The contract test
  compares the union with this copy, not with admin's SQL, so admin drift is caught only when someone re-pins. Lists match
  admin `claude/account-system-db` f7b5a160 today (10 steps, 7 outcomes, `^S-[A-Z0-9-]{1,20}$` landing-only).
- N3. Tests that pass on the base too (do not prove the change): "a wrong code records no consent" and "a failed consent read
  never walls sign-in" (the base never calls either RPC). Harmless as guards; the remaining rows fail on the base as claimed.
  `trackAuthStep.test.ts` asserts the mock's call log, but also the real behaviour (returns undefined, no throw, all five
  failure shapes) -- acceptable.
- N4. `auth_view` fires on every `/auth` mount (including "Use a different email" re-renders that remount); counts are views,
  not people. Fine for a counter; worth one line in the funnel doc.
- N5. Funnel RPC is not on prod (`record_auth_funnel_step_v1` absent, checked read-only); calls 404 and are swallowed, as designed.

## Checked and fine

- **D7** (unchanged from base): key `auth_code_step_v1` (`MagicLinkConfirmation.tsx:38`), 10-minute TTL, 5-wrong lock with
  "Send a new code", resend resets (`rememberCodeStep` writes `wrong: 0`). The stored step carries the e-mail and the wrong count
  only applies to the same e-mail. The key is in `PERSON_SCOPED_SESSION_KEYS` (`src/lib/personScopedStorage.ts:43`), and 3ad's
  sign-out (`origin/claude/account-grid-3ad` `src/hooks/useAuth.tsx:146` `clearPersonScopedStorage()`) clears that list, with
  the key asserted in 3ad's `personScopedStorage.test.tsx:69`. No cross-slice line needed.
- **D8**: clickwrap only when `mode === "signup"` (`Auth.tsx:420`); `accept_terms_v1` called once, only after `verifyOtp`
  succeeded, with `p_kind: 'terms_privacy'`, `p_version` matching admin's argument names and its `^[0-9A-Za-z._-]{1,32}$`
  version rule. One-button card, no scroll wall; an old version on file counts as not accepted.
- **Funnel**: only pinned values; the call is not awaited (`void Promise.resolve(...).then(noop, noop)`), sync throws caught,
  a never-settling promise does not block; args are only `p_step`, `p_outcome` (no e-mail, no id). The RPC is granted to anon,
  so `auth_view` / `code_sent` before sign-in are accepted server-side.
- **a11y**: `autocomplete="one-time-code"`, `inputmode="numeric"`, `<label for>` plus `aria-label`, an always-mounted
  `role=alert aria-live=assertive` region referenced by `aria-describedby`, `autoFocus` when the box opens after send.
- **Files**: only `Auth.tsx`, `MagicLinkConfirmation.tsx`, `notes.tsx` (comment only), new files, grid docs. Nothing in 3ad's
  files, `accountRouting.ts` or `src/modules/organiser/**`; `git merge-tree` with `claude/account-grid-3ad` is clean.
- **Tests run here** (`--pool=forks`): trackAuthStep (x2), AuthConsentFunnel, `src/components`: 16 files, 357 tests, exit 0.

Not checked: the Playwright build walk and screenshots (not re-run), bundle budget, GitHub Actions.
