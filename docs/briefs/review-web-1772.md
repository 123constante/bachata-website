# Review Website PR 1772: duplicate-account linking UI (independent review, read-only, permissions-adjacent)

Repo 123constante/bachata-website, builder branch claude/onboard-dups-website, PR #1772, head 733e497bc307df2ebca58ffa84bf2d59738928d4. Files: src/modules/dancer-app/api/accountLink.ts, screens/tickets/AccountLinkPanel.tsx, TicketsScreen.tsx, tickets.css, src/modules/tickets/CodeBoxes.tsx, TicketPickerB1.tsx, tests, scripts/dancer-area-isolation-allowlist.json.

Review only. Do not push to the builder branch. Write the verdict to docs/review/pr-1772.md on a branch claude/review-1772. The document MUST start with the header line `# Review PR 1772 (head 733e497bc307df2ebca58ffa84bf2d59738928d4)` (word head then the full sha; no other hex sha in the first 2500 chars), then ONE-LINE headings exactly: `## Verdict: PASS` (or `PASS WITH NITS` / `BLOCK`) and `## Hard-tier: PASS` (or `FAIL`). Check:
1. The panel and every new code path are invisible unless both flags are on: build VITE_ENABLE_BUYER_ONBOARDING and DB app_feature_flags.buyer_account_link (currently false). With flags off, TicketsScreen and TicketPickerB1 render exactly as before.
2. accountLink.ts calls only the existing admin RPCs with the right argument names/shapes; never reads another person's email or profile; the 6-digit code is not logged or stored in localStorage/URL.
3. Wrong-code, rate-limit and unlink states show plain warm British English and never reveal whether an address exists.
4. The allowlist change in scripts/dancer-area-isolation-allowlist.json is minimal and justified.
5. 390x844: no horizontal scroll, tap targets >= 44px, contrast >= 4.5 (CodeBoxes). CI at head is green (phone-qa (2) was a flake, passed on rerun).

Final report line exactly `PASS` or `FAIL` then up to 5 findings. Mark the commit with `[worker-done <ticket>]`.
