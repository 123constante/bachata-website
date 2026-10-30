# Brief: P3 acceptance contract, round 2 (docs only; branch claude/p3-acceptance-contract-2, built on claude/p3-acceptance-contract)

Context cap 30%. Docs only, no src/. Supabase read-only. Push once; end the commit subject with the [worker-done <ticket>] marker named in the dispatch prompt. Start from branch claude/p3-acceptance-contract (git fetch, create your branch from it).

Round 1 wrote docs/design/p3-acceptance/{INVENTORY,CONTRACT,ACCOUNTS}.md (61 rows, persons a-d, journeys J-a1..J-d13). The owner then added people, decisions and gaps. Extend the same files; keep ids stable; update the coverage count at the end.

## Add persons and journeys
- (e) EXISTING organiser with pages/events already in the system: page auto-claimed at sign-in by email; page claimed through the find-and-claim flow; page waiting on an open access request; person holding 2+ pages (Switch page; what Home, Events, Stats show per page); page with 50 past events and a long history; page with two owners; half-claimed page.
- (f) dancer, teacher or DJ who LATER says they are an organiser (organiser is a seat on a page, not a label): from the dancer home link, from /account/o hand-off, from Your areas; what happens to the dancer-profile-first gate; are teacher/DJ profiles and the organiser page presented as one account.
- (g) co-organiser / invited helper (BACK IN SCOPE): invite, accept, owner vs manager rights per screen (name, photo, contact, team, events, tickets), leave a team, last owner leaves, a manager of page A must never act on page B.
- Extra states for every person: signed out, expired session, wrong account, deleted/hidden/suspended account, slow network, save that half-fails, back button mid-flow, refresh on each screen, two people editing the same event, clock change / after-midnight / multi-day festival, non-London city copy.
- Extra journeys: old links and bookmarks into the retired organiser screens and the emails (claim, invite, approval) land in the new area; public event page shows what the organiser set (edit a date, cancel, repeat rule, cover, price).

## Owner decisions to bake in as RULES the walker tests (2026-10-30)
1. Series edits: ask each time with a preview ("this date only" / "all dates"), the preview lists the dates that change and who is going; dates edited by hand are kept.
2. One person = one account, one "You" area with a section per role; "Switch page" is for organiser pages only.
3. Old saved data that fails a new check (e.g. a stored Facebook link) is accepted as-is until that field is edited; an untouched save must never be blocked or send a command.
4. Walk-first priority order: (1) existing organisers meeting the onboarding gate (gate ON, organiser with live events: "A few details first" sheet, grace period), (2) public page matches what was set, (3) co-organisers and several pages. Mark these journeys P1.

## Profiles area and event editing gap checklist (add as journeys, severity-rated)
Profiles: legacy values failing validators; owner vs manager rights per field; one person several roles; public result after save (photo crop, bio length, links, contact privacy); team add/remove/leave, last owner leaves; page lifecycle (unclaimed, claimed, hidden, taken down, duplicate, merge). Event editing: series vs one date; changing a repeat rule on a running series (which dates move, who is going); dates taken off, cancelled, moved and what going people see (cancel reasons are a fixed server list); times live on sessions (session times, rooms, per-date venue and line-up); line-up search and add-new person; publish state transitions incl. past and ended recurring events; editing an event with tickets sold or people going (what is blocked); concurrent edits; every admin-editor capability missing from the new editor (list as GAP). PARKED on purpose, do not add: undo history, make a copy, bulk cancel/move.

## Finish
Update ACCOUNTS.md with seed specs for persons e, f, g. Update the coverage line ("N rows, N covered, 0 uncovered"). Handover docs/handovers/p3-acceptance-contract-r2.md.
