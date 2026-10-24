# ER-C6 handover: public facts (branch claude/er-c6-public, base claude/er-s1-rules)

## Done
- `src/modules/event-page/publicFacts.ts`: ONE mapping (`paymentLine`, `organiserByline`, `timetableSoon`, `cancelledLine`, `publicFactLines`). Payment labels come from `event-rules.json`; no line when no known code (legacy `passes` gives none).
- Wired: `useEventPageQuery` reads organiser `role`/`status`; `buildEventPageModel` gives `factLines`; `DescriptionBlock` (About tile) prints them above the body; the tile now also shows when only facts exist. No layout/density change.
- Tests: `__tests__/publicFacts.test.ts` (4 formats x 6 payment shapes x with/without workshops, byline accepted-only, cancelled, timetable).

## Already on the page before this card (not changed)
Times from sessions, session level, line-up, festival party hours and Cancelled strip with reason are rendered by ScheduleBlock / DateBlock / CancelledRedStrip / calendar rows.

## Left
- Calendar day row: payment + byline need the fields on the calendar row (see parked file). Excluded files untouched.
- Wire `cancelledLine` where a surface needs it; today the strip already shows the reason.
- Server not landed: organiser `role`/`status` and festival artists. End-to-end NOT verified.

## CI steps run in sandbox
| Command | Exit |
|---|---|
| `npx vitest run src/modules/event-page` | 0 (291 passed) |
| `npm run test:unit` | non-zero: 15 failures in 4 files, all live-DB contract tests (eventViewCompat, occurrenceProgram, publicEventPageLineup: no prod access in sandbox) and integrityCouldNotRun (sandbox env); none touch this change |
| `npm run build` | 0 |
| `tsc --noEmit` | no errors under `src/`; pre-existing errors under `app/` |
| `npm run lint`, `check:*`, `pre-ship`, perf budgets, `check:og` | NOT RUN |

## Verified on real data
Verified: unit table over the prod shapes named in ER-COMMON (formats, payment none/ticket link/passes/door/cash, festival with/without workshops).
Not verified: Supabase shape survey (not run), live payload with organiser roles (server not landed), perf-budgets, SEO/OG.

## Phone QA (390x844)
NOT DONE: no browser walk in this run. Text-only change to the About tile; needs a phone check on a festival with no workshops and an event with no payment.
