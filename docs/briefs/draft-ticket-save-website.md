# Brief: draft events keep ticket prices (website half of PR3)

Branch: claude/draft-ticket-save-website
Size: 5 files, 300 lines
Model: opus
Repo: 123constante/bachata-website (base main)
Brief-version: 2

## What main lacks
- writeTicket (TicketSheetV2.tsx:113) always calls setTicketStatus on_sale for a new ticket, even on a draft series -- grep: Goes on sale when you put the event live
- no seriesLive prop on TicketSheetV2, so the sheet cannot tell a draft series apart -- grep: draftTicketSave
- goLiveKeys.ts has no label for readiness code ticket_payouts (shows "Something else on the event") -- grep: ticket_payouts

Background:
Owner feature (METHOD feature 1, "build this" 2026-11-27): an organiser can set ticket prices on a DRAFT event; the tickets go on
sale by themselves when the event goes live (admin trigger, admin#2518). A later admin PR widens `ticket_type_upsert_v1` so CREATE
on a draft series succeeds (row status `draft`). `ticket_type_set_status_v1(id,'on_sale')` keeps refusing a non-live series with
reason `series_not_live`. THIS website PR must merge BEFORE that admin widen, or every draft save leaves a stray closed row and a
retry makes a duplicate. Today create on a draft is refused (`series_not_live_or_not_organisers`), so this PR changes nothing
visible until the widen lands.

## Files
- src/modules/organiser/p3/v2/TicketSheetV2.tsx
- src/modules/organiser/p3/v2/TicketsV2.tsx
- src/modules/organiser/p3/v2/useWaysInGuideSave.ts
- src/modules/organiser/shared/goLiveKeys.ts
- src/modules/organiser/p3/v2/copy.ts
- src/modules/organiser/p3/v2/__tests__/draftTicketSave.test.tsx (new)

## Change (exactly this)
1. `src/modules/organiser/p3/v2/TicketSheetV2.tsx`
   - `writeTicket` gets a new arg `seriesLive: boolean`. When `seriesLive === false`, a NEW ticket skips the
     `setTicketStatus(id, 'on_sale')` call (line ~113) and returns `{ ok: true, id, changed: true, draft: true }`
     (extend the `Out` ok type with optional `draft?: true`). Live series: unchanged.
   - `TicketSheetProps` gets `seriesLive: boolean` (required); pass it into `writeTicket`.
   - When the save returns `draft: true` and `flags.waysInRebuild` is on, the success message the sheet/host shows is
     `Goes on sale when you put the event live.` (put the string in `src/modules/organiser/p3/v2/copy.ts`, HTML entities rule
     does not apply to TS strings, but no curly quotes). Flag off: same behaviour as a normal save (no new copy).
   - Never lose typed values on any error (existing behaviour; keep it).
2. `src/modules/organiser/p3/v2/TicketsV2.tsx`: pass `seriesLive={s.lifecycle_status === 'live'}` to `<TicketSheetV2>` (line ~506)
   and to the guide save deps. After a draft save, the list refresh shows the row with its draft status (check `:200` filter
   keeps `draft` rows; only `closed` is filtered).
3. `src/modules/organiser/p3/v2/useWaysInGuideSave.ts`: pass `seriesLive: d.ws.series.lifecycle_status === 'live'` into
   `writeTicket` (line ~50). A draft result is success, not an error.
4. `src/modules/organiser/shared/goLiveKeys.ts`: add blocker `ticket_payouts: { label: 'Set up payouts for your paid tickets',
   section: 'payment' }` to `GO_LIVE_BLOCKERS` (admin#2519 already returns this code in prod; today it shows
   "Something else on the event"). Follow the existing entries' shape (read the `BlockerDef` interface; add a fix link only if
   other `payment` entries have one).
5. Tests (one new file `src/modules/organiser/p3/v2/__tests__/draftTicketSave.test.tsx`, plus update existing render calls
   that now need the `seriesLive` prop: `earlyBirdV2.test.tsx`, `slice17d.test.tsx`, `soldPrice*.test.tsx`, wiring tests):
   - writeTicket on seriesLive=false new ticket: upsert called once, setTicketStatus NEVER called, result ok+draft.
   - seriesLive=true new ticket: setTicketStatus('on_sale') called (unchanged).
   - existing ticket edit on a draft series: no status call (unchanged).
   - guide save on a draft series: success, no `closed` call, no error in guideErr.
   - goLiveLabel('ticket_payouts') returns the new label, not UNKNOWN_ITEM_LABEL.
   - Run the new writeTicket test against the UNFIXED code first and note that it failed (bug-fix rule).

Do NOT touch: TypeSheet.tsx, TicketsEntry.tsx, R4Tickets.tsx, DraftTicketsCard.tsx (old screens: Add is already disabled on
non-live; leave their copy). Do not touch admin repo. No new feature flag.

## Done when
- `npm run test:unit` for touched dirs green, `npm run lint` chain links green, `npx tsc --noEmit` clean.
- PR body from the template with "Verified on real data" block (shape: prod has draft series with 0 tickets; say honestly that
  draft-create cannot be exercised until the admin widen) and an honest "Not verified".
- Handover `docs/handovers/draft-ticket-save-website.md`: head sha, tests run, Not verified.
Never merge. Never touch prod.
