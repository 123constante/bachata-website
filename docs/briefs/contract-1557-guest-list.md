# Draft the acceptance contract for queue issue #1557 (Organiser Guest list tab, Option B)

Docs only. Do NOT build the tab. Output: one comment-ready contract, committed as docs/contracts/guest-list-1557.md on branch claude/contract-1557 (create from main, push only that branch).

Read: issue 123constante/bachata-admin#1557 (title, body, GAPs G0-G7), docs/design/profile-dash/organiser-guest-list-option-b.html on main, docs/design/profile-dash/ siblings, ~/.claude is NOT available: use only the repo.

Contract shape: person x journey x data shape. People: organiser (owner), organiser team member, non-organiser (must be refused). Journeys: open Guest list, search/filter, see ticket status, export/share if the design shows it. Data shapes (read-only prod survey via the Supabase connector SELECT counts, no personal data): no bookings, few, many (over the 100-row API cap), refunded/cancelled, free vs paid.
For each GAP G0-G7: one line, what is missing (RPC, RLS, UI), which repo owns it (schema = bachata-admin), and whether it is money/RLS (needs full review).
End with: an ordered slice list (smallest first) and the open product questions for the owner, as click questions.

Final commit subject ends "[worker-done dt_xxxx]" (the dispatch ticket id).
