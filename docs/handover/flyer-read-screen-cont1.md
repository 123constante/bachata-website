# Handover: flyer read screen, continuation 1 (D1, D2, D5, D7)

Brief: `docs/briefs/flyer-read-screen-cont1.md` (branch `brief/flyer-read-screen-cont1`, sha 2201f66d). PR #1498, branch `claude/flyer-read-screen`.
Code commit: `9ee2cd8`. Head: the commit that adds this file (subject ends `[worker-done dt_822764f318ae]`). Its SHA is in the worker report and in `git log`.

## Done
| Finding | Fix | Test (in `__tests__/flyerStart.render.test.tsx`, "review fixes D1, D2, D5, D7") |
|---|---|---|
| D1 (R16 FAIL) | `CreateFlow.tsx`: a "Remove photo" button (`p3-new-file` = 48px) next to "Choose a different photo". It clears `cover`, calls `save.forgetCover()` and clears the error. It shows only while a cover is picked and before the create. | Remove, then Save draft: no upload, no `default_cover_image_url` sent. Control: the same save without Remove does send it. |
| D2 | `FlyerStart.tsx`: a good read that is waiting on `venues.isPending` gets a timer (`VENUE_WAIT_MS` = 8000). When it fires, the screen continues without venue matching (`flyerToDraft(read, [])`). The venue stays as "Flyer says". A `no_venue_match` note gives the reason in one line, and the not-enough card shows the same line. This is latched per read, so a list that loads late cannot re-open the form. | A venues RPC that never settles, fake timers +8 s: the form opens, the note shows, venue is null, and "Flyer says: The Ritz Club..." shows. |
| D5 | The daily-limit title is "You've used all of today's flyer reads", with no number. | The title matches `today’s flyer reads` and not `\d+ flyer reads`. |
| D7 | `notEnoughTitle()` takes the `(missing ...)` part from flyerToDraft's `not_enough` note. Example: "Not enough on this flyer: missing a name". If there is no such part it falls back to "...to fill the form". | Only the name missing: the title says "missing a name" and never "date and venue". Title only: "missing a date, a venue". |

The 5 fix tests fail on the unfixed code. The D1 control test passes there, as expected. All 47 pass with the fixes.

Code review: `/code-review low`, round 1. It found one issue: `noMatch` was not latched, so a late venue list could re-open the form. That is fixed. Round 2 was not run.

## CI per job (on `9ee2cd8`, the early push, read at hand-off)
| Job | Result |
|---|---|
| bom-check, bundle-budget, masking-check, phone-qa-section, live-db-gate, notification-check, dancer-area-isolation, no-preview-reason, unit (Australia/Sydney), unit (America/New_York) | success |
| unit (Europe/London, full), e2e-smoke, build-smoke, phone-qa (1-3), contract-check, real-data-verified | in progress / queued at hand-off |
| lighthouse, seo-*, og-*, synthetic*, doc-weight, enable, bom-check-routed | skipped (no preview on a `[skip preview]` push) |

The final push (this file) re-runs everything with a preview. Read the checks on the head SHA.

## Verified
- `npx tsc --noEmit -p .` run on 9ee2cd8 (code unchanged since): 0 errors in branch files (0 in total).
- vitest `src/modules/organiser`: 304 files passed. `p3/new`: 196 passed.
- eslint on the 3 touched files: 0 problems. `check:mojibake`: clean.
- architecture-guard steps: `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images` all exit 0.
- PR body: `check-pr-real-data-verified.mjs` exit 0, `check-pr-phone-qa.mjs` exit 0. `scripts/prepush-check.mjs` does not exist here. Checked by hand: label lines are exact, there is no SQL and no new scripts.

## Not verified
- A browser walk at 390x844 (none was run): the Remove photo button layout, the 8 s wait on a real slow network, and the new titles wrapping.
- The live `event-flyer-read` function and the e2e suites locally. These are left to CI.
- A second review round.

## Left / next
- D3, D4, D6 and D8 are parked, as the brief says.
- The orchestrator's phone walk: screenshots 4, 7 and 9 in the PR's Phone QA list now include Remove photo, the missing-part title and the daily-limit title with no number.
