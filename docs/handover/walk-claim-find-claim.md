# Walk A: an organiser finds an unclaimed page and claims it (REPORT ONLY)

Ticket dt_921a9bef4cf3. Brief: `docs/briefs/walk-claim-find-claim.md` (branch `brief/walk-claim-find-claim`).
Scope: starts where PR #1303 (invite first-minute recheck) ends: signed in, looking for a page. No product code changed.
Note: the brief names `gateRule.ts`; it does not exist on main (`gate.ts` + `gateModel.ts` hold the rule).

## Prod shapes (read-only, counts only, 2026-11-06)
| Shape | Count |
|---|---|
| Live organiser pages | 50 (no draft / paused / other lifecycle rows at all) |
| ...with at least one member | 47 (14 with an owner, 33 with managers only, no owner) |
| ...with NO member (unclaimed) | 3 |
| Unclaimed pages linked to series (incl. past) / with a future date | 22 series links / 4 series |
| Live pages with a future date, all | 31 |
| Pages with a `contact_email` (live) | 5; of the 3 unclaimed: 0 |
| Private claim-email rows (`organiser_claim_emails`) | 0 |
| Distinct people who are members of any page | 17 |
| Organiser invites issued | 17 |

What this means: only 3 of 50 pages can be "claimed" at all, and none of them can use "Claim it": no claim email exists, so
the hint is `no_email` -> **Ask to join** (Ricky approves). "Claim it" (hint `email_matches`) is reachable on 0 pages today.
47 pages show "already has an owner" -- 33 of those have only managers.
Pending-request counts: not readable (no table exposed; only `list_organiser_access_requests_v1`). Not verified.

## States a claimer can meet (claimStates.ts + OnboardingFlow.tsx)
| # | State | Words on screen | Driven by |
|---|---|---|---|
| 1 | email_matches (6c) | row "Email on file is yours"; sheet "Claim X" / "Your email matches the one on file." / [Claim it] | vitest pageScreens.matrix:226 |
| 2 | managed (6b) | row "Has a team"; "X already has an owner" / "You can ask to join the team." / [Ask to join] | code only |
| 3 | email_differs (6d) | row "Has an email on file"; "Is X yours?" / "The email on file is not yours. Ask to join and we will check." | code only |
| 4 | no_email (6e) | row = whole D63 sentence; "We have no email for this page. Ask to join and we will check." | code only (row text via pageScreens) |
| 5 | yours (6a) | "X is yours" / [Go to Home] | code only |
| 6 | hint call failed (unknown) | row "Ask to join"; "Ask to join and we will check." | code only |
| 7 | request pending | row "Waiting..." (waitingRowText); sheet = asked line + Close | vitest alreadyAsked.matrix:102 |
| 8 | request_already_open (stale list) | same asked line, not red | vitest alreadyAsked.matrix:126 |
| 9 | claim refused: mailbox_unproven | "First confirm this email is yours with the code from your email." + [Confirm with an email code] | vitest pageScreens.matrix:242 |
| 10 | claim refused: organiser_already_claimed / email_mismatch / no_contact_email | selfServeErrors.ts:53-65 text, red, button stays "Claim it" | code only |
| 11 | ask succeeded | "Asked to join X" Done screen | vitest pageScreens.matrix:250 |
| 12 | no page found | "No page called "q". Create one below." | code only |
| 13 | search failed | "The search didn't work. Check your connection and try again." | code only |
| 14 | term under 2 letters | "Type two or more letters." | code only |
| 15 | GateSheet unknown / loading / read failed | "Checking what's left...", "We couldn't load your details. Try again." + [Try again] | vitest gate.matrix, gate.fixround |
| 16 | GateSheet left / not-yours | count + rows; Continue disabled + "These details are for a page you don't run..." | vitest gate.matrix |
| 17 | ClaimNotice after auto-claim | "You now manage X. Not you? Tell us" + Close | vitest ClaimNotice.test (5) |

## Ranked dead ends (worst first: would an organiser give up here)
File:line is on main at a661186.

