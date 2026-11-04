# scope-queue-1 (read-only scoping, docs only)

Brief-version: 2

Goal: owner works from a priority queue and wants every idle worker slot filled with safe work. We have no current list of what is left. Produce it from CURRENT main (the 2026-10-30 audit docs/scoping/organiser-remaining.md on claude/audit-organiser-remaining is stale: re-verify every claim against main before using it).

## What main lacks
- docs/scoping/queue-organiser-ticketing-2026-11-04.md: a ranked list of what is left in (A) the P3 organiser area (create event, Account/More, landing for people with 1+ pages, A1 gate screen, Going W4c) and (B) the Website side of ticketing (organiser ticketing screens, my tickets, door, S3/S4), each re-checked against main with file:line.
- docs/briefs/<name>.md: for the top 4 unblocked items, one dispatch-ready brief each (Brief-version 2, with `## What main lacks`, `## Files`, lane, model, tests-red-first, Phone QA shapes).

## Files
- docs/scoping/queue-organiser-ticketing-2026-11-04.md
- docs/briefs/ (new files only)

## Rules
- Read only: no source edit, no migration, no prod write; Supabase SELECT counts only.
- For each item say: serves which queue number, files it touches, whether it needs a migration (then mark BLOCKED/careful), whether it overlaps any open PR (gh pr list), flags it depends on (organiserP3, ticketing: both OFF on prod).
- Items that need an owner product decision go in a separate "Owner choices" list with 2-3 options each, not in the briefs.
- One push, commit subject ending [worker-done <ticket>]. Docs only: add [skip preview] to the subject.
