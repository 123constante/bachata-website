# Brief REVIEW-SW1 -- independent review of the SW1 slice (read-only, Website)

Repo `123constante/bachata-website`. Review branch `claude/org-r1-parity-sw1` (head d20de737) against base `claude/org-r1-integrate` (7d9751c). You are NOT the author. Do not change source. Push ONE docs-only commit to `claude/org-r1-review-SW1` (create from the SW1 head) with `docs/organiser-rebuild/REVIEW-SW1.md`, last commit subject ending `[worker-done <ticket>]`. Plain git only, no gh api, no variables/loops in shell, context under 30%.

READ: the SW1 brief (`git show origin/arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/SW1-series-programme.md`), the handover `docs/organiser-rebuild/handovers/SW1.md` on the SW1 branch, then the diff.

## What to check (owner phone-test failures this arc must not repeat)
1. DATA SAFETY of `series.set_program`: it DELETES the whole programme tree and re-inserts. Prove from the code that every stored field the editor does not touch (room, venue_room_id, style, theme, track_id, parallel_group_id, label_override, day labels, date_offset_days, people sort/profile_type) is echoed back unchanged for every shape (festival, multi-day, parallel groups, stored types outside class/party, social sections, items with people of non-dancer profile types). Find any shape where Save would lose data. Build a table-driven test or read the existing one; mutate the echo and show it fails.
2. Gate honesty: with `AW1_APPLIED=false` no screen sends a write; every disabled control carries a reason in plain words; no text points at a missing control.
3. Every screen x shape: draft/live/ended/archived x one-off/recurring/course/festival x 0/1/many sessions x with/without line-up x owner/manager. Same fact reads the same on every screen (level chips, role words, session counts).
4. 390x844 UX and a11y: tap targets 44px (html font-size trap), focus return after sheets, labels, in-page confirm, copy in plain English British, `&mdash;` entities, no jargon.
5. Parity matrix integrity: the 5 new rows really name a reachable screen; counts 45/11/8/7 are computed, not typed.
6. Run the CI steps relevant to the diff yourself and give a per-job table (command, exit). The bundle-budget red exists on the base: confirm with the base build, state it.
Severity: BLOCKING / SHOULD / NOTE, each with file:line, failure scenario, and the fix in one sentence. Verified / Not verified block at the end.
