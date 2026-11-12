# Brief: Events design, review fix round 2 (PR #1582). Docs only, Sonnet, normal lane. Branch claude/profile-dash-organiser-events-opts.
Independent review: all 8 fixes pass; fix these cheap items in Option A (organiser-events-option-a.html), re-shoot affected shots, re-run checks.
1. The skipped-draft row in the bulk-cancel sheet (SKIP_WHY ~line 362) says "Delete it instead if you do not need it", but the bulk bar has no Delete. Reword to "Open it and choose Delete draft."
2. Disabled sheet rows look enabled ("Edit this event" on cancelled/past sheets, "Put it live" on drafts, "Duplicate" for contributors keep black title and chevron). Add a `.row[disabled]` style (muted text, no chevron) keeping the reason text; contrast of the reason text still >=4.5.
3. Group-switch card is tight in huge.png (title and "its dates." line against the edges); series row wraps the "Fri 13" going-date onto its own line. Add padding / fix wrap.
4. Add "stays ... on your public page history" (~line 325) and "Dancers see them on the calendar marked Cancelled" (~line 259) to the unconfirmed list in the handover (Not verified).
Update organiser-events-checks.json and the handover. Run the workflow's mojibake git grep over the tree and confirm empty. Docs-only: no Phone QA section.
