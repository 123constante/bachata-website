# Brief: fix review findings on PR #1542 (Website, normal lane, no DB change)

Repo 123constante/bachata-website. Continue ON the existing branch `claude/ticket-lead-in-site` (PR #1542, push to it; no new PR). Read the original brief docs/briefs/ticket-lead-in-site.md and the PR first. One push at the end.

An independent reviewer returned FAIL. Fix every item, then update the PR body.

1. Flash of her link (A): EventStickyActionBar.tsx ~113, ~253. While in-site ticketing is possible and the probe is pending, render NEITHER her external link nor a primary action (neutral placeholder of the same height, no layout jump). Her link shows only once the probe resolved not-live. Test it (pending state row).
2. JSON-LD (G): BentoPage.tsx ~209, ~661. ticketingLive starts false so server HTML gives her URL. Compute server-side/at first render from the series ticket types if the data is already available to the page; if it is not, keep the client flip but state this trade-off in the PR as an open owner decision (do NOT invent a server fetch or touch supabase/**).
3. Add tests (red first) for JSON-LD offer URL and onTicketingLive: table over shapes (buyable now, sold out, closed, not yet open, mixed, no types + link, link only, no link, past event): offer URL ours when live, hers otherwise.
4. Fix the "mixed nights" row: the mock must filter by occurrenceId and renderBar must pass one; add a row where THIS night is not open and her link shows while another night is open. The "ended event" row must use a link and prove it is suppressed or shown as the contract says.
5. Docs: docs/arcs/organiser.md:43 row I8 must cite this branch/PR and docs/design/ticket-lead-in-site.md (not public-ticket-lead); add/edit the HANDOVER-6 note (reverses "Tickets elsewhere kept when quiet"); keep the design record name.
6. Update the ticketLead.matrix.test.tsx header comment (lines 2-5, "small plain text link").
7. PR body: replace every "TO FILL": per-job CI table, Verified / Not verified block, say festivals unchanged (no modules/tickets import) and EventHeroMetaBlock/StickyTicketButton unused (no importers), 390x844 screenshots of Ritmo's page (walk on prod-shaped data: live nights hide her link, not-yet-open nights show it) attached, measured contrast >= 4.5 and taps >= 44px.

Boundaries: no organiser/tickets files (#1541), no migration, no supabase/**, no workflow edits, no fee/discount change, never merge or approve.
