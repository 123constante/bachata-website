# T5: course ticket create + early-bird presets (client only, flagged)

Repo `123constante/bachata-website`. Branch `claude/ticket-t5-course-presets`. Lane: normal (no DB change). Money-adjacent: an independent review is posted as a PR comment by the arc owner before merge; do not merge.

## Read first
- `docs/briefs/ticket-t3-price-steps-editor.handover.md` and the T3 code it names: `src/modules/organiser/tickets/priceSteps.ts`, `src/modules/organiser/p3/tickets/{TypeSheet,PriceSteps}.tsx`, `ticketsApi.ts` (`setPriceStep`).
- `src/lib/featureFlags.ts` (add flag `ticketCoursePresets`, env `VITE_ENABLE_TICKET_COURSE_PRESETS`, needs `organiserTicketing`). Register any new write door in `scripts/onboarding-write-doors.json` only if you add a new RPC call (you should not).

## Verified schema facts (read-only check done 2026-11-13: NO database change needed; if you find one is needed, STOP and report)
- A course is a `ticket_types` row with `kind='course'`; `valid_from` and `valid_to` are NOT NULL; `occurrence_id` is NULL.
- Price steps are `ticket_price_steps(ticket_type_id, effective_from, price_pence)`, written only through `ticket_price_step_set_v1` (existing `setPriceStep`). Max 3 steps, free types refused, a step must be in the future (server `step_in_past`).

## Task
1. Course create: from TypeSheet's existing create path, let an organiser pick "Course" and give the course's start and end (maps to `valid_from`/`valid_to`). Reuse the shipped create wrapper; no new screen.
2. Early-bird presets: after a paid course type is SAVED, offer presets (for example "Early bird: cheaper until N weeks before the start"). A preset only pre-fills step rows in the T3 `PriceSteps` editor as an unsaved draft; the organiser edits and saves each step through the existing T3 path. Never write steps automatically. Presets whose date falls in the past, or any preset on a free type, are not offered and say why. Never exceed 3 steps.
3. All dates are London time using the T3 helpers (spring-gap refused, autumn resolves to the later instant).
4. Everything behind flag `ticketCoursePresets`; flag off = no visible change.

## Gates
- Table-driven tests, screen x shape: free course, paid course, course with 0/1/3 existing steps, start date in the past, start less than the preset lead time away, DST dates, unsaved type. Red first. Empty states say what to do; disabled controls say why.
- 390x844 and 360x640 walk spec in `tests/e2e/walk-ticket-t5-course-presets.spec.ts`, registered in `scripts/check-e2e-spec-coverage.mjs`.
- Run targeted tests, push once, `bot-push-retry`. Open a bot-authored PR with the per-job CI table, a Verified / Not verified block, and a handover at `docs/briefs/ticket-t5-course-presets.handover.md`.
- Boundaries: Supabase read-only; no migration; no edits to T3/T4 behaviour beyond what the presets need.
