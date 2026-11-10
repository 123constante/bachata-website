# Handover: S1a Website night-aware ticket buying

Ticket: dt_ddd3b3689f7f. Branch `claude/ticket-night-aware-website`. Brief:
`docs/briefs/ticket-night-aware-s1a-website.md` on `brief/ticket-night-aware-website` (blob 0ad46cd).
Design record + prod shape survey: `docs/design/ticket-night-aware-website.md`.

## Done

- Read: `fetchPublicTicketTypes(seriesId, occurrenceId)` calls `ticket_types_public_v2`; key
  `['public-ticket-types', seriesId, occurrenceId]` in TicketsBlock, EventTicketsPage and the sticky-bar
  probe (BentoPage -> EventStickyActionBar -> InSiteTicketProbe now passes the night). v1 is no longer
  called by the buyer module; nothing server-side was removed.
- Parse: `soldOut`, `effectiveCloseAt`, `kind`, `validFrom`, `validTo`, `needsNight` (v2 remaining NULL).
  GBP-only drop kept.
- Rule: server `sold_out` wins; `needs_night` availability ("Choose a night"); `effective_close_at` for Closed.
- Promo: `ticket_promo_preview_v2` with `p_occurrence_id`.
- Checkout: `occurrence_id` in the body whenever the page has a night (course too).
- No night on screen: no Buy / form; "Choose a night to buy tickets." + "See the dates" (closes the
  Tickets page, scrolls to the Dates tile). Quiet bar says "Choose a night".
- Refusal copy for wrong_night, night_required, night_cancelled, night_ended, not_course_night, way
  forward "Choose another night"; list re-read on these.
- Course line from data with full weekday names.
- Tests: `src/modules/tickets/__tests__/nightAware.matrix.test.tsx` (26 cases red on unfixed code, green
  after); existing tests updated (v2 args, reason map), no assertion deleted.

## Prod facts that differ from the brief

- Latino Flava is `ended` with 0 ticket types; the survey used Coco Loco, Bachata Playground (types
  paused) and Ritmo de Bachata Festival. Only kind `night` exists in prod; no course row; nothing sold out.

## Left / next steps

- Browser walk at 390x844 on the Vercel preview + screenshots on the PR (not done by this worker: see the PR's
  Not verified).
- A different worker's UI critique (impeccable-finish-reviewer) before hand-off.
- Release order: this PR merged and live -> owner runs the edge deploy. Until then the old edge ignores
  `occurrence_id`, so buying behaves as today.

## Status (worker dt_ddd3b3689f7f)

- PR: #1523 (opened automatically from the first push; title and body updated by this worker).
- tsc run on c624118: 0 errors in branch files (`tsc -p tsconfig.app.json`; same error set as main, all in untouched files).
- Independent review (subagent): no correctness bugs. Its two UX notes are fixed in c624118.
- Verified: tickets + bento vitest 986/986, `npm run lint` exit 0, check:mojibake clean, both PR-body checks exit 0.
- Not verified: browser walk and screenshots on the preview; real Stripe; edge deploy; UI critique by a different worker; GitHub PR checks per job (not read: no gh api); main-branch baseline for 15 failing `tests/` files (live-DB / env tests, none import tickets).
