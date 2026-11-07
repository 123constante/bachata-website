# Going P0 &mdash; shape survey (prod, read-only, counts only)

Run 2026-10-23 against prod `stsdtacfauprzrdebmzg` via the Supabase connector.
SELECT only. No names, emails or ids were read; every number below is a count.
"Next 60 days" = `occurrence_date` from today to today + 60.

## 1. Where "going" lives today

| Object | What it is |
|---|---|
| `event_attendance` | `(occurrence_id, user_id)` unique, `status in ('going','interested','not_going')`. Already per **occurrence** (FK `event_occurrence_p5`). |
| `set_my_occurrence_attendance_p5_v1(p_public_event_id, p_occurrence_id, p_status)` | Current write path, per night. |
| `get_event_attendance_counts`, `get_event_attendance_counts_by_range`, `get_festival_attendance(_batch)` | Count reads. `get_event_attendance_counts` still returns `interested_count`. |
| `get_my_event_attendance_v2` | "My nights" read (per occurrence date). |
| `profile_complete_v1(p_person)` | THE complete-profile rule: first_name, based_city_id, dance_role, avatar_url all non-empty. |

Nothing today stores a "Show me as going" privacy flag (no column on `dancer_profiles`),
and nothing returns **faces**. Both are new (admin-repo migration, not this repo).

## 2. Live public nights, next 60 days (series `lifecycle_status = live`)

| Kind | Nights scheduled | Nights cancelled | Series |
|---|---:|---:|---:|
| Weekly / recurring series | 265 | 2 | 38 |
| One-off (no recurrence rule) | 5 | 5 | 4 (+1 with only cancelled nights) |
| Festival | 1 | 0 | 1 |

- 36 live scheduled nights fall in the next 7 days.
- Recurring series nights in the window: 30 series have 5&ndash;9 nights, 8 have 1&ndash;4.
  So a weekly series' event page always has a **next night plus several more** &mdash;
  the Going block must say WHICH night it is about.
- By `type` across all non-template series nights in the window: party 252, class 64,
  course 13, standard 11, festival 1 (scheduled), plus 14 cancelled.
- 42 future nights belong to series whose lifecycle is `ended` (they must not take
  new "going"; show the ended state).
- Past 30 days: 209 scheduled nights already happened, 18 were cancelled.

## 3. Festivals

- 7 live festival series. **All 7 have exactly 1 occurrence** (a multi-day festival is
  one occurrence spanning days). "Festival with many occurrences" = 0 today.
- Only 1 of those festivals has its occurrence inside the next 60 days.
- Design consequence: the festival hub "night row" is, today, one row per festival.
  The mockups still show 2 rows so the layout survives a future multi-night festival.

## 4. Going counts per night (the honest picture)

| | Count |
|---|---:|
| `event_attendance` rows, all time | 7 (5 going, 2 interested) |
| Distinct users with a "going" row | 4 |
| Occurrences with any attendance row, all time | 6 (max going on one night = 2) |
| Upcoming live scheduled nights (60d) with &ge;1 going | **0 of 271** |

**Zero is the real default.** The "0 going" state is what nearly every visitor
will see at launch; it has to look like an invitation, not a dead block.
The 1 / 3 / 9+ states are designed for growth; 9+ is aspirational today.

Of the 4 users already marked "going": 1 has a complete dancer profile, 3 have no
dancer profile linked through `claimed_by` (join caveat: profiles linked only by
`person_id` were not counted). Under owner decision 2 those 3 could not say going
&mdash; the migration must decide what happens to existing rows (suggest: keep the row,
hide from count/faces until complete; flag for the build PR).

The 2 `interested` rows must be migrated or dropped when "Interested" goes (decision 6).

## 5. Dancer profiles (`archived_at is null`)

| | Count |
|---|---:|
| Dancer profiles (all linked to an account) | 170 |
| Complete per `profile_complete_v1` rule | **30 (18%)** |
| Incomplete | 140 |
| &nbsp;&nbsp;missing dance role | 136 |
| &nbsp;&nbsp;missing city | 61 |
| &nbsp;&nbsp;missing first name | 45 |
| &nbsp;&nbsp;missing photo | 57 |
| Have a photo (any) | 113 (30 complete + 83 incomplete) |

Role values present: Leader 19, Follower 10, Lead and Follow 5, empty 136.

**Design consequence:** 4 in 5 signed-in dancers will hit the "finish your profile"
state the first time they tap Going. That state must name exactly what is missing
(usually *dance role*) and link straight to it &mdash; it is the main path, not an edge.

## 6. Organisers

- 35 distinct organisers are attached to live series (via `organiser_ids` or
  `event_series_organiser_p5`). Each sees per-night counts for their events.
- With 0 going everywhere today, the organiser view's empty state is the launch state.

## 7. Mockup data chosen from these numbers

| State | Data used |
|---|---|
| 0 going | most nights (271/271 today) |
| 1 going | 1 face |
| 3 faces | 3 going, all opted in |
| 9+ | 12 going; 10 have the switch ON &rarr; 8 faces shown + "+2"; the other 2 are counted, never shown |
| Me opted out | counted in the number, no face, a line telling me why |
| Unfinished profile | missing *dance role* (the commonest gap, 136/140) |
| Weekly series | "Next: Thu 29 Oct" plus a date picker chip row |
| Festival hub | 1 festival night row (real) + a 2nd row to prove the layout |
