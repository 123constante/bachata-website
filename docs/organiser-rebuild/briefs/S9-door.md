# Brief S9 -- the door (find your page, claim with the email code, ask to join, create a new page)

Repo `123constante/bachata-website`, branch `claude/org-r1-door`, base `feat/organiser-r1` (wave 5). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S9; plan = `docs/organiser-rebuild/R1-PLAN.md`. Sections: 4.1, 4.2 (onboarding with email-code proof is the path that CREATES a page; C1b is the first screen after it), 4.3 #2 #4, 4.4 (S9 row), 4.5 3.16 additions, 4.11 (`create_organiser_profile_v1` facts; A1b makes it live-at-create with the 24 h cap and name normalisation), 4.12 R3-5, R3-10, D36, D63, D64.

## Owns (4.4 row)
`home/onboarding/**` (C38 find, C39 claim with the email code, C39b-e, C40 ask to join; reuse `shared/sessionProof.ts` + `shared/components/EmailCodeProof.tsx` UNCHANGED, `home/onboarding/citySearch.ts` yours), `flows/newpage/**` (C40, C40b: name, then city = create), tests. Reads `shared/publicClaim.ts`, `shared/claimHint.ts` (`ClaimHint` incl. `no_email`), `shared/components/PublicClaimCard.tsx`, `shared/createCity.ts` read-only.

## Boards (3.16 C38-C40b, amended by R3-5/D63)
- C38 `/` for a login with NO page: "Find your page" search over public organiser pages (existing `publicClaim.ts` read); each result row branches on `ClaimHint` (`claimHint.ts`): `email_matches` -> C39 claim with the email code (`sessionProof.ts` + `EmailCodeProof.tsx`, byte for byte); `email_differs` -> C39c (the code goes to the email on file; copy names only that an email exists, never the address); **`no_email` -> C39 is SKIPPED and the row leads straight to Ask to join (C40) with the copy "This page has no email on file yet. Ask to join and Ricky approves it, usually the same day."** (R3-5, D63 verbatim); `yours` -> Home; `managed` -> Home. Ask to join = the existing access-request write + Done "Asked to join <page>".
- "Create a new page" (C40 -> C40b): name, then city (`citySearch.ts`) = ONE `create_organiser_profile_v1` call; success lands on C1b Home (the four first-steps jobs, D36). An `organiser_name_taken` refusal names the page and offers ONE action, "Ask to join <page>" (R3-5); the 24 h cap refusal shows the server's reason with one action Home. After A1b the page is LIVE on creation: no review copy anywhere.
- D28: no sentences except the D63 line and a refusal's recovery line.

## Tests (3.16 additions + R3-5), RED first
Matrix rows over `ClaimHint`: `no_email` (claim step absent, the D63 copy present, one action), `email_matches` (claim renders `EmailCodeProof`), `email_differs`, `yours`, `managed`; the claim path imports `sessionProof.ts` and `EmailCodeProof.tsx` unchanged (import identity + a checksum test against main's copies); create sends exactly ONE `create_organiser_profile_v1` call and lands on `/` where `homeJobs()` gives the four first-steps jobs; `organiser_name_taken` -> exactly one action naming the page; the cap refusal -> one action; every control >= 44px; clock frozen. `tests/e2e/organiser-onboarding.spec.ts` keeps passing with updated routes.

## Not R1 (for the record, D64)
Setting `organiser_claim_emails` for the 43 pages without an email is the owner's admin task (`queued-organiser-claim-emails.md`); R1 does not wait for it.

## Orchestrator addition (cross-session note from the account-system session, 2026-10-16): sign-out lands on Home
`home/onboarding/SignOutLine.tsx` (line ~26 on main) has a sign-out that lands on the sign-in form. Website PR #789 adds the shared hook `useSignOutToHome` for every dancer/account sign-out (grep it on branch `claude/dancer-journey-fixes`). If the hook exists on `main` or on `feat/organiser-r1` when you start, use it here; if not, do NOT write a parallel hook: leave the call, say so in the handover, and the orchestrator switches it after #789 merges.
