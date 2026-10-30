# Review: P3 "things left" banner / You row (PR #1181, branch `claude/p3-prefix-a-banner`) - round 1

Independent review, read-only, reviewer branch `claude/review-1181-r1`. Brief:
`docs/briefs/review-1181.md` (branch `brief/review-1181`). Reviewed head: `938c33a`
(2 commits on `origin/main` = `1dc1660`, 10 files, +161 / -64). Line numbers are from that head.
Stopping rule: one round, no fixes by the reviewer.

**Verdict: FIX FIRST.** The question the brief asks is answered YES: Home's grace banner and the
You tab's Organiser page row read `organiser_onboarding_status_v1` through one cache key and one
mapping (`graceStatusFrom` + `onboardingLeft` in `graceModel.ts`) for the page the switcher
selects, and "0 things left" cannot render on either. One medium finding stops it being ready:
the You row's new count opens a screen that shows a DIFFERENT "left" count in different words
(the pre-PR `my_profile_progress_v1` line), and on today's prod data that is the case for every
organiser. Two low findings, three nits.

## 1. Shape x screen table (check 1)

Both screens call `graceStatusFrom(raw, shownId)` then `onboardingLeft(...)`; the banner's words are
`thingsLeft(n)` (`GraceBanner.tsx:66`), the row's are `To finish: ${thingsLeft(n)}`
(`youRows.ts:39`). No second mapping exists in `src/modules/organiser/p3` (grep for
`profileProgress`, `required_left`, `requiredLeftText`: only `EditTray.tsx`'s edit lock and two
`PROFILE_WIZARD_PATH` imports remain, none of them a count). Prod shapes were read (counts only,
prod `stsdtacfauprzrdebmzg`, 2026-10-30): 12 organiser logins, 61 memberships,
`organiser_onboarding_progress` = 0 rows, gate flag off; every login has person_left >= 2
(`teach_answer`, `dj_answer`), 54 of 61 memberships have page_left = 1 (`contact_confirm`),
one login has 2+ pages.

| Shape | Banner (Home) | You row sub | Agree | Covered by |
|---|---|---|---|---|
| Nothing done (prod common: person 2 + contact_confirm) | "3 things left" + Continue | "To finish: 3 things left" | yes | `graceCount` row 1 |
| Partial (contact confirmed, 1 person code) | "1 thing left" | "To finish: 1 thing left" | yes | row 4 |
| All done | hidden (never "0 things left") | "Photo, about, links, contact" | yes | row 5 |
| Optional-only left (About not added / skipped) | hidden | default sub | yes | server keeps `about` outside `missing` (`organiser_onboarding_status_v1` body, read); mapping never reads `about`. Not a test row (nit 3) |
| No page | banner not rendered (Home redirects to Welcome, `HomeScreen.tsx:56`) | page row absent (`youRows.ts:62`, `pages` 0) | yes | `you.matrix` no-page cases |
| Several pages, different state | counts `selected.id` (`GraceBanner.tsx:34-35`) | counts `organiser.id` = the same `selected` (`useTeamContext.ts:23,45`) | yes | rows 13-15; `you.matrix` 3-page case with the shown page listed LAST and the others 5 short |
| Shown page not in the answer | person codes only | person codes only | yes | row 16 |
| Status load error / malformed / null | hidden (`retry: false`) | default sub | yes (both 0) | rows 8-11 |
| Admin with items | hidden | default sub | yes | row 6; `pageModel.matrix` admin row |
| Server `complete: false` with empty lists | hidden | default sub | yes | row 7 (this is the "0 things left" case the PR exists for) |

Why "agree" is more than "same number": `complete` and `is_admin` are read once and both screens
go through `onboardingLeft` (`graceModel.ts:37`), so an admin or a complete answer is 0 on both.

## 2. Copy, empty states, tap targets (check 2)

- Banner: "Finish your details to create and edit events. N things left. Until then everything
  works as usual." Continue -> `/start?o=<id>&at=review` (`GraceBanner.tsx:69`); that route exists
  (`OnboardingFlow.tsx:115-117`) and Review counts person + page codes the same way
  (`pageModel.ts:351`), so Continue lands on the same number. Hide for today is on screen. Finished
  state = not shown; nothing to say. Load error = not shown, Home works.
- You row: see finding 1 (the number is right, the screen it opens is not the one that number is about).
- Tap targets: `.p3-btn` and `.p3-link` `min-height: var(--tap)` = 44px, `.p3-navrow` 56px, all px
  (`p3.css:25,115-122,246`); no rem anywhere on the two screens. CSS is untouched by the PR.

## 3. The shown page follows Switch page (check 3)

Yes. Both screens take the page from `useOrganiserChoice().selected` (`?o=` on the URL, else the
remembered pick, else the first page); You gets it through `useTeamContext` (`useTeamContext.ts:23`),
the banner calls the hook directly (`GraceBanner.tsx:34`). Switch writes the pick with `choose`
(`useOrganiserChoice.ts:50-55`) and both read it back on their bare paths. The `null` fallback in
`graceStatusFrom` (first unfinished page) is unreachable from either screen: Home renders the banner
only after the home read has >= 1 page (same cache key, `useP3Data.ts:11`), and You hides the row at
0 pages. The Settings sheet now renames the SHOWN page (`GraceBanner.tsx:79`), an improvement.

## 4. Do the new tests fail on the unfixed code? (check 4)

