# Queue: what is left in (A) the P3 organiser area and (B) Website ticketing, 2026-11-04

Read-only scoping. No source edited, no migration, no prod write. Base: `main` @ `a7af397`.
Brief: `brief/scope-queue-1` (`docs/briefs/scope-queue-1.md`). Prod reads: SELECT on catalog and counts only,
project `stsdtacfauprzrdebmzg`. Open PRs read with the GitHub MCP (list), 2026-11-04.

**The 2026-10-30 audit (`claude/audit-organiser-remaining`, PR #1201) is stale.** Its headline gaps are closed on
main; its slice list must not be used. What it claimed vs main today:

| 10-30 claim | On main today | Evidence |
|---|---|---|
| P3 cannot create an event | Built: `create` route, kind > page > form | `p3/shell/P3Routes.tsx:91`, `p3/new/CreateFlow.tsx`, `P3_PATHS.create` `p3/shell/paths.ts:61` (#1208) |
| You > Account / Help open R1, no way back | Built inside P3 | `P3Routes.tsx:106-107`, `paths.ts:76-77` (#1202) |
| Co-organisers only in R1 | Mounted in P3 | `P3Routes.tsx:90`; gate sheet via `events/SeriesOrganisers.tsx:44-47` (#1250) |
| Page holders land in R1 | Every first-load door reads P3 while live; R1 URLs redirect except `?legacy=1` until 8 Dec | `lib/accountRouting.ts:31-50` (`ORGANISER_AREA_HOME_PATH`), `lib/organiserAreaHome.ts:1-40`, `claimSignInLanding.tsx:20`, `PublicClaimCard.tsx:217`, `JoinScreens.tsx:169-172` (#1237, #1249) |
| A1 gate screen missing | Built: `GateHost`, `GateSheet`, `gate.ts`; refusal opens it for tickets, Repeat, New event, Organisers; returns to the refused event | `p3/onboarding/GateSheet.tsx`, `gate.ts:69,93`, `returnTo.ts` (#1250, #1291, #1304, #1306, #1313) |
| Going W4c unmounted | Mounted: Home hero, date sheet, Stats, via `get_my_series_going_v1` | `p3/screens/P3Going.tsx`, `DateSheet.tsx:26` (#1206); RPC present on prod |
| Old `/account/tickets` screens | Retired to a redirect | `AnimatedRoutes.tsx:273`, `organiser/tickets/LegacyTicketsRedirect.tsx` |
| Home/Events/Stats mix pages (F-26) | Chosen page shown and named | `p3/data/home.ts:131`, `stats.ts:120` (#1307, #1315) |
| Tap targets under 44px (D4) | Fixed | `p3/theme/p3.css:182` (#p3-prefix-d) |

## Prod facts that change the picture (SELECT only, 2026-11-04)

- **`organiser_onboarding_gate` is ENABLED** (`updated_at` 2026-11-02 08:01 UTC). The 10-30 audit and the 10-31
  FLIP-READINESS both read it as false. With it on, every non-admin organiser write needs a completed onboarding
  (`organiser_onboarding_progress`: 2 rows). FIXLIST F-07 (no grace; blocks cancelling tonight's date) is therefore
  LIVE for whoever can reach a write, not a future risk. P3 and the old area are both off on prod, but R1 writes hit the same server guard.
- `my_tickets_v1()` is on prod (authenticated only, returns `{tickets[], truncated, total_count}` with `qr_token`).
  `ticket_check_in_by_code_v1`, `ticket_check_in_by_id_v1`, `ticket_door_list_v1` are present. The Website has NO screen
  that calls `my_tickets_v1` (grep of `src/`: none).
- `ticket_promo_*` RPCs are still absent (the 10-29 blocker stands).
- Ticket tables: 2 `ticket_types`, 6 `ticket_orders`.

## Flags (all baked at build time from Vercel env; prod value of each NOT verifiable here)

`organiserP3`, `organiserSelfServe`, `organiserTicketing`, `publicTicketing` (`src/lib/featureFlags.ts:59-75`),
`ticketDoorCode` (`p3/door/doorFlags.ts`, `VITE_ENABLE_TICKET_DOOR_CODE`). Per the brief: organiserP3 and ticketing are OFF on prod.

## Open PRs that could overlap (2026-11-04)

#1328 (failed-read checklist heading; touches `p3/onboarding`), #1326 (automerge script), #1329 (walk helper),
#1308 and #1303 (walk specs), #1275 (live-now handover). Old docs PRs (#1201 stale audit, #973-#1067, #1226 deps) are unrelated.
None touches the files in Q1 to Q3 below. #1328 touches onboarding headings: keep clear of `OnboardingFlow.tsx`.

## Queue (ranked). Serves = brief queue (A) P3 organiser, (B) ticketing Website side.

Migration column: "none" = Website only. Anything needing the admin repo is BLOCKED here.

| # | Item | Serves | Files (main) | Migration | Flags | State |
|---|---|---|---|---|---|---|
| Q1 | **My tickets screen**: the buyer sees their paid tickets with a QR to show at the door (`my_tickets_v1`) | B (my tickets, follow-up T1 on-page) | new `src/modules/tickets/MyTicketsPage.tsx` + model + api; route beside `AnimatedRoutes.tsx:225`; `catchallClientPaths.ts:37-51`; `siteIa.ts:81` | none (RPC live) | `publicTicketing` | READY. Brief 1 |
| Q2 | **Team-visibility save does not refresh public caches** (F-33 gap named in FLIP-READINESS) | A | `organiser/team/publicTeamApi.ts:36-41`, `team/PublicToggle.tsx`, `shared/publicCache.ts:10-23` | none | none | READY, small. Brief 2. Confirm first which public query shows the team |
| Q3 | **"Your tickets" way in**: link from the thank-you page and the dancer home to Q1; thank-you "failed" state still links home | B (S4, my tickets) | `tickets/TicketThanksPage.tsx`, `ticketCheckoutModel.ts` (`thanksCopy`), `components/account/DancerHome.tsx` | none for the link; event link in failed state needs an admin change (T8) | `publicTicketing` | After Q1 merges (same new route). Brief 3 covers the link only |
| Q4 | Ticketing real-phone walk: door camera (#1311 sets `camera=(self)`, #1317 permission steps, #1325), checkout, short door code (#1294) | B (door, S3/S4) | none (a walk) | none | needs `TICKET_PREVIEW_ORIGIN` secret + 3 flags on a preview | NEEDS OWNER (secret, phone). Not a worker brief |
| Q5 | Ticket email QR (T1) and thank-you QR | B | admin `ticket-email`; Website thank-you needs a safe read (`ticket_order_public_status_v1` must not return tokens) | admin (edge fn / read) | `publicTicketing` | BLOCKED (admin). Q1 gives buyers a QR once signed in |
| Q6 | Ticket promo codes (organiser section, buyer field, `?code=`) | B | handover `docs/handovers/ticket-promo-codes-web.md` | admin #1125 not applied | `organiserTicketing`, `publicTicketing` | BLOCKED: 4 RPCs absent on prod |
| Q7 | Thank-you "failed" state links to the event (T8) | B | `TicketThanksPage.tsx`, admin RPC adds event id | admin | `publicTicketing` | BLOCKED |
| Q8 | Server hardening T9 (cancel closes pending order, idempotency key, series-wide date) | B | admin `ticket-checkout` | admin | n/a | BLOCKED |
| Q9 | Gate grace / owner decisions (F-07, F-08, F-09, F-13...) | A | `graceModel.ts:48`, server `_require_onboarding_complete_v1` | admin | gate ON on prod | OWNER CHOICES 1 to 3 |
| Q10 | "This date only / all dates" (R1 rule), moving a date with guests | A | `DetailsScreen.tsx:275`, `PricesScreen.tsx:91`, `p3/model/repeat.ts`, `DateSheet.tsx` | admin for the move guard | organiserP3 | OWNER CHOICES 4, 5 |
| Q11 | PEOPLE-JOIN and TEAM-RIGHTS rows F-35..F-60 | A | mostly admin repo | admin | | BLOCKED / owner decisions (not re-verified here; see FLIP-READINESS 10-31) |

Items verified closed, so no work: F-01..F-05, F-08 copy, F-10, F-11 (guard config now lists both ticket doors as gated,
`scripts/onboarding-write-doors.json:2`), F-12 mitigated, F-13 (#1306), F-15 (cover now uploaded after the create,
`p3/new/useCreateSave.ts:147-160`), F-16..F-19, F-22, F-24..F-27, F-33, F-34, F-46 (declined-request card,
`OnboardingFlow.tsx:644`), D4 tap targets, T2, T3 (#1294), T6.

Not re-verified (read from earlier docs, not main): F-06 (profile-wizard link inside Details/Prices; `PROFILE_WIZARD_PATH`
is still used by `events/lifecycleModel.ts:91` and `ProfileLock.tsx`), F-20, F-21, F-23, F-28, F-29, F-37, F-41, F-47..F-60.

## Owner choices (not briefed)

1. **Gate is ON in prod and has no grace (F-07).** Choose: (a) keep it on; cancelling or moving a date in the next 7 days stays allowed (needs an admin guard change); (b) keep it on and accept a hard stop on every change until onboarding is done; (c) switch it off until a grace date exists (`admin_set_feature_flag_v1`, owner/orchestrator only).
2. **Grace length and banner end date (F-08).** (a) 14 days, shown; (b) 30 days, shown; (c) no end date shown.
3. **After the details sheet (F-09).** Main now returns to the refused event with the held typing kept for some sheets (#1304/#1313); say whether the change itself should be redone for them: (a) redo automatically, (b) Try again button.
4. **Several dates, one edit (F-28, owner rule R1).** Cover/venue/price change applies to all dates. Choose: (a) ask "this date only / all dates" and overwrite hand-edited dates, (b) ask and keep hand-edited dates, (c) keep today's one save and add a plain warning.
5. **Moving a date that has guests (F-29; 3 future dates carry guest-list entries per the 10-31 read).** (a) cannot be moved, (b) warn, then move and tell them, (c) warn, move, tell nobody.
6. **Manager rights (F-20, F-52, F-58).** (a) managers edit details, prices and the page, contact read-only; (b) managers full edit; (c) view only.
7. **Undo of Put it live (F-21) and a cancelled one-off's tag (F-23).** Undo: (a) Hide it, (b) none. Tag: (a) Cancelled, (b) Finished.
8. **Ticketing go-live order.** (a) walk on a preview first (needs `TICKET_PREVIEW_ORIGIN`, fee secret = 0 confirmed), then flip `publicTicketing`, then `organiserTicketing`; (b) flip `publicTicketing` alone; (c) hold until promo codes land.
9. **QR for buyers.** (a) My tickets page only (Q1), (b) plus email QR (admin), (c) plus thank-you QR (needs a new safe read).

## Verified / Not verified

Verified: every file:line above read on main `a7af397`; prod RPC presence, `my_tickets_v1` body, gate flag, row counts (SELECT).
Not verified: Vercel flag values and edge-function secrets (no access); any browser behaviour (no walk); F-06/F-20/F-21/F-23/F-28/F-29/F-37..F-60 against main; the admin repo.
