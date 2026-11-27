# Handover: draft-ticket-save-website (dt_715819e82856)

PR: #2506 (branch `claude/draft-ticket-save-website`, base main). Code head: 68661cd. This doc is committed on top of it.

## Done
- `writeTicket` now takes `seriesLive`. On a draft series, a NEW ticket skips `setTicketStatus(id, 'on_sale')` and returns `draft: true`. Live series are unchanged. Editing an existing ticket is unchanged.
- `TicketSheetV2` has a required `seriesLive` prop. `TicketsV2` passes `s.lifecycle_status === 'live'`. The guide (`useWaysInGuideSave`) reads `ws.series.lifecycle_status`.
- Success line: `savedLine(out)` gives `V2.ticketSheet.savedDraft` ("Goes on sale when you put the event live.") when the save was a draft and `waysInRebuild` is on. Otherwise it gives "Saved".
- Tests: new `p3/v2/__tests__/draftTicketSave.test.tsx` (8 tests). On the UNFIXED code, 5 of them failed, including the draft writeTicket case. Fixtures in slice17d, earlyBirdV2, soldPriceReplace, soldPriceRevert, ticketSheet and waysInRebuildWiring now pass `seriesLive` / `lifecycle_status: 'live'`.

## Left / needs owner
- Brief step 4 (`ticket_payouts` label in `goLiveKeys.ts`) is NOT done. `shared/__tests__/goLiveRulesContract.test.ts` requires every website code to exist in `shared/event-rules.json`, which mirrors the admin `lib/event-rules.json` byte for byte and must not be edited here. Next steps:
  1. Admin: add `ticket_payouts` (section `payment`) to the rule list.
  2. Website: mirror the file, add the blocker, and extend `goLive.webA1a.test.tsx` (code list plus the `^(Add|...)` label regex, which needs `Set up`).
- Undo of a draft save closes the row (`closed`). That this is allowed on a non-live series is unproven until the admin widen lands.

## Checks
- `vitest run src/modules/organiser`: 457 files, 15232 tests, all passed.
- tsc run on 68661cd: 0 errors in branch files (0 errors overall).
- `npm run check:mojibake`: clean.
- `npm run lint`: 32 of 36 links passed. The 4 red links (onboarding-write-doors, no-social-word, lint:architecture, rpc-typing) are red on main too, and none of their violations names a branch file.
- Both PR-body checkers (real-data, phone-qa) exit 0.

## Not verified
- Draft create end to end: it is blocked until the admin widen of `ticket_type_upsert_v1`.
- Browser walk at 390x844: not done. There is no layout change, and the draft path cannot be reached in prod yet.
- Vercel preview URL: the Vercel API is blocked by the sandbox proxy. The URL is in the PR's Vercel check.
- PR CI jobs: not watched to green from here.
- `/code-review` skill: not run. A self-review of the diff was done instead and found one gap (the retry after an early-bird refusal lost the draft line), which is fixed.
