# People arc P2 -- what the calendar really holds per role (counts only)

Surveyed 2026-10-23 on prod (`stsdtacfauprzrdebmzg`), read-only SELECT. Same population as the P0 audit
(`docs/people-arc/audit/shapes.md` on `claude/people-arc-audit`): live `dancer_profiles` rows (not archived,
`is_active` not false), roles from `get_public_person_roles_v1(id)`. "Upcoming" = rows of
`get_profile_event_timeline_v2(role, id)` starting from now. That RPC reads the lineup (program people),
so it is the lineup authority the brief names. Photo = `dancer_profiles.avatar_url` set.

## Upcoming dates per person, by role

| Role | People with the role | Photo | 0 upcoming | 1 | 2-5 | 6+ | Ever in a lineup (past or future) |
|---|---|---|---|---|---|---|---|
| Teacher | 124 | 81 (65%) | 76 | 40 | 8 | 0 | 67 |
| DJ | 40 | 35 (88%) | 23 | 10 | 7 | 0 | 23 |
| Dancer | 97 | 92 (95%) | 97 | 0 | 0 | 0 | 0 |

- **Teacher**: 48 of 124 have a class or workshop coming up (59 lineup rows over 27 events, 32 of the rows
  recurring). One extra upcoming row is an MC slot, not teaching. Nobody has 6+.
- **DJ**: 17 of 40 have a gig coming up (27 rows over 24 events). Nobody has 6+, so "3 coming up" is the
  biggest count we will show today.
- **Dancer**: the calendar has **nothing** for dancers. The timeline returns no rows for any dancer; the
  whole program table holds one "performing" row for a dancer. So the dancer tab can only show profile
  facts (dance role, languages, nationality), never dates.
- **Festivals**: `event_series_festival_artist_p5` has **0 rows**. No festival line-up to show on any tab.

## The DJ-only shape the brief asks for does not exist

No DJ-only person has 2+ upcoming gigs (P0: 4 DJ-only people, 2 with one gig, 0 with two). The mockups
use **Papacito** (DJ + dancer, 2 upcoming gigs, opened from `/djs/papacito`) for that shape, so it shows a
tab row. The DJ-only one-gig layout is the same page with one row and no count.

## The real people in the mockups

| Shape | Person (public name) | Roles | Photo | City | Upcoming |
|---|---|---|---|---|---|
| Thin dancer-only, no photo | Magda (`440f99dd`) | dancer | no | London | none; dance role "Lead and Follow" |
| Teacher-only, no photo | Pierre Henry (`0dd8819b`) | teacher | no | **none** | none |
| DJ with 2 gigs | Papacito (`ae3bffbb`) | DJ, dancer | yes | London | DJ: Fri 23 Oct, Thu 31 Dec |
| All three, rich | Ramiro Zapata (`456af8d2`) | teacher, DJ, dancer | yes | London | DJ: 3 gigs; teacher: 1 class (Sat 21 Nov); Leader, Spanish + English, Bolivia |
| Long name (21) | Sabrina Guzman Pastor (`6f05d2f6`) | dancer | yes | London | none; Follower |

Not surveyed: the DJ name column (P0 found "Papacito" vs "Morcilla"); the mockups use the dancer-row
public name on every tab, which is one of the open questions.
