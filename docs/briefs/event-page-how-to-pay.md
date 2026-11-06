# Brief: "How to pay" line on the live event page

Brief-version: 2
Repo: Website. Branch: claude/event-page-how-to-pay. Lane: normal, Sonnet. No database change. Read src/modules/event-page/CLAUDE.md first: BentoPage.tsx is the real /event/:id render and sections/ is mostly dead.

## What main lacks
- A dancer-facing payment line. Organisers save payment methods (and the `free` code) in P3 Prices (src/modules/organiser/p3/data/prices.ts, `isFree`, `methods`); `buildEventPageModel.ts` line 256 passes `eventInfo.paymentMethods` (the stored comma list) into the page model; its only renderer `sections/EventInfoSection.tsx` has NO importer (verified: `git grep EventInfoSection origin/main -- src` finds only the CLAUDE.md note). Nothing under `src/modules/event-page/bento/` shows payment text -- grep: HowToPayLine
- A pure formatter from the stored string to words: 'Free', or the saved methods as 'Ticket link, Pay at the door, ...' -- grep: howToPayText
- A table test over free / methods / none / past / cancelled -- src/modules/event-page/bento/__tests__/howToPay.matrix.test.tsx
- Already on main, reuse: the code list and labels `PAYMENT_METHODS`, `PAYMENT_LABEL`, `parsePayment`, `paymentText` -- extends: src/modules/organiser/events/paymentModel.ts

## Files
src/modules/event-page/bento/blocks/HowToPayLine.tsx (new), src/modules/event-page/bento/BentoPage.tsx (edit, one render site), src/modules/event-page/bento/__tests__/howToPay.matrix.test.tsx (new), docs/design/event-page-how-to-pay.md (new design record). Possibly src/lib/paymentMethods.ts (new, pure) plus src/modules/organiser/events/paymentModel.ts (edit to re-export from it), only if deliverable 1 triggers.
None of the density-exclusion files in CLAUDE.md (EventCalendar, CalendarGrid, CalendarListView, DayDetailModal, calendarUtils, useCalendarEvents) is touched; if the work turns out to need one, STOP and report. HTML entities in JSX, no raw Unicode punctuation. Compact per .claude/rules/design-density.md; explicit px sizes.

## What to build
1. One shared mapping, no copy. `paymentModel.ts` imports `upsertCommand` from organiser code, so importing it into the public event page may pull organiser code into that route's chunk. Check against `perf-budgets.json` and the build output. If it adds weight, move the pure parts (`PAYMENT_METHODS`, `PAYMENT_LABEL`, `parsePayment`, `paymentText`) to `src/lib/paymentMethods.ts` and have paymentModel.ts re-export them, so organiser and public read the same labels. Otherwise import directly.
2. `howToPayText(stored)`, pure: stored contains `free` -> 'Free' (free wins even if other codes are stored); otherwise the known methods in screen order via `paymentText`; empty, null or only unknown codes -> null.
3. `HowToPayLine` renders one compact line ('How to pay' label + text, text-sm, no new tile) and nothing when the text is null. In BentoPage.tsx render it once, near the tickets block, from `pageModel.eventInfo.paymentMethods` (the existing model value; add no query). Upcoming events only: hidden when `over` (past) or `occurrence?.isCancelled`, matching how the group-chat CTA is gated in the same file. Do not add the dress code or age chips (out of scope).
4. Design record docs/design/event-page-how-to-pay.md: brief, ONE chosen placement with why, two rejected alternatives in two lines each (a full bento tile; reviving the dead sections/EventInfoSection).
Tests, RED FIRST (new rows fail on unchanged code): table of stored value x event state. Values: 'free'; 'free,door' (shows Free); 'ticket_link'; 'door,bank_transfer,cash' (screen order); null; ''; 'bogus'. States: upcoming, past, cancelled (and paused if the page model exposes it). Assert the line text and its absence when hidden, plus one render test through BentoPage with a model fixture (follow how existing bento tests mount it, e.g. bento/__tests__/lazySlotHydration.test.tsx).

## Out of scope
No database change, no organiser-screen change, no ticketing UI change (TicketsBlock stays as is). Walk /event/<id> at 390x844 for a free event, a paid event with 3 methods, an event with none saved, a past and a cancelled one; no sideways scroll.
Not verified by this brief: how many prod events have payment_methods saved. The worker must run the read-only shape survey (counts only) before calling it ready.
Hand-off: Verified / Not verified block, design record linked in the PR body.
