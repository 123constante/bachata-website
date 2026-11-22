# Handover: Editor v2 slice 16d (finish the tap-walk spec) PARTIAL

Branch claude/editor-v2-s1c. No PR (brief). Tests only: spec, `organiserFake.ts`, `check-e2e-spec-coverage.mjs`. No `src/` change, flag stays OFF.

## Run result (390x844, 4 workers)
16c: 69 pass / 42 fail / 2 skip. Now: **97 pass / 5 fail / 11 skipped** (skipped = 2 earlier skips + 9 `test.fixme`). Stopped at the context gate, not finished.

## BUILT UI DIFFERS (fixme, never weakened)
- Row 39 Back to the usual times: no render site for `backToUsualTimes` (`src/modules/organiser/p3/v2/copy.ts:321`).
- Rows 21, 40, 41, 42 (Every tab When -> Classes and party): `ProgSheet` (`WhenSheet.tsx:119`) is exported but rendered nowhere.
- Row 56 Change the link: shows on a one-off only (`PriceSheet.tsx:100-103`); weekly night sheet has "Change every <day>".
- Row 83 End the event toast has no Undo (`copy.ts:281` toastEnded).
- Known UNBUILT (unchanged): row 36 move_date Undo; weekly per-night sold count; per-night ticket price write.

## Fake limits (fixme, spec side)
- Row 48 Remove this one: Remove is disabled at one session (`SessionSheetV2.tsx:17`); fake series has one. X-11 covers the disabled state.
- Row 62 Add a video (This night): fake has no per-night gallery override read-back.

## Fixed this slice
Fake: per-night `night_venue` / `night_description` with `override_keys` (rows 52, 75, X-02); `organiser_ids` on the workspace series (Tickets screen no longer stuck on Loading); ticket status is `on_sale`, not `active` (rows 91-96, 99-102, 104, 106 etc.). Spec: price inputs are `spinbutton`; "Add a link" is reached through Change how dancers pay (97, 98, 98.1, X-12c); `eb-row-0` for early bird (103, 104); untouched ticket Done sends no command and shows no toast (105); `searchbox` + `where-row` (50, 51); row 43 uses Add a class or party (stored session type is locked); row 28 taps the Organisers button, not the site nav. MANUAL run line gained `VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE=true`.

## Still failing (5), first-look cause, NOT root-caused
- X-06: body lacks "Every Friday, ends after " (fake `recurrence_rule.until` may be wrong field; check the Repeats row text).
- X-09: Price fact reads "Add a ticket" not "Pay at the door" in the door state (check `Facts` price label for a door series with no passes).
- X-12: first `tap(/Class|Party/)` hits the footer link `/classes`; scope to the sheet.
- X-12c: after the how-pay path change, re-check (not re-run alone).
- X-13: Raffle row shows "Raffle" with no On/Off word; check the built hub raffle label.
Row 53/100/53.1 need re-check only if flaky; all passed in the last full run.

## Tap table `built` column
prototype for every passing row; FIXME for the rows above; X-14 not defined by prototype (skipped). `V2_DIAG=1` env logs requests in the spec.

## Next steps
1. Fix X-06, X-09, X-12, X-12c, X-13 (spec or fake) or fixme with file:line.
2. Seed a second session in the fake to un-fixme row 48; add per-night gallery override to un-fixme row 62.
3. Open the PR (brief says no PR; ask owner).

## Verified / Not verified
Verified: full run counts above; `npm run check:mojibake` clean; `npm run check:e2e-spec-coverage` OK; OLD-URL guard unchanged on every tap.
Not verified: green run (5 fail); `npx tsc` not run; the shared fake change (`organiser_ids`) was not re-run against the other organiser-*.spec files; no real-data survey (tests only).
