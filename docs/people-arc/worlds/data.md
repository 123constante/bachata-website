# People arc P2b -- the facts the worlds draw (counts and public names only)

Surveyed 2026-10-23 on prod (`stsdtacfauprzrdebmzg`), read-only SELECT. Population and role counts are the
P0 audit's (`docs/people-arc/audit/shapes.md`, branch `claude/people-arc-audit`) and the P2 survey's
(`docs/people-arc/mockups/data.md`, branch `claude/people-arc-mockups`); not repeated here.

## New facts this round

| Fact | Source | Value |
|---|---|---|
| Papacito's DJ name | `get_public_dj_v1(ae3bffbb..)` | `dj_name` = Morcilla, public name Papacito |
| Ramiro Zapata's DJ name | `get_public_dj_v1(456af8d2..)` | none set, so the DJ world shows only "Ramiro Zapata" |
| Teacher with an upcoming class | `get_profile_event_timeline_v2('teacher', id)` over teacher-only people | Nadeem Malik (`997b9d08`): no photo, no city, Latin Krazy at Sway Bar, Thursday 29 October 19:30 |
| Papacito played at (DJ) | same RPC, rows before today | Sensual Vibes (October 2026), Raquel Castro (Ladies Styling Special) - Pyjama Party (September 2026) |
| Ramiro played at (DJ) | same RPC | 50/50 (October 2026), London Loves BOS (August 2026) |
| Socials this week in London | `get_calendar_events_v2('2026-10-23','2026-10-29','london-gb')` | 29 rows in the week; the mockup shows the first 5 parties (festival abroad left out) |

Times are London wall-clock: the rows are UTC and London is on BST until Sunday 25 October.

## Teacher-only people with an upcoming class (shape notes)

The first rows with a photo are all couples teaching at a congress in Spain in March 2027 (city Madrid or
Barcelona). The London teacher-only rows with a class next week have no photo and no city. Nadeem Malik is
that common London shape, so he is drawn.
