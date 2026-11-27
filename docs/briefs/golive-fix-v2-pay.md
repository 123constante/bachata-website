Branch: claude/golive-fix-v2-pay
Size: 5 files, 360 lines
Brief-version: 2

## What main lacks
- Organiser editor v2 (`src/modules/organiser/p3/v2/`) blocks "Put it live" with "Say how dancers pay" (go-live code `no_payment`, server `_series_go_live_check_p5` reads only `event_series_p5.payment_methods`) but v2 has NO control that writes `payment_methods`. The Tickets pay modes (door / link / sell here) never write it. Real draft stuck on this today. -- grep: HowToPaySheet
- The greyed "Put it live" reason line in `GoLiveBar.tsx` is plain text: tapping it does nothing, so no blocker is fixable from where it is shown. -- grep: GO_LIVE_V2_FIX

## Files
- src/modules/organiser/p3/v2/goLiveFixV2.ts (new)
- src/modules/organiser/p3/v2/HowToPaySheet.tsx (new)
- src/modules/organiser/p3/v2/GoLiveBar.tsx
- src/modules/organiser/shared/runCommands.ts
- src/modules/organiser/p3/v2/__tests__/goLiveFixV2.test.tsx (new)

## Goal
Rule-to-fix contract, slice A. Every go-live code has a named v2 fix; tapping the blocker line on a draft opens that fix; How to pay is fixable inside v2 (series-wide, every night, as stored today in `event_series_p5.payment_methods`; no per-night).

## Behind a flag
`VITE_ENABLE_GOLIVE_FIX`: ON unless the env value is exactly the string `'false'` (`import.meta.env.VITE_ENABLE_GOLIVE_FIX !== 'false'`, exported from `goLiveFixV2.ts` as `goLiveFixOn()`). Flag off = today's `GoLiveBar` byte-for-byte (reason as plain `<p>`).

## Checklist (every item is built; tests cover each)
1. `goLiveFixV2.ts`: `export type V2FixTarget = 'pay' | 'where' | 'dates' | 'prog' | 'flyer' | 'about' | 'name' | 'orgs' | 'tickets'`. `export const GO_LIVE_V2_FIX: Readonly<Record<string, V2FixTarget>>` keyed by SECTION (from `GO_LIVE_SECTIONS` in `src/modules/organiser/shared/goLiveKeys.ts`): venue->where, basics->name, about->about, tickets->tickets, dates->dates, programme->prog, cover->flyer, organisers->orgs, payment->pay. `export const v2FixFor = (code: string): V2FixTarget | null` = target of `GO_LIVE_BLOCKERS[code].section`, null for an unknown code. Plus `goLiveFixOn()`.
2. `HowToPaySheet.tsx`: uses `V2Sheet` (same shell as `PaySheets.tsx` `LinkSheet`: `.grp`, `.flab`, `.btn pri`, `.err`). Title **How dancers pay**. Help line = `PAYMENT_HELP` or `FESTIVAL_PAYMENT_HELP` (from `src/modules/organiser/events/paymentModel.ts`, choose as `PaymentEdit.tsx` does). One toggle button per `paymentChoices(ws)` with `PAYMENT_LABEL` words, `aria-pressed`, 44px+ tall, wraps at 390px. Preselected from `parsePayment(ws.series.payment_methods)`; tap toggles via `togglePayment`. Line under the chips: **Every night of this event.** (one-off: omit the line; one-off = `ws.series` is not weekly, use the same test `EditorV2.tsx` uses for `weekly`). Primary button **Save** (reads **Saving…** while busy): `paymentCommand(ws, picked)`; null (nothing changed) closes, sends nothing; else send through the `send` the bar already uses (`toast.run(commands, version)`), close on success, keep open with **Not saved. Try again.** in `.err` on failure. Nothing picked + Save = error **Pick at least one.** and nothing sent. Testids: `howpay-sheet`, `howpay-chip`, `howpay-save`, `howpay-err`.
3. `GoLiveBar.tsx`, flag on: the reason line becomes a `<button type="button" data-testid="golive-fix">` with the same words plus a trailing ` ›`, underlined-on-focus, 44px tap height, left aligned, same 13px look. Only when `check.data` exists and the first blocker (`eventBlockers(check.data.eventMissing)[0]`) has a `v2FixFor` target. "Checking…", "Could not check…" and the profile-only line stay plain text. Tap:
   - target `pay`: open `HowToPaySheet` inside the bar (state in `GoLiveBar`).
   - any other target: call new optional prop `onFix?: (target: V2FixTarget) => void`; when the prop is absent, `navigate(goLiveFixHref(section, ws.series.id))` (react-router `useNavigate`; `goLiveFixHref` from `src/modules/organiser/shared/goLiveCheck.ts`) so a tap is never a dead end. Do NOT edit `EveryBody.tsx`, `OneOffBody.tsx`, `EditorV2.tsx` (slice B wires `onFix`).
   - "Put it live" button, `StatusSheet`, `DraftNote`, sticky position, exports `DRAFT_PILL`, `DRAFT_NOTE`, `COVER_REASON`, `PUT_LIVE`, `firstGoLiveReason`, `isDraftEvent`: unchanged.
4. `runCommands.ts` `useReload`: also `invalidateQueries({ queryKey: goLiveCheckQueryKey(seriesId) })` so a fix re-checks and "Put it live" un-greys without a reload. If importing `goLiveCheck.ts` makes an import cycle, use the literal `['series-go-live-check', seriesId]` with a comment naming `goLiveCheckQueryKey`.
5. Test `goLiveFixV2.test.tsx` (vitest + testing-library, house style of `__tests__/draftGoLive.test.tsx`):
   - CONTRACT: `it.each(Object.keys(GO_LIVE_BLOCKERS))` every code has a non-null `v2FixFor`; `it.each(GO_LIVE_SECTIONS)` every section is a key of `GO_LIVE_V2_FIX`. (An unmapped key = red.)
   - no_payment first: tap `golive-fix` opens `howpay-sheet`; pick Cash, Save sends ONE series upsert whose payload has `payment_methods: 'cash'` and `name`; untouched Save sends nothing; empty pick shows **Pick at least one.**; festival shows only Ticket link.
   - venue first, no `onFix`: tap navigates to `goLiveFixHref('venue', id)`; with `onFix` given: called with `'where'`, no navigation.
   - flag `'false'`: reason is plain text, no `golive-fix`.
   - after a successful command the go-live check query is invalidated (spy on `invalidateQueries`).
   - existing `__tests__/draftGoLive.test.tsx` and `__tests__/nightTabGoLive.test.tsx` stay green unchanged.

## Keep-list (live screen, must not change)
Draft pill, draft note, sticky white bar with top border, "Put it live" greyed until ready, first-reason wording incl. cover reason, StatusSheet on tap when ready, toast, bottom tab bar offset.

## Out of scope (list in the PR, never change)
Wiring `onFix` into the editor bodies (slice B). Tickets pay modes writing `payment_methods`. Admin repo. DB. Anything else noticed.

## Done
One PR on the branch above, bot author, PR body with a tap table (button | destination): golive-fix (no_payment) | How dancers pay sheet; golive-fix (venue, no onFix) | old fix screen; howpay chip | toggles; howpay-save | saves + closes; Put it live (ready) | StatusSheet. `npx tsc --noEmit` and the new + named existing tests green. Do not merge.
