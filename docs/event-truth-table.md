# Event truth table &mdash; one source per fact

*Written 2026-10-12 for the event-truth arc (plan
`in-the-admin-dashboard-peaceful-tide.md`); P3 2026-10-13: date-only sessions
join the derivation and `category_drift` gates at 0 since admin #780. Every row
names the SINGLE source of a fact about an event and every reader of it. A
reader not on the list is a finding. Enforced by
`scripts/check-event-truth-v1.mjs` (CI #70) where a row says so; the other rows
record decisions so nobody re-litigates them.*

## The defect this table exists for

An event's "what is it" was stored in two places that nobody made agree:

- **declared** &mdash; `event_series_p5.category` (`party | class | workshop |
  masterclass`), asked up front on the organiser "New event" screen and in the
  admin editor's "Event type" select;
- **derived** &mdash; the programme sessions (`event_series_program_section_p5.kind`
  + `event_series_program_item_p5.type`), which is what the public calendar's
  Parties / Classes tabs actually read (`src/components/calendar/calendarUtils.ts`).

Measured on prod 2026-10-12 (read-only, counts only): 7 live series whose
declared category contradicts every one of their sessions (five "courses" of
pure class sessions stored as `party`), 2 live courses with no length, and
three public RPCs computing `has_class`/`has_party` from three different sources.
Root cause of the five courses: the admin select rendered a NULL category as
`party` and the first touch wrote it.

**Owner decision (2026-10-12): the sessions are the truth.** `category` becomes
derived from the programme (P1/P2); nobody is asked it. The create screens ask
only what cannot be derived: `format` (admin) and "what is the first session?"
(organiser, as a session seed). A night is `party` AND `class` (multi-valued);
single-word readers use the precedence festival &gt; course &gt; party ("night")
&gt; masterclass &gt; workshop &gt; class.

## The table

| fact | single source | readers today | status |
|---|---|---|---|
| **genre** (party / class / masterclass) | programme, the UNION of three sources through ONE mapping: series section `kind`, series item `type`, and date-only session `section_kind` + `type` (`event_occurrence_added_session_p5`, where `organiser_set_occurrence_programme_v1` writes and the only sessions a new organiser-created series has), with the readers' synonyms (masterclass counts as a class too; `social` is a party; unknown values and nulls say nothing). `src/lib/eventCategory.ts` `deriveCategories` is the canonical rule (byte-pinned to admin); the check's `deriveGenres` is its JS twin, held to it by `scripts/fixtures/event-truth-parity.json` (run by the check's `--self-test` AND `eventCategory.parity.test.ts`) | `calendarUtils.ts` hasParty/hasClass; `endedRun.ts` runNoun; organiser `EventEditorPage` Type row; admin `EventList` Category filter; `genreSynonyms.ts`; `get_calendar_events_v2` (per occurrence day, via `key_times` and session overrides), `get_latest_events_v2` (series-wide, `prog.p5_*` over item types); `get_map_events_v1` passes the calendar's flags through | **gated at 0** since admin #780 (P3, 2026-10-13): `category_drift` has an EMPTY baseline, so ANY live series whose stored mirror disagrees with its sessions fails, a NULL mirror under mapped sessions included (the mirror is derived; unset means it was not written). Reader agreement is **reported only** (`reader_flags`, 0 of 29 on 2026-10-12): calendar and latest differ by grain until P1, so a gate would fire on a festival whose party is on day 2 |
| **shape / cadence** (one_off, recurring, course, festival) | `event_series_p5.format` | admin cadence filter, `eventFormat.ts` isFestival, festival pages | not gated here; `recurring` with a NULL rule is an **accepted shape** (ad-hoc monthly, next date added by hand &mdash; CI #28's own doc) |
| **course length** | `course_total_sessions` (must be set on a live course) | admin editor, course pages, `check_finite_course_phantom_tail_v1` | **gated** &mdash; `course_without_length` ratchet (2 known ids) |
| **upcoming** (is this listing alive?) | a `scheduled` `event_occurrence_p5` row &ge; today | calendar, map, latest, organiser home | **CI #28 owns it** &mdash; reports NULL-rule series with no future date, gates only open-ended rules, on purpose ("gating would red every finite series at its end"). Remedy is the admin "Needs attention" list, not a second red. |
| **start time** | earliest programme session when one exists, else `default_local_start_time` (admin hint already says so) | `materialised_start_utc`, calendar times | not gated; 4 of 66 disagree on 2026-10-12, folds into P1 |
| **section kind vs item type** | the section `kind` wins (enum); item `type` is free text | derivation input | **reported only** (`kind_vs_type`, 8 on 2026-10-12) |
| **level** | session `level_keys`; `default_level` mirrors | event page, filters | already guarded (0 drift); party-level writes refused by `trg_refuse_party_level_series_v1` |

## How the ratchet works

`event-truth-baseline.json` lists, per rule, the series ids that were drifting on
`recorded_on`, each with a human name. The check fails on a **new** id and on a
listed id that is still measured but **no longer drifts** (a stale entry), so the
file can only shrink, and it shrinks in the same PR as the repair. A listed id
that **left the measured scope** (the series ended or was archived, or its
programme no longer maps to any genre, or it was paused) is reported as departed, not failed:
nothing was repaired, and a series finishing must not red the daily run on main.
Prune departed entries when convenient. Repairs are owner decisions taken in
the admin "Needs attention" list (admin repo, after P0), never automatic.

**`category_drift` gates at 0 since admin #780 (P3, 2026-10-13).** The stored
`category` is a derived mirror and #780 repaired every live series from the
sessions, so the block is empty and stays empty: a red here is a mirror that
drifted (a write path that bypassed the derivation), never a reason to add an
id. `course_without_length` is not repaired by #780 and keeps its two ids. The
departed / stale split still applies to both blocks.

**The payload since #780.** `check_event_truth_v1()` carries, per live series,
`added_sessions: [{kind, type}]` (date-only sessions; `kind` = `section_kind`;
`[]` when none) and a top-level `added_session_count` the RPC computes from its
own base-table join. Both are REQUIRED: the P0 payload without them is exit 2
(fail closed, as every other key), never a pass that cannot see date-only
sessions. The measurement floor is series sections + date-only sessions, so a
future where every live series is organiser-created (date-only only) still
measures.

## Already-decided soft spots (do not re-open without a fresh decision)

- **Live series only.** `check_event_truth_v1()` is anon-callable, and a paused
  or `pending_review` series is not public: returning it would let anyone
  enumerate unpublished submissions. A series is measured from the moment it
  goes live, which is when its category starts misleading the public. The
  guard treats a non-live row in the payload as exit 2 (the RPC widened its
  scope), never as data. On 2026-10-12 this leaves out 1 paused series.

- Live series with no future date &mdash; CI #28, see above.
- `recurring` with NULL `recurrence_rule` &mdash; accepted; see CI #28's comment.
- `check_event_program_section_consistency_v2` checks orphans only (reports 90
  item-less sections, healthy). It does **not** check kind vs type; this table does.
