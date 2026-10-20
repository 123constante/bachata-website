# INT3 walk -- 390x844, production build, route-mocked organiser fake

Script: `tests/e2e/walk-int3.spec.ts` (throwaway, not in the `test:e2e` gate). 11/11 pass on the INT3 head. Fake clock 8 Oct 2026; Friday Bachata (weekly, class + party); 23 Oct is a NON-next date.

| shot | what it shows |
|---|---|
| 01-change-what-23-oct | Change "what" for a non-next date: time, venue, note/ticket/picture, Copy, Sessions, **Take this date off**, Cancel this date |
| 02-lineup-23-oct | Sessions and line-up for 23 Oct: class + party with people, Add a session; THIS DATE rows read **Take this date off** (was "Break this week") |
| 03-venue-23-oct | Different venue for that date only: venue list |
| 04-ticket-23-oct | Ticket link for one date |
| 05-picture-23-oct | Picture for one date |
| 06-note-23-oct | Note for one date |
| 07-copy-list | Copy changes: the two copyable dates first, newest first (6 Nov, 30 Oct), then every other date disabled with the reason |
| 08-copy-keys | After picking 30 Oct: which keys will copy |
| 09-take-off-confirm | Take this date off confirm, button "Take it off" |
| 10-cancel-from-change | Cancel opened from Change for 23 Oct |
| 11-keep-it-back-on-change | Keep it lands back on Change "what" for 23 Oct (was: the cancel date list) |
| 12-pick-two | Pick several dates: two ticked, the count |
| 13-pick-confirm | One confirm with the count and reason chips |
| 14-pick-result | "2 done, 0 not changed" |
| 15-time-class-social | Change time on a class + social date: both sessions previewed, "Every session moves by 1 h later", End of Party |
