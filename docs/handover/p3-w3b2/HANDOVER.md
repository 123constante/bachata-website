# Handover: P3 W3b-2 per-date Name, Photos and Price (PR #1110)

Branch `claude/p3-w3b2-date-fields` from `main` 70b4ae0. Flag `organiserP3` stays OFF. Brief:
`brief/p3-w3b2:briefs/p3-w3b2.md` (blob 20a2813).

## Data source (prod `stsdtacfauprzrdebmzg`, read-only SELECT, 2026-10-28)

| Key | Who writes | Accepted JSON / owner rule | Clear | Who reads |
|---|---|---|---|---|
| `title` | `occurrence.set_override` -> `_cmd_occurrence_set_override_p5` (`p_payload->>'title'` verbatim) | string, owner arm (`apply_aggregate_write_p5`): non-blank after trim, <= 80 | JSON null = inherit | event page `_event_view_snapshot_compat_v1` `event.name`; calendar `get_calendar_events_v2` / `calendar_events_dto` `name` |
| `gallery` | same, via `_occurrence_override_json_text_array_v1` (order kept) | array of <= 30 non-blank http(s) strings (`_owner_public_url_ok_p5`); `[]` = owned, no photos | JSON null | event page `event.photo_urls` (`useEventPageQuery` galleryUrls). Calendar: not shown |
| `passes` | same (array or null, else `invalid_payload`) | `_owner_passes_problem_p5`: <= 10 objects {id uuid unique, name 1-120, price number <= 6 digits 2 dp or null, currency GBP/EUR/USD?, description <= 500?}; `[]` = owned, no prices | JSON null | event page `meta_data_public.tickets` (`useEventPageQuery` tickets). Calendar: not shown |

Owner allowlist (`v_owner_override_keys`, a plpgsql constant inside `apply_aggregate_write_p5`, not a relation; ER P4 A3 20261225010000): venue_id, city_id, cancellation_reason_label,
cover_image_url, ticket_url, description, title, music_styles, gallery, passes. JSON null always allowed.
Cancelled date: owner refused when the payload CONTAINS title / music_styles / gallery / passes (even null:
`c_a3_cancel`). Per-date read keys: `event_view_p5` -> `event.title_override`, `gallery_override`, `passes_override`.

Counts: 377 override rows; title 16 (max length 35, 0 blank, 2 equal to the series name), gallery 44
(size 0: 3, 1: 33, many: 8, max 4), both 5, passes 0, cancelled with title/gallery 1, past 52, festival 0.
Series gallery max 3; the series editor cap is `MAX_GALLERY` 30 (= server), no 3-photo cap.

## Done
- `OWNER_OVERRIDE_KEYS` + title, gallery, passes; `overrideCommand` sends arrays as they are ([] kept, null = clear).
  Parity matrix: `PROD_OVERRIDE_KEYS` is the full prod list, `music_styles` deferred (waits for admin A2 R4).
- `parseDateDetail`: `titleOverride`, `galleryOverride`, `passesOverride`. `ownDetailsOf` counts them.
- `resetNormalPlan` (the W2b composite): + title / gallery / passes null, left out on a cancelled date (sheet says why).
- `p3/data/dateFields.ts` (pure builders, reusing `events/seriesExtras` price rules and lock; `MAX_GALLERY`).
- `p3/screens/DateFieldSheets.tsx` (Name / Photos / Price sheets: saveModel `sameValue`, held-save reason,
  Undo my changes + leave guard with confirm), `PriceCard.tsx` (moved out of PricesScreen, shared).
- `DateSheet.tsx`: three `OwnRow`s; festival rows grey with reason; team-set price list grey with the W3a lock reason.
- Photos upload via `events/media.uploadEventPicture` (the series editor path); a failure keeps the photos.
- `Sheet.tsx`: `focus({ preventScroll: true })`.
- Tests: `p3/data/__tests__/w3b2.matrix.test.ts`, `p3/screens/__tests__/w3b2.send.test.tsx`, contrast rows,
  `tests/e2e/p3-w3b2-geometry.spec.ts` (in `test:e2e`).
- Bundle: `/app` first load main 382,635 B -> branch 382,633 B (sandbox build, perf-budget env).

## Left / next
- Orchestrator walk on the seeded WALK events (not done here; no prod writes).
- Sheets are not portalled to `document.body` (the shared `Sheet` never was; its scrim is `position: fixed`
  under `.p3-theme`, which carries the theme tokens). Portalling means wrapping in a `.p3-theme` with the
  page's `data-theme`; left for the owner to decide.
