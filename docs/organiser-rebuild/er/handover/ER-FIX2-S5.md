# ER-FIX2-S5 handover: C8 event page (fix pass)

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/ER-FIX-W2.md` (sha `a2e612d`), section S5.
Audit: `claude/audit-er-event-page:docs/organiser-rebuild/er/audit/ER-AUDIT-event-page.md`.
Ticket `dt_1d9dea2a9d35`. Branch `claude/er-c8-eventpage`.

## Merges (in order)
1. `origin/main` (fe77e93): conflicts in Ember UI (`ui/Chip.tsx`, `ui/DateChip.tsx`, `ui/ember.css`, `__tests__/ember.test.tsx`) resolved to main's side; `events/OneEvent.tsx` (main's C14 lock + C8's RebuiltEvent kept; `DatesTakenOff` stays removed, rule 9) and `__tests__/parity-matrix.test.ts` combined.
2. S1 `79459ca5`, S2 `48eafa56`, S3 `4e6d5a65`, S6 `a907be0d`: clean. S4 `2e7fb9bb`: one conflict, the `focusReturn` SheetView call-site list (both new files kept).
3. Post-merge fixes: the page fed S1's `RuleSeries` without `status`, `flyer`, `ticketUrl` (a complete draft read "Add how to pay"); route test needed the C14 lock mocked; main's C14 Details test listed the time row C8 removed; parity counts (match 42, partial 9, admin-only 8, dropped 12).

## Findings
| id | outcome | what changed | red-first |
|---|---|---|---|
| EP-1 | fixed | `pageActions(status, format, repeats)`: no owner argument, same actions for everyone; Resume for everyone; `useSeriesRole` no longer read by the page. The two tests pinning the owner gate are rewritten (`er-c8.model` "same actions for everyone", `er-c8.page` "a co-organiser gets the same actions") | model table red (5 rows); page: paused row red (live/draft rows were already green on the page because the model change landed first) |
| EP-2 | fixed | `RebuiltEvent` keys `EventPage` on `series.id`; `rebaseDraft(oldBase, newBase, draft)` keeps every changed field/part and takes the new read for the rest, so a half-failed save keeps the error, Try again and the unsaved part, and the landed part stops being pending | model 3 red; page 2 red with the version key, green with the id key (checked by swapping the key back) |
| EP-3 | fixed | "Ticket link" chosen shows a Ticket link row (opens the existing `EditorSheet` `ticket`); Update and the leave sheet's Update are off with "Add the ticket link" (`ticketGap`, the S1 `blockerVariants.ticketUrl` words); the draft checklist's pay row reads the same variant | model 4, page 1 red |
| EP-4 | fixed (default parked) | "Organisers" row in Details for everyone (open and closed events) linking to `/events/:id/organisers` (S4's `OrganisersRoute` picks the rebuilt screen per event). Not drawn inline | page 2 red |
| EP-5 | fixed | `shared/useLeaveBlocker.ts` (moved out of `edit-in-place/EditInPlaceLayer.tsx`, which now imports it; same getBlocker/deleteBlocker build that keeps `useBlocker` out of the shared chunk). Any pathname change with pending changes opens "Update before you leave?"; Update saves then carries on, Discard carries on, Keep editing stays. The page's own navigations (Done after a save) pass | page 2 red (date row, Add a date) |
| EP-6 | fixed | `payment_methods` in `OWNER_UPSERT_KEYS` (so in the create keys). Prod read 2026-10-23: `apply_aggregate_write_p5.v_owner_upsert_keys` ends with `payment_methods`; the server mirror (`seriesCommands.test`) and prod snapshot (`parity-matrix`) updated to match | model 1 red |
| EP-7 | fixed | Pause / End / Resume are on the page (no `?do=` link): Pause and End are confirm sheets through `sendOne` (pending changes saved first), End says "Coming dates come off the calendar. Past dates stay." and asks "Tonight runs / Tonight is off" when a date is today, then `series.end_run`; Resume sends `set_lifecycle live`. One-off: "Cancel the event", visible, `aria-disabled`, reason "Not available yet", sends nothing | model 4, page 5 red |
| EP-8 | fixed | Stop repeating lists every coming date (prod: 31 live recurring events have more than 8, max 58) | page 1 red |
| EP-9 | fixed | status tag is `lifecycleTag(status)` (one copy of the words; `pending_review` "In review", `rejected` "Changes needed"); drawn as a span with the same tone classes because the R1 rule (D22) bans `StatusTag` under events | page 2 red |
| EP-10 | fixed | live, no coming date: ONE Add a date (in the card) plus End / Cancel the event beside it | page 1 red |
| EP-11 | fixed (comment) | always offered, the comment now says so; parked | n/a |
| EP-12 | parked | needs a browser walk; not done | n/a |
| EP-13 | fixed | `draftChecklist(ws, today, tree, serverCodes?)`: the go-live check's codes can only ADD to the client rows (union); a code with no row gets its own in plain words (`goLiveLabel`, e.g. "Write a description"); no answer = client rule alone | model 8, page 1 red |
| EP-14 | noted | the out-of-card test edits are removals of tests for things C8 removed; say so in the PR body | n/a |
| switch | fixed | `OneEvent` reads `useRebuildSwitch(ws.data?.organiserIds ?? null)`: the rebuilt page is chosen PER EVENT (decision 2), not per login | page 4 red |
| F-C5-5 | fixed | `placeLine({area, postcode})` is the ONE sheet line and the stored address: `lookupPostcode` returns it, `createVenueDraft` sends it (also for a place read before the fix), the picker shows it. The old test pinning "ward, district" rewritten | 5 red |
| no untimed NEW session | fixed | `blockingIssues`: a new session with no times blocks Done ("Pick a start time"); stored untimed sessions stay valid (renamed or untouched); a stored timed session may still go back to "No set time" | 1 red (the 4 control rows green) |
| --danger contrast | verified | `--danger` #ff7a6b: 6.26 on bg, 5.43 on card, 4.70 on card2 and sheet; `--btnfg` on a danger fill 7.52. Pinned in `emberContrast.test.ts` | n/a (measurement) |

Red-first record: the two new files (`er-c8.fix2.model.test.ts`, `er-c8.fix2.page.test.tsx`) were run in a worktree at the post-merge commit (`1e18124`, before any fix): **49 failed / 9 passed**; the 9 green are controls (ended row, "nothing pending: a link just goes", "no ticket link chosen", live/paused/draft/ended tag words, client-only checklist rows). I disagreed with no finding.

## Owner clicks honoured
- EP-7 one-off "Cancel the event" stays OFF with "Not available yet" and never sends `occurrence.cancel`. **But**: prod already holds migration `20261204180000 er_ad4_cancel_one_off_command_v1` and `_cmd_series_cancel_one_off_p5` (read-only check, 2026-10-23). Parked for the owner to confirm before the follow-up wires it.
- F-C5-5 and "no untimed NEW sessions" as above.

## Shapes (prod, read-only SELECT, 2026-10-23, counts only)
- `event_series_p5` 747: live 68 (course 6, festival 7, one_off 11, recurring 44), paused 2 (one_off 1, recurring 1), draft 3 (one_off 1, recurring 2), ended 21 (course 8, recurring 13), archived 653. This agrees with the C8 handover (live 67 then; one more one-off since); ER-COMMON's "draft 1 / archived 82" is stale.
- No `pending_review` / `rejected` series exist (EP-9 covers them anyway).
- `payment_methods` is empty on EVERY series; live with no way to pay at all (no code, no ticket URL): 17 (course 4, one_off 4, recurring 9). No series has `ticket_link` without a URL yet.
- Live with no coming date: 20 (one_off 9, recurring 7, course 2, festival 2; the card is not drawn for festivals). Live recurring with more than 8 coming: 31 (max 58); none over 100.
- Organiser links (from S4): 571 none, 170 one, 6 two; the page draws the same actions for all of them.
- Covered by tests: every status x the main formats, draft checklist with and without a server answer, one-off with one date, live with no coming date, 20 coming dates, ticket link with/without URL, refetch mid-edit, half-failed save, per-event switch (owner page / co page / `*` / unset).
- Not covered: a festival page beyond the common blocks (C10's), a date today on End (logic reused from EndStep, untested on this page), 58-date stop list in a browser.

## CI per job (sandbox)
See the table appended below by the run.

## Verified
- Red-first for every fixed finding (above), green after; organiser suite and every CI step run here (table).
- Server facts read on prod (SELECT only): owner upsert keys, cancel-one-off migration, shape counts.

## Not verified
- Browser walk at 390x844 (EP-12 Edit bar width, the new sheets): not done; needs a signed-in organiser on an allowlisted event.
- Any real server round trip (no writes allowed): Pause / End / Resume / Stop / ticket link save.
- The C14 profile lock on the rebuilt page (parked).
- Vercel preview: not opened.

## Next
- Follow-up: wire the one-off "Cancel the event" to `series.cancel_one_off` (with a reason) once the owner confirms the AD4 apply.
- S4 screen's Back goes to the old Details path; point it at the event page when the switch is `*`.
