# Brief FIX-SW1 -- ONE fix pass on SW1 from the independent review (Website)

Repo `123constante/bachata-website`. Branch `claude/org-r1-parity-sw1-fix`, cut from `claude/org-r1-review-SW1` (it carries SW1 d20de737 + the review). Push ONCE at the end (plus one PARTIAL push at the limit). Plain git only, no gh api, no variables/loops/`$(...)`, never `--no-verify`. This is the ONE fix pass: after it, anything left is bundled into one finishing worker, not another round.

READ FIRST: `docs/organiser-rebuild/REVIEW-SW1.md` (all findings, the appendix test), `docs/organiser-rebuild/handovers/SW1.md`, `00-COMMON.md`.

## The failure the owner would see (their words, 2026-10-18: "unprofessional" when features were silently missing; the rule: never lose data)
An organiser renames one class, taps Save, and every per-date session change on that series is gone, while the screen shows "Differs on N dates" right above Save. Check that would have caught it: a test that saves an untouched series programme and asserts every stored item id is present in the payload, and that the per-date override rows keyed by those ids are not orphaned.

## Fix (all of it)
1. **B1 (client half)**: `buildDays` in `programmeSeriesModel.ts` must send each STORED item's `id` (and day/section `id`) in the tree. New items send no id. Pin with AW1 (sibling server worker): `series.set_program` UPSERTS items by id and deletes only ids that left the tree (see brief addendum `AW1-addendum-B1.md`). Until AW1 ships it, keep `AW1_APPLIED=false` (it is); add a test that an untouched Save sends every id and that deleting one item omits only its id. Also fix the delete-confirm copy (`ProgrammeSeries.tsx:63`) so it is true: say what really happens to dates that changed that session.
2. **B2**: never derive `profile_type` from the role. Keep the picked profile's type; offer a role chip only if that profile type can hold it (teacher profile -> Teacher; DJ profile -> DJ) or drop the chips for stored people. Make the reviewer's red test green; add the matrix: every stored person x every offered role -> `profile_type` unchanged.
3. **S1**: RECENT people carry `profile_type` (pin `organiser_series_cast_v1.recent_people` rows `{profile_id, profile_type, display_name, photo_url, roles[]}` in `programmeSeriesApi.ts`; a person with no role or both roles adds with their own type). 
4. **S2**: send empty stored sections back as stored (drop a section only if this screen emptied it); make the reviewer's S2 test green. Update decision 4 in the handover.
5. **S3**: one level renderer (short chip + the word) used by `ProgrammeSeries`, `ProgrammeSheet` and `dates/DateSheet`; test that the same level reads the same on all three.
6. **S4**: cast empty state shows the programme's `off` reason when editing is not possible (festival, ended, gate off); the call to action only when it can be done.
7. **S5**: no raw Unicode punctuation (`\u2013`, `&middot;`); run `check:mojibake`.
8. **S6**: cast line clamped: first 6 names + "and N more".
9. **N3** level chips use sr-only text; **N4** skeleton until the role loads; **N5** reword `ORGANISERS_EMPTY` for the owner case; **N1** send blank title as `null`? NO: leave as is, record in handover.
10. Merge the reviewer's appendix test (`review-sw1.echo.test.ts`, in REVIEW-SW1.md) into the suite, all green.

## Rules that bind
Red-first with pasted failing output (run the new tests against the UNFIXED code first); table-driven consistency tests; same fact reads the same on every screen; every empty state says what the person CAN do; a control that cannot work is disabled WITH a reason; EVERY CI job step run and a per-job table (known sandbox-only reds: 15 live-DB unit failures, `check:bundle-budget` identical on base, `chmod +x bin/*.sh` before `lint`); PRODUCTION build; 390x844 walk of the programme screen on a prod-shaped weekly series with per-date overrides; px-sized 44px targets; `&mdash;` entities; source files over 2 KB through `scripts/safe-edit.py`.
Handover `docs/organiser-rebuild/handovers/FIX-SW1.md`: done / left / CI table / red-first / Verified-Not verified. Context under 30%.
