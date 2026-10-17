# Fix brief F-PAR-fix -- ONE fix pass on PR #809 from the two parity reviews

Repo `123constante/bachata-website`. Work on `claude/org-r1-integrate` ITSELF (head 5369379; both reviewers are finished, you are the only worker on it). Opus. ONE push at the end (plus a PARTIAL push if cut short; a continuation worker is normal, so write `docs/organiser-rebuild/handovers/FIX-PAR.md` with done / left / next steps before any stop). Read first: `git fetch origin claude/org-r1-review-PARA claude/org-r1-review-PARB arc/briefs-organiser-r1`, then `git show origin/claude/org-r1-review-PARA:docs/organiser-rebuild/reviews/REVIEW-PAR-A.md` and `git show origin/claude/org-r1-review-PARB:docs/organiser-rebuild/reviews/REVIEW-PAR-B.md`; also `briefs/00-COMMON.md`. Plain git only, never `gh api`; shell commands without variables, loops or `$(...)`; check a PRODUCTION build (`npm run build`). Context: at 25% start nothing new, by 30% push PARTIAL. Last commit subject ends `[worker-done <ticket>]`. CI rule: GitHub Actions billing is intermittent; run EVERY CI job step you can in your sandbox (read `.github/workflows`) and put a per-job table (command, exit code) in FIX-PAR.md and the commit body; say what a sandbox cannot run. Run CI chunks in the FOREGROUND (an earlier worker ended its turn waiting on a background task and never pushed). Push a checkpoint after the BLOCKINGs are done.

## Method (binding)
For every behaviour or copy rule: write the test FIRST, run it against the UNFIXED code, paste the red, then fix and paste the green. Cross-screen facts go in the consistency matrices; one shared mapping per fact, never two copies. Do not touch the density-exempt calendar files, `src/components/ui/dialog.tsx`, or add migrations. Use HTML entities / `\u` escapes, never raw Unicode punctuation (the `£` and `€` for pound and euro).

## Orchestrator decisions (log each in FIX-PAR.md "Decisions"; the owner can overrule)
1. PAR-A B1 (Change time end lands on a different session than the preview): the server picks the end target by plain-clock `max(eff_end)`, ignoring midnight. Do NOT copy that quirk into the screen. When 2+ sessions are present and the clock-max-end session is NOT the night-last session, hide the end box on Change time and say "To change when the night ends, change one session's time" with a link to Sessions. Otherwise (clock-max == night-last, or one session) keep the end box. Rewrite the two pdates.model tests that pin the night clock (they must now pin the guard); add a table-driven test over: class 20:00-21:00 + party 21:00-02:00 (guard on), two daytime sessions (end box on), one session (end box on). Queue the admin defect in FIX-PAR.md "Queued": `_cmd_occurrence_set_time_p5` uses a plain-time `max(eff_end)`, 241 coming dates on prod affected.
2. PAR-B B1: the Go live reason with nothing missing reads "Your event is ready. Go live switches on here after the next platform update." (one shared string in `lifecycleModel`; Go live stays disabled while `A1_APPLIED=false`).
3. PAR-B S8 (no minus key on iPhone): Pick several gets an Earlier / Later choice plus an unsigned number of days; the command sends the signed shift.
4. PAR-A S3: half-done copy message reads "<keys> copied, <rest> not copied: <reason>".
5. PAR-B S4 and N4: Stop repeating and Pick several with 0 coming dates hide or disable with "No coming dates, so nothing repeats. Add a date first." and link to Add a date.
6. Keep the open owner copy "Ask the Bachata Calendar team." as is.
7. Do NOT fix (list under "Queued"): PAR-A N2 (festival reach count, latent), PAR-A N1 beyond making the reachability check strip comments before matching (cheap: do that), PAR-B N5 wording only if cheap.

## Work list
**BLOCKING**
- PAR-A B1: decision 1. Files `flows/change/changeModel.ts` (`lastEnding`, `previewTimes`), `flows/change/Time.tsx`.
- PAR-B B1: decision 2. File `events/lifecycleModel.ts:40`. Table-driven over every Go live reason (missing venue / date / cover / nothing missing): each reason names what to do.

**SHOULD**
- PAR-A S1: add two `COMMAND_COPY` rows in `shared/selfServeErrors.ts` (`/shift would move a date into the past/`, `/shift would collide/`) and one for `bulk_too_large`, each with a plain reason; refuse a past-landing shift on the client in `flows/change/Pick.tsx` using the ticked dates and today. Test each against the unfixed code.
- PAR-A S2: `flows/event/EventStep.tsx:67-71` counts "comes off" only over dates without their own changes (`has_override` or the field the curated check mirrors) and says "N with their own changes stay".
- PAR-A S3: decision 4; `flows/change/Copy.tsx`, `useChange.ts` `sendAll`; test where the second `set_override` rejects.
- PAR-B S1: Change time: when the end is before the start keep the old end in the preview (or error colour).
- PAR-B S2: "Every session moves 30 min later" via `durationWords`.
- PAR-B S3: one-session dates get "Now 21:00-01:00 -> new 22:00-02:00" preview; label the field "Night starts" when the date start differs from the first session.
- PAR-B S4: decision 5.
- PAR-B S5 / S6: one name "Put it back" (DateSheet.tsx:125, DatesTakenOff.tsx:66, plus the existing two) and ONE Take-this-date-off body in `shared/copy.ts` (`TAKE_OFF` with `PUT_BACK_WHERE`) used by both TakeOff.tsx and DateSheet.tsx; matrix row scanning for the old strings.
- PAR-B S7: the missing-date item in the Go live reason routes to Add a date (`ORG_PATHS.addEvent`); only venue and cover stay "in Details".
- PAR-B S8: decision 3.
- PAR-B S9: validate prices and Ends on blur or Save, show the reason once, no `role="alert"` on every keystroke.

**NOTE (small, do them)**
- PAR-A N1: reachability check in `parity-matrix.test.ts:390` strips comments before matching; prove with the M2b mutant (token left in a comment must go RED).
- PAR-B N1 (heading "Sessions"), N2 (one reset label), N3 ("Nothing to copy" + `aria-describedby`), N6 (event name on its own line in step headings), N7 ("1 week"), N8 (`£` / `€` in `events/seriesExtras.ts:83`, then `npm run check:mojibake`), N9 (keep the aria-live node mounted; `aria-describedby` instead of overriding aria-label; destructive Discard confirm uses the destructive style).

## Done =
FIX-PAR.md with: red-first table (item, red message, green), decisions, Queued list, per-job CI table, Verified / Not verified. Every item above is either done with a test or listed under Queued with a reason. Then (and only then) refresh the 390x844 walk for Change time (3 shapes: class+party night, one session, two daytime sessions), Pick several, Stop repeating on a 0-coming-dates series, and put the screenshots in `docs/organiser-rebuild/walk-FIXPAR/`.
