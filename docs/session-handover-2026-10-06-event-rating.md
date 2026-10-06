# Session handover: 2026-10-06, event-page level rating / RSVP

Branch: `claude/event-page-rating-rsvp-fix`. PR: #591 (diagnosis only; open, not merged).

## Done

- **Root cause of the missing "What level is this event?" prompt.** `BentoPage.tsx:590`
  passes `eventId` to `LevelRatingPrompt`. That id comes from `resolve_public_event_ref_v1`
  = `COALESCE(legacy_event_id, series id)` (= `event_series_p5.public_event_id`).
  `series_level_summary_p5_v1` only matches `event_series_p5.id`, so it returns NULL and
  the prompt renders nothing. Every live series has a differing legacy id, so this hits
  every live event page. My Attendance (`MyAttendance.tsx:254`) has the same bug.
- **RSVP "I'm Going":** hidden on purpose. `attendance.isVisible` is hard-coded `false`
  (`buildEventPageModel.ts:244`), and the RSVP toggle was removed 2026-09-07
  (`docs/event-aggregate-frontend-migration-plan.md:150`). No change made.
- **Repro test:** `tests/client/eventPageLevelRating.test.tsx`, 3 cases. The chips case is
  `it.fails` until the admin fix lands; flip `LEVEL_RPC_ACCEPTS_LEGACY_ID` to `true` then,
  and turn the `it.fails` into a plain `it`.
- **Doc note:** `src/modules/event-page/CLAUDE.md`.

## Open

- **Admin-repo fix (not started):** a `bachata-admin-11april` migration so
  `series_level_summary_p5_v1` and `rate_series_level_p5_v1` accept the public id
  (`legacy_event_id = p OR (id = p AND legacy_event_id IS NULL)`, or match on
  `public_event_id`), returning the real `series_id`.
- **Inherited red CI on #591** (not caused by its diff; details in the PR comment):
  - Preview-SSR 500s on bot `claude/*` previews: `doc-weight`, `lighthouse`,
    `og-preview`, `synthetic-preview`, `seo-preview`. These persisted on the 11:08 re-run,
    and #590, #589 and #586 fail the same checks. No fix exists yet.
  - `unit (Europe/London, full)`: live-DB statement timeouts (`57014`) plus the
    pre-existing `festivalClientState` flake.
- **Cloud-container quirk:** `NODE_PATH=/usr/local/lib/node_modules_global` breaks
  `tests/integrityCouldNotRun.test.ts` locally. Push with `env -u NODE_PATH git push ...`.

## Next

1. Author the admin migration above, then flip the repro flag on this branch.
2. Investigate why server-rendered routes 500 on bot `claude/*` preview deploys.