1. **"Not listed? Create a page" leads to a refusal at the end.** OnboardingFlow.tsx:537 (footer on Find) and :697 ("Create one below."). The person types a name, a city, taps "Create page", and the server answers `organiser_invite_required`: "Creating a new organiser page needs an invite from the Bachata Calendar team. Message us and we'll set you up." (selfServeErrors.ts:26, :104). Next action: contact support (one action). Three screens of work first. Gives up: very likely. 
2. **A page that is not `live` can never be found.** selfServeApi.ts:155-157 (`lifecycle_status = live` only). Prod has no non-live rows today, so this is latent; when one exists the organiser sees state 12 and goes to dead end 1.
3. **The only claimable pages today cannot be claimed, only requested, and "usually the same day" is a person.** claimStates.ts:28 "Ask to join and Ricky approves it, usually the same day." (names an individual; 3 of 3 unclaimed pages hit this; 0 claim emails exist). Next action: Ask to join, then wait; nothing says how they will hear back. After sending: "We will check your request and the page team will be in touch." (claimStates.ts:73) -- "the page team" is empty for an unclaimed page. Gives up: likely, waits.
4. **"already has an owner" is wrong for 33 of 47 held pages.** claimStates.ts:48 "X already has an owner" / "You can ask to join the team." Those pages have managers and no owner (prod). The organiser who IS that page's person is told someone owns it and asked to join a team of strangers. Next action: Ask to join (one). Likely confusion/abandon.
5. **Search is name-only, substring, first 8 by name, no city.** selfServeApi.ts:153-160. A common name ("Bachata ...") can push the right page off the list with no "more" and no way to narrow; prod has 50 live pages so today it bites only on short terms. Next action: type more.
6. **email_differs says "not yours" with no way to fix it.** claimStates.ts:51 "The email on file is not yours. Ask to join and we will check." The person cannot see which address, cannot correct it. Next action: Ask to join only. A real owner with a changed email waits on a human.
7. **A refused claim leaves the same button.** OnboardingFlow.tsx:818-824; copy at selfServeErrors.ts:53-65 says "Request access" but the screen has no such button: after `organiser_already_claimed` / `email_mismatch` / `no_contact_email` the sheet still shows [Claim it] (primary stays 'claim') plus the red line. CLAUDE.md says no copy may point at a control not on screen. Only "Not this one" escapes. Gives up: likely (re-tapping a button that cannot work).
8. **Search failure has no retry control.** OnboardingFlow.tsx:693 "The search didn't work. Check your connection and try again." No button; the person must retype to re-query (retry:false at :686). Next action: edit the box.
9. **Silent hint failure.** selfServeApi.ts:165 swallows the hint call; every row then reads "Ask to join" (state 6), so an owner whose email matches is demoted to a manual approval with no signal. Next action: Ask to join.
10. **GateSheet "not yours" is a dead end by design.** gateModel.ts:170/207: Continue disabled, "Ask them, or the Bachata Calendar team." no link or contact control (GateSheet.tsx:145-146). Reached only after a refused write on a co-organised page, so rare for a first claim.

Not a dead end (checked): ClaimNotice (ClaimNotice.tsx:23-43) always has Tell us (44px) and Close.

## Evidence run
- vitest `src/modules/organiser/p3/onboarding/__tests__/` + `home/__tests__/ClaimNotice.test.tsx`: 13 files, 640 tests, all pass.
- Phone specs `invite-w2-walk` + `invite-w2-golive` (390x844, fake Supabase): 13 passed, 7 failed, 20 skipped (3.0 min). The 7 failures are all in `invite-w2-golive` (phone field x2, Instagram ig-bare, the four "Do you also teach or DJ?" role cases); they are go-live question screens, not find/claim, and I did not diagnose them (not verified whether they fail on main for an environment reason). The `walk-find-your-page` picture was opened: it is the LEGACY `/account/o` screen ("Find your page", search box 'Search pages by name', big "Create a new page" button, beta note "During the beta, new pages are approved by hand. Find your page first; if you create a new one, we may need to open it for you."), NOT the P3 FindStep read above. So there are two Find surfaces with different words; the beta note is honest about approval, but the P3 footer "Not listed? Create a page" (OnboardingFlow.tsx:537) says nothing about an invite until the last tap (dead end 1).
- Phone specs, continued: Neither contains a find-by-name or claim-sheet walk: the only Find picture is `walk-find-your-page` (empty-state beta note). No picture exists of FindStep results, the claim sheet (6a-6e), the asked state, the claim error, or GateSheet. A green test is not a pass; the unit tests assert text, not layout.
- The optional phone spec was NOT written: the fake Supabase would need `organiser_claim_hints_v1` and `claim_organiser_v1` fixtures; left for the next slice.

## Coverage
17 states read. 8 driven by a vitest test (states 1, 7, 8, 9, 11, 15, 16, 17). 0 driven by a picture. 9 only read in code (states 2, 3, 4, 5, 6, 10, 12, 13, 14).

## Not verified
Real sign-in, the real email/claim link, a real phone, real prod accounts, the real `claim_organiser_v1` result, pending-request counts, layout of any state at 390x844 (no picture exists).

tsc: see handover line below.

Handover line: tsc run on 6d1b6e3: 0 errors in branch files (docs-only branch; tsc output empty).
DONE [worker-done dt_921a9bef4cf3]