- Per-date music (A2 R4), "Different on N dates" (#63), bulk edits: out of scope.
- `COMMAND_COPY` already has rows for the title / gallery / passes owner refusals (`selfServeErrors.ts`
  `occurrence_cancelled`, title, gallery, passes), so no generic fallback arises. The title row says "or leave it
  empty to use the event name", a path the client never offers (pre-existing, outside this PR's files: queued).

## Review and fix round (stopping rule: one review, one fix round, then the orchestrator walk)
Independent review (a different model): no blockers. Fixed: raw U+00B7 in `dateFields.ts` (now an escape,
plus an ASCII-only source test); a Close or Back during an upload now asks first (shown red against the
old guard, then green); empty-state copy no longer points at "use usual", a step back; a note at 30 photos;
remove buttons numbered for screen readers; focus goes to "Keep editing" when the ask opens; refs are written
in a layout effect, not during render (eslint `react-hooks`). Kept as intended: a team-set series price list
greys the date's Price row.

## Local CI (sandbox)
All architecture-guard, typecheck, lint-chain, perf-budget bundle, isolation and new-spec steps pass.
Environmental only: `tests/integrityCouldNotRun.test.ts` (5, global `typescript` on `NODE_PATH`),
`*.contract.test.ts` (need live DB credentials), `check:integrity` needs `chmod +x` in this clone,
doc-weight and lighthouse need a preview. e2e: `organiser-home.spec.ts:55` and `organiser-layout.spec.ts:171`
fail the same way on `main` here; the other 9 failures under load pass when re-run alone.
Organiser unit suite on the final head: 192 files, 7250 pass.

## Fix round 1 (review `docs/reviews/1110-r1.md`, brief `brief/p3-w3b2-fix1`; the only fix round)
What the check would have caught: a locked row that still carried a live "use usual", and a held reason
pointing at a control not on the sheet, are the Definition of done's "a control that cannot work is disabled
with a reason" and "no copy that points at a control that is not on screen". The class now has table-driven
tests in `w3b2.send.test.tsx` ("fix round 1" describes).

| # | Finding | Outcome | Test (red first against 2c811db, then green) |
|---|---|---|---|
| 1 | "use usual" live on a festival / team-list row | fixed: `OwnRow` greys it when `why` is set (`aria-describedby` the reason) | "a row with a reason never has a live write control" x plain, festival, team list on the date, team list on the series, cancelled (own name), past: red on festival and team list on the date |
| 2 | `dateNameBlank` named "use the usual name" | fixed: "Give this date a name" | "every held reason names only controls on its sheet" (Name blank/long, Price nameless/bad amount, Photos none): red on Name |
| 6 | cancelled date owning only name/photos/price: reset row live, Go disabled | fixed: `data/dates.ts` `dateRowsOf` greys the row with `L.dateFieldsCancelled` when the plan is null (`dateActions` itself unchanged) | "a cancelled date owning only a name greys..." red; "...with its own About as well keeps it live" green both sides. Prod: the 1 cancelled row with a title also owns another field, so on prod its row stays live (0 rows hit the grey today) |
| 7 | "photo" beside "photos" | fixed: "cover photo, name, photos, price" (`labels.ts`, `data/dates.ts` `resetBody`) | copy only |
| 4 | e2e `window.scrollY === 0` could not go red | fixed: assertion dropped with a comment saying why. The mirror was also wrong: it nested `.p3-frame` under `.p3-theme`, but `position: fixed` is on `.p3-theme.p3-frame` (one element, as `P3Shell` mounts it), so the frame was not fixed in the spec. Now mounted as the shell does | mutant: `.p3-main` pre-scrolled to 200 + sheet scrollTop asserted, `preventScroll` removed: 12/12 stayed green (the focused button is the header Close; `.p3-main` is not its ancestor), so per the brief it was dropped |
| 8 | doc drift | fixed: `dateFields.ts` header (event_view_p5 emits `event.name`, `event.gallery`, `event.passes`); this handover's `v_owner_override_keys` (a plpgsql constant in `apply_aggregate_write_p5`) and `COMMAND_COPY` claims. Queued: `parity-matrix.test.ts:92` wording (outside this round's files) and the pre-existing `selfServeErrors.ts:199` "leave it empty" copy | docs |
| 9 | "Nothing changed yet" on a dirty-but-equivalent draft | fixed (one line): `dirty` also needs a patch or a problem, so a trailing space is no change | "a trailing space on a price name is no change" red, then green |
| 3 | orphan uploads on abandon | not changed (PR body "Known limits") | - |
| 5 | sheets not portalled | not changed (PR body "Known limits") | - |

Bundle `/app` first load (this sandbox, exact gzip bytes): main 70b4ae0 382,541 B; PR head before this round
2c811db 382,545 B; this round's head 382,545 B. This round adds 0 B; the PR as a whole is +4 B here (the
earlier CI figure was -2 B), under the 374 KB budget. `perf-budgets.json` / `vite.config.ts` untouched.

Local CI this round: `npm run lint` 21/22 (check:integrity exit 126 until `chmod +x bin/*.sh`, as CI does; then
`integrity-guard: ok`); `AUDIT_STRICT=1 check:images` pass; eslint on touched files 0 errors; `typecheck` 99
errors, none in touched files; organiser unit suite 192 files, 7262 pass; `test:e2e` 177 pass, 3 fail under load
(`account-settings.spec.ts:64,75`, `organiser-onboarding.spec.ts:143`, outside P3), all 20 pass re-run alone;
merges cleanly with current `origin/main`. Edits were made by script in a cloud container (no FUSE mount), not
through `safe-edit.py`; `check:integrity` is clean.

Not verified: a browser walk of the live React tree with prod-shaped data (orchestrator walk); Vercel preview
checks; `real-data-verified` / `phone-qa-section` on GitHub after the body edit.
