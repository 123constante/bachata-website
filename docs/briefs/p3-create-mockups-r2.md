# Brief: P3 create-event mockups, revision round 2 (docs/HTML only)

Branch `claude/p3-create-mockups` (continue it; PR already open). Docs and HTML only; no source change. Read first: `docs/design/p3-create-event.md`, `docs/design/p3-create-event/build.py` and the pages it generates.

## What the owner said (2026-10-30, quoted)
"why does it say start an end of event? Are you forgetting that our times are determined by the times of the sessions"

## The defect
A, B and C give the EVENT its own Start and "Ends" (with "Ends the next day"). An event has no start or end of its own: its times are its sessions' times (first session start, last session end). The design record also lists "no end time" as a wizard gap, which was the wrong reading of the old wizard's Start time.

## Prove the data source first (before drawing)
Read, read-only on prod (project `stsdtacfauprzrdebmzg`, SELECT only) and in the repo: how `series_command_p5` and the old wizard (`src/modules/organiser/flows/new/`) store the start time, what a session row holds (start, end, kind), and which column or RPC the Home/Events/DateSheet screens read for an event's displayed time. State in the design record which table and column the displayed event time comes from and who writes it. Do not draw a field the data model cannot store.

## Change
1. Remove the event-level Start and Ends (and "Ends the next day") from every phone state in A, B and C.
2. The create flow asks for the FIRST SESSION's time (start, and end if the model has one), inside the existing "What happens" / session step. For a one night: one session. For weekly: the same session repeats. Say in plain words what the person is setting ("When does it start?" is fine only if it is the session).
3. Everywhere else the event's time is READ-ONLY and labelled as coming from its sessions, e.g. "9pm to 2am, from your sessions"; empty state when no session has a time says what the person can do (add a session).
4. Fix the comparison table (taps, screens) and the design record: replace the "No end time" gap with "times live on sessions"; keep the other gaps (course, first session, venue not found, run-until for weekly, 30-day limit, delete a draft).
5. Keep what the owner liked (all three options A, B, C stay). Regenerate via `build.py`; dark and light; 390x844; taps >= 44px.

## Done
Push with last commit subject ending `[worker-done <ticket>]`; leave `docs/handover/p3-create-mockups-r2.md` (done / left, and the data-source answer). Honest Verified / Not verified. Do not add the automerge label.
