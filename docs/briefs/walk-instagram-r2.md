# Brief: 390x844 walk of PR #1272 (Instagram checklist rows, move link, refusals) -- tests + pictures only (Sonnet, normal lane)

Branch `claude/walk-instagram-r2`, cut from branch `claude/instagram-refusal-r2` (head 1dea71d; fetch it, branch from it). You change NO file under `src/` and NO existing test. You add `tests/e2e/walk-instagram-r2.spec.ts` and `docs/walk/instagram-r2/RESULTS.md` plus pictures. Copy the pattern of `tests/e2e/walk-join-firstname-help.spec.ts` on `claude/walk-join-help-r1` and `tests/e2e/walk-join-outcomes.spec.ts` (network-boundary mocks, no prod, no sign-in, frozen-clock CSS fix). Read `docs/handover/instagram-refusal-r2.md` on the PR branch first.

## What PR #1272 does
(A) P3 onboarding Review rows: `instagram` opens `/app/me/edit?focus=instagram&returnTo=<Review>`; `dj_answer` and `dj_genres` open new DJ steps; unknown codes open an in-flow screen. (B) An Instagram profile link typed in Website on `/app/me/edit` moves to Instagram and clears Website (one save). (C) Refusal wording: invalid = "Enter your Instagram handle (like @yourname) or a full instagram.com link."; taken = "That Instagram is already on another profile. Check the spelling, or message us if it is yours." Review round 1 also made `m.instagram.com` links move.

## Do (every picture 390x844, mocked answers; the app's real router)
1. `/app/me/edit` Website field fixtures, each: type a link and save, then read what was SENT (the one save call body) and what the screen shows: {https://www.instagram.com/simonliftslife/ with Instagram empty = moves; same handle already in Instagram = Website cleared, no error; different handle in Instagram = what the screen says (read the code; report exactly); https://m.instagram.com/x = moves; instagram.com/p/abc post link = does NOT move; a normal website = stays}.
2. Refusals: server answers `invalid_instagram` and a 23505 on the Instagram index (`instagram_taken`) and a 23505 on another index: assert the exact wording and that a non-Instagram 23505 is not reported as an Instagram problem. Screenshot each.
3. Checklist rows from the P3 Review screen x {base-incomplete, base-complete, no_profile}: tap `instagram`, `dj_answer`, `dj_genres` and an unknown code; assert each reaches a control for ITS field with no bounce back to Review; after saving Instagram the Review row is gone with no reload. Screenshot each landing.
4. DJ steps: "Do you DJ?" yes/no, "Music you play" (comma list, 20 items x 80 chars limits: show the reason text); an untouched answer sends nothing (assert zero calls).
5. Per picture measure: taps under 44px, sideways scroll, text contrast >= 4.5, console errors, the focused element for `focus=instagram`.
6. RESULTS.md: table of every picture with the measured numbers and the request bodies; honest Verified / Not verified (no prod data, no real account, mocked server).
Run `npx vitest run src/modules/dancer-app src/modules/organiser/p3/onboarding` and report the count.

BASE CHECK: verify `git merge-base HEAD origin/claude/instagram-refusal-r2` equals its head before pushing. If a case contradicts the PR's behaviour, report it as a FINDING with the failing input; do not fix `src/`. Context cap 50%. Last commit subject ends with the done marker from your prompt.
