# Brief: S3b critique fixes (continuation on claude/ticketing-organiser-ui, PR #1060)

An independent critic walked the redesign (20 states at 390x844) and found it matches mockup B, with fixes. Read it: `git fetch origin claude/ticketing-organiser-ui-critique` then `git show FETCH_HEAD:docs/review/ticketing-organiser-ui-1060.md`. Read docs/handover/ticketing-organiser-ui.md and docs/design/1060.md.

Fix, each red-first (run the new test on the unfixed code first and say so):
1. BLOCKING: remove `topBarEnd` from TicketsHome.tsx (~:128) so the profile switcher stays; put the "Paid out via Stripe" chip on the page-name line (~:124), name left, chip right. Add a test that the switcher is present on connected Home.
2. `eventLeftLine` (ticketModel.ts ~:472) counts only `on_sale` and `sold_out` types; chip alone when none. Add the mixed shape (on sale + paused + draft) to compact.model.test.ts.
3. Thousands separators in the ONE helper: formatPence via `toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2})` and the same for the Sold count and any other count shown on number cards.
4. When `stripe !== 'connected'` and the Next step card is not `connect`, render one link under the number cards ("Payments not connected. Connect" / "Finish connecting") reusing startOnboarding (lift go() from NextStepCard into a small hook). Test every stripe state x ticket mix (all free, mixed, none).
5. Smaller: an edit sheet shows "Save changes" on every step; the aria-describedby id at parts.tsx ~:289 must exist when the reason is the role one (SeriesTickets.tsx ~:270).
6. Add tests for what the critic listed as uncovered where cheap: "Close sales for good" confirm, the back-from-Stripe notes, orders empty state words.

Then: full tickets + focusReturn tests, `npm run lint`, `npx tsc --noEmit`, every other CI job step that applies. Keep PR #1060 body labels exact (`**Shapes surveyed:**`, `**Checks run:**`, `**NOT verified:**`, `**Sizes checked:**`, `**Walked:**`, `**Not verified:**`). Flag organiserTicketing stays OFF. These fixes are unreviewed code: say so in the handover. Final commit subject ends with your done marker (not [skip preview]).
