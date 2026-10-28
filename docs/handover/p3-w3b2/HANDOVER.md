# Handover: P3 W3b-2 per-date Name, Photos and Price (PR #1110)

Branch `claude/p3-w3b2-date-fields` from `main` 70b4ae0. Flag `organiserP3` stays OFF. Brief:
`brief/p3-w3b2:briefs/p3-w3b2.md` (blob 20a2813).

## Data source (prod `stsdtacfauprzrdebmzg`, read-only SELECT, 2026-10-28)

| Key | Who writes | Accepted JSON / owner rule | Clear | Who reads |
|---|---|---|---|---|
| `title` | `occurrence.set_override` -> `_cmd_occurrence_set_override_p5` (`p_payload->>'title'` verbatim) | string, owner arm (`apply_aggregate_write_p5`): non-blank after trim, <= 80 | JSON null = inherit | event page `_event_view_snapshot_compat_v1` `event.name`; calendar `get_calendar_events_v2` / `calendar_events_dto` `name` |
| `gallery` | same, via `_occurrence_override_json_text_array_v1` (order kept) | array of <= 30 non-blank http(s) strings (`_owner_public_url_ok_p5`); `[]` = owned, no photos | JSON null | event page `event.photo_urls` (`useEventPageQuery` galleryUrls). Calendar: not shown |
| `passes` | same (array or null, else `invalid_payload`) | `_owner_passes_problem_p5`: <= 10 objects {id uuid unique, name 1-120, price number <= 6 digits 2 dp or null, currency GBP/EUR/USD?, description <= 500?}; `[]` = owned, no prices | JSON null | event page `meta_data_public.tickets` (`useEventPageQuery` tickets). Calendar: not shown |

Owner allowlist (`v_owner_override_keys`, ER P4 A3 20261225010000): venue_id, city_id, cancellation_reason_label,
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
- No new `COMMAND_COPY` rows for the title / gallery / passes owner refusals (the client holds those values
  before sending; `occurrence_cancelled` already has copy); a stray refusal shows the generic copy.

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
