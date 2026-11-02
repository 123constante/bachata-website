# Brief: VERIFY the public organiser page defects on prod + independent review of the inventory (Opus, read-only, docs only)

Branch `claude/organiser-public-verify`. Writes ONE file `docs/inventory/organiser-public-verify.md`. No source edits, no tests, no DB write (Supabase read-only: counts and function bodies only, no personal data).

Read `docs/inventory/organiser-public-page.md` on branch `claude/organiser-public-inventory` (written by a Sonnet worker; you did not write it, do not trust it).

## Do
1. For E4, E5, E6, E7 and E2 in that file: confirm or refute with evidence. E5: find an organiser on prod whose series are in a city other than the organiser's city and compare `get_organiser_calendar_events_v1` output to the series list. E7: compare `public_event_id` and `legacy_event_id` for every live series; count mismatches and say whether the page drops occurrences. E6: count organisers with dates beyond 365 days. E2: where is Facebook saved by the organiser area and by the legacy dialog, and does the public page render it.
2. Check the inventory's coverage claim: open the page code (`src/pages/OrganiserProfile.tsx`) and list any section, state or field the inventory missed. Check the shape table totals add up to 50.
3. Decisions already made by the owner (do not reopen): delete Verified badge; hide stats with no real number; show cancelled nights as "Cancelled"; hide empty-upcoming box, show past events else one line "No dates announced yet"; no bio = About hidden for visitors, claimed organiser sees "Add a short bio". For each, list the exact code that must change (file:line) and any data the change needs that the RPC does not return (e.g. cancelled rows).
4. Output: per item CONFIRMED / REFUTED / UNCERTAIN with evidence, then a proposed slice list (small, each with files and whether it needs a database change).

BASE CHECK: branch from current origin/main, verify `git merge-base HEAD origin/main` equals `git rev-parse origin/main` before pushing. Context cap 50%. Last commit subject ends with the done marker from your prompt.
