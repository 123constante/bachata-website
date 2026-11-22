# Editor v2 slice 12a handover (Tickets screen, read side, payMode)

Files: `p3/v2/payMode.ts` (pure `payModeOf`, `doorPriceOf`), `p3/v2/TicketsV2.tsx` (`TicketsView` pure screen, `TicketsV2` route element, `ticketLine`), route `events/:seriesId/tickets` in `p3/shell/P3Routes.tsx` (flag organiserEditorV2), v2.css additions, `__tests__/payMode.test.ts`. Reads use the existing hooks (`useStripe`, `useSeriesTypes`, `useSummary`, `useManagedTypes`). Early-bird line comes from `useManagedTypes` steps. Per-date "<sold> of <qty>": the tickets read has no per-date sales, so a type tied to one date (occurrenceId) shows its sold count on that date, all others 0.

| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 87 | ← <event name> | Tickets screen top | first screen (prototype) |
| 22 | Price … Change › (Every card) | Tickets screen | NOT wired: Fact onOpen needs useNavigate in EveryBody/NightCard, which would break their router-less tests; not a one-line prop pass. Open: `/app/events/:id/tickets` |
| 27 | Tickets row (one-off) | Tickets screen | NOT wired, same reason |
| 93-101, Sell tickets here without Stripe, ticket cards, Add a ticket | rendered, testids `tk-*` present, `on` handlers undefined | pending 12b/13 (not OLD pages) |

`stripeWarn` prop (T-06) is set by 12b; tested via the prop.

Verified: vitest payMode.test.ts 23 pass; p3/v2 folder 20 files 265 pass; tsc -p tsconfig.app.json: 0 errors in branch files; check:mojibake clean.
Not verified: 390x844 walk, prod data-shape survey, pre-ship, /code-review, real Stripe-connected account. No PR (per brief).