The three test files from `938c33a` were run against `origin/main` source in a second worktree:
24 failed, 208 passed. 20 of the 24 are `graceStatusFrom is not a function` (the function moved
file), which proves little, so five one-line mutants were run against the PR branch:

| Mutant (in `graceModel.ts` unless said) | Tests failing |
|---|---|
| A: ignore `organiserId`, pick the first unfinished page (the old rule) | 4 (3 `graceCount` rows + `you.matrix` 3-page case) |
| B: old `graceShown` (`!complete && !isAdmin` instead of `left > 0`) | 3 (incl. "incomplete with empty lists" and the `pageModel` `left: 0` row) |
| C: `person.length + page.length` instead of the `Set` | 0 (finding 2) |
| D: `onboardingLeft` ignores `isAdmin` | 2 |
| E: `YouScreen.tsx:101` passes `null` instead of `organiser.id` | 1 (`you.matrix` 3-page case) |

The matrix bites on the four behaviours the PR exists for.

## 5. Test runs, budgets, CI steps (check 5)

- The three changed test files on `938c33a`: 232 passed.
- `vitest run src/modules/organiser`: 204 files / 8040 tests passed; 1 file fails to LOAD,
  `p3/door/__tests__/door.screen.test.tsx` ("Failed to resolve import jsqr"). It fails identically
  on `origin/main` in this container (missing dependency here), not this PR.
- `perf-budgets.json`: not in the diff (0 lines).
- `npm run lint:architecture`: passed. `eslint` on the 8 changed source/test files: clean.
- `tsc --noEmit`: 2 errors, both pre-existing and outside the PR (`src/pages/Venues.tsx:554`,
  `src/services/venuePublicService.ts:55`); not a CI gate.

## Findings

1. **Medium (FIX FIRST). The You row's count opens a screen that shows a different "left".**
   `youRows.ts:62` puts "To finish: N things left" on the Organiser page row, whose target is the
   page editor. That editor's `RequiredLine` (`src/modules/organiser/page/index.tsx:18-24`, unchanged
   by the PR) still reads `my_profile_progress_v1` and says "Required to publish: N answers left",
   linking to the old wizard. Same page, same person, two numbers in two vocabularies, and the row's
   N counts `teach_answer`, `dj_answer` and `contact_confirm`, none of which can be done on that
   editor. On prod today that is EVERY organiser: "To finish: 3 things left" -> editor -> a different
   line or nothing. Before this PR the row and the editor read the same `required_left`, so this is
   a new disagreement, the class CLAUDE.md's "one shared mapping" rule forbids. One-line fix: under
   the P3 surface, have `RequiredLine` read `onboardingLeft(graceStatusFrom(status, organiserId))`
   through `onboardingStatusKey` and link to `${P3_PATHS.start}?o=<id>&at=review` with the same
   `To finish:` words (or, if the editor must keep its publish line, point the You row at the Review
   when `requiredLeft > 0`). Add the pushed screen as a third column to the `graceCount` matrix.

2. **Low. The `Set` in `graceModel.ts:31` is dead and untested.** Mutant C (sum the two lengths)
   survives: no `graceCount` shape has a code in both lists, and the server strips person codes from
   `organisers[].missing` (`organiser_onboarding_status_v1`, `v_org_m`). Either drop the `Set` or add
   one overlapping shape so the dedupe is a tested promise rather than a guess.

3. **Low. Stale count after the old wizard.** `wizardApi.ts:76-80` `invalidateAfterAnswer` does not
   invalidate `['p3-ob-status']`, yet the editor the You row opens sends people to that wizard
   (`PROFILE_WIZARD_PATH`), and its answers (photo, city, instagram, website...) change the codes.
   Back on Home or You within `staleTime` (60 s) the old number shows. Fix: add
   `inv(['p3-ob-status'])` next to `inv(['my-profile-progress'])`. (`useOwnPage.tsx:104` and
   `personApi.ts:76` are covered; this one path is not.)

4. **Nit.** `you.matrix.test.tsx:68-74` mocks top-level `complete: false` even when every page is
   complete and the person is done. Harmless (the row reads `left`), but `complete: true` there would
   also exercise the `onboardingLeft` short-circuit through the real screen.

5. **Nit.** No `graceCount` row for the optional-only shape (`about: {done:false, skipped:false}` with
   `missing: []`). The mapping cannot read `about`, so it passes by construction; a row would pin that.

6. **Nit.** `GraceBanner.tsx:34` mounts `useOrganiserChoice` on Home, which also runs its "remember
   `?o=`" effect there. No `?o=` reaches Home today, so no behaviour change; worth a one-line comment
   so the next reader does not wonder.

## Not checked

- Browser walk at 390x844: no deploy or preview in this session. The CSS is unchanged, so the
  tap-target check above is from the stylesheet, not a device.
- `organiser_onboarding_status_v1` was READ (`pg_get_functiondef`) and its helper run with explicit
  user ids for counts; it was not called as a signed-in user, so the exact JSON order
  (`organisers` sorted by name) is from the body, not an observed call.
- `e2e-smoke.yml` and `perf-budget.yml` (`npm run build` + budget scripts) were not run; the diff adds
  no chunk and `perf-budgets.json` is untouched, but the ratchet itself was not exercised.
- `door.screen.test.tsx` could not load here (missing `jsqr` in this container); the same on main.
