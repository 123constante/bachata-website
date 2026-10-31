# AUDIT-gate: P3 onboarding gate and the gate-group journeys (no browser)

Brief: `brief/p3-audit-journeys` `docs/briefs/p3-audit-journeys.md`. Group: **gate** (J-c7, J-d1, J-d2, J-d3, J-d8, J-d9, J-x1, J-x2-gate-side, J-e8).
Code: origin/main @472ecde, plus `claude/p3-create-event-build` for New event. Contract: `claude/p3-acceptance-contract-3`.
Method: code traced to the RPC, live RPC bodies read via `pg_get_functiondef`, prod SELECT counts only (no personal data, no writes). Date 2026-10-30.

## Answer to the brief's question (flag ON, organiser with live events and an unfinished page)

- Prod today: flag `organiser_onboarding_gate` is **OFF**; `organiser_onboarding_progress` has **0 rows**, so 0 of 48 claimed pages would pass. Turning the flag on would refuse event writes for 11 non-admin people on 4 pages with 7 live upcoming series.
- There is **no server-side grace period**: one global flag. Flag ON = every gated write refused at once, including cancelling tonight's date (A-gate-1, blocker). The Home banner still says "Until then everything works as usual" regardless of `gate_on` (`src/modules/organiser/p3/screens/GraceBanner.tsx:67`; A-gate-2).
- 42 write doors found (39 main, 3 build branch); of 38 event-content doors: 29 gated server side (2 conditionally), 24 route the refusal to the "A few details first" sheet, 1 own card with working link, 3 fixed error line without a link, 3 wrong generic "Try again" error, 0 silent, 2 CANNOT-TELL (edge functions). Full table in Part 1 section 2.
- No read or page open is refused.
- The refused write is not retried after the sheet is finished (J-e8 step 3 FAIL; A-gate-5).

## Totals

| journey | pass | fail | cannot-tell |
|---|---|---|---|
| J-c7 (steps 1-3) | 2 | 1 | 0 |
| J-e8 (steps 1-5) | 1 | 2 | 2 |
| J-d1 | 1 | 3 | 0 |
| J-d2 | 2 | 1 | 1 |
| J-d3 | 3 | 0 | 0 |
| J-d8 | 2 | 2 | 0 |
| J-d9 | 3 | 3 | 0 |
| J-x1 | 0 | 2 | 0 |

J-c7/J-e8 rows are the lead's roll-up (J-c7: 1 PASS sheet opens on Put it live, rows 1-24; 2 FAIL no return to the refused write, A-gate-5; 3 PASS route change closes, A-gate-9. J-e8: 1 FAIL banner never states grace and its copy is false when ON, A-gate-1/2; 2 CANNOT-TELL whether the sheet asks only what is missing, prefilled; 3 FAIL, A-gate-5; 4 PASS no read refused, live events stay public, write refused with the sheet; 5 CANNOT-TELL Facebook-link R3 interplay not traced, walk must check) of Part 1 findings (A-gate-1/2/3/5/6/9); the other rows are per-step verdicts in Part 2. J-x2 public-page steps belong to the `public` group; the gate side of J-x2 (live events stay public with the gate on: no read refused) is covered in Part 1.

**Browser walks the lead must do** (flag ON on a branch DB or test account, never prod): see Part 1 section 5 and the CANNOT-TELL lists in Part 2. Minimum set: (1) J-e8 end to end incl. step 2 prefill and step 5 legacy Facebook link, with flag ON incl. Back and tab bar closing the sheet; (2) ticket create / on sale refusal copy; (3) refund + Stripe connect (edge functions) with gate on; (4) J-d2 step 2 with p3GoingOn on; (5) J-x1 approval email link target.

---

# Part 1: write doors (A-gate-1..n)


Read-only audit, 2026-10-30. Website `origin/main` @472ecde, plus `origin/claude/p3-create-event-build` @27665c5 (New event).
Live RPC bodies read with `pg_get_functiondef` on prod `stsdtacfauprzrdebmzg` (SELECT only; counts only).

## 0. How the gate works (live bodies)

**`_require_onboarding_complete_v1(p_organiser_ids uuid[])`** (STABLE, SECURITY DEFINER):

```
IF NOT public.is_feature_enabled('organiser_onboarding_gate') THEN RETURN; END IF;   -- flag OFF = no-op
v_uid := auth.uid();  IF v_uid IS NULL THEN ... 'authentication_required' (anon/authenticated) / RETURN (service)
IF public.is_admin() THEN RETURN; END IF;                                            -- admin_users row
v_mine := public.get_current_user_organiser_ids();
FOR o IN <targets that the caller is a member of (v_mine or entity_members row), in target order> LOOP
  v_m := public._onboarding_missing_v1(v_uid, o);
  IF cardinality(v_m) = 0 THEN RETURN; END IF;        -- "Acting for any one finished organiser is enough"
  first missing page -> v_org / v_first
END LOOP;
IF v_org IS NULL THEN RETURN; END IF;                 -- member of none of the targets: door's own check answers
RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='onboarding_incomplete',
  DETAIL = {"missing":[...], "organiser_id": v_org}, HINT='Finish your details';
```

- **What makes it pass:** flag off; or caller is admin; or caller is not a member of any target page; or, for ANY ONE target page the caller is a member of, `_onboarding_missing_v1(caller, page)` is empty.
- **`_onboarding_missing_v1`** is computed from data, never stored: dancer profile (first_name, city, dance_role, photo, nationality, languages, instagram), `teach_answer`/teach_* unless teacher declined, `dj_answer`/dj_genres unless declined, page (org_logo, org_link, org_city, org_category) and **`contact_confirm` = a row in `organiser_onboarding_progress` with `contact_confirmed_at` set** for (caller, page).
- **Grace logic: none.** No date, no counter, no per-account start. The only switch is the global flag row `app_feature_flags.organiser_onboarding_gate` (prod today: **`enabled = false`**). Flipping it is an instant hard gate for every non-admin.
- **Feature flag:** server only (`organiser_onboarding_gate`). `organiser_onboarding_status_v1` returns `gate_on`, but **no Website code reads `gate_on`** (grep: 0 hits outside tests). The client P3 area flag is `VITE_ENABLE_ORGANISER_P3` (`src/lib/featureFlags.ts:67`), unrelated to the gate.
- **Targets (multi-page):** `_command_target_organisers_p5(envelope)` = the **series'** `organiser_ids` (via occurrence for `occurrence.*`; via `id` or `public_event_id` for series), else `payload.organiser_ids` (the create), else the caller's own pages. So the gate checks the pages of the SERIES, intersected with the caller's memberships, and passes if the caller has finished any one of them. Ticket doors instead pass `ARRAY[ticket_type.organiser_id]` (one page only).
- **Reads:** a catalog search for every function body calling `_require_onboarding_*` returns only the 12 write doors below; **no read RPC is gated** (organiser_home_v1, admin_event_workspace_p5, event_view_p5, organiser_get_occurrence_programme_v1, status, stats all open). The one exception in effect is the Repeat **dry-run preview**, which is a write door used as a read (see A-gate-6).

Gated doors (live): `series_command_p5`, `occurrence_command_p5`, `organiser_save_event_v1`, `organiser_save_festival_v1`, `organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1` (first statement after BEGIN), `admin_bulk_occurrence_command_p5`, `admin_collapse_series_to_one_off_p5`, `admin_duplicate_event_p5`, `series_festival_artists_set_v1` (via `_require_onboarding_for_door_v1`), and conditionally `ticket_type_upsert_v1`, `ticket_type_set_status_v1` (S8).

Gate line in the two command doors (both identical):
```
series_command_p5 / occurrence_command_p5:
BEGIN
    PERFORM public._require_onboarding_complete_v1(public._command_target_organisers_p5(p_envelope));  -- onboarding S2 gate
```
`organiser_set_occurrence_programme_v1`:
```
PERFORM public._require_onboarding_complete_v1(public._command_target_organisers_p5(jsonb_build_object('target_id', p_occurrence_id, 'command', jsonb_build_object('kind', 'occurrence.set_programme'))));
```
`ticket_type_upsert_v1` (only in the `IF v_id IS NULL` create branch, after `_ticket_can_manage_organiser_v1`):
```
PERFORM public._require_onboarding_complete_v1(ARRAY[v_org]);  -- onboarding S8 gate
```
`ticket_type_set_status_v1` (only inside `IF p_status = 'on_sale' THEN`):
```
PERFORM public._require_onboarding_complete_v1(ARRAY[v_type.organiser_id]);  -- onboarding S8 gate
```

## 1. Client routing of the refusal

- Match: `ONBOARDING_REFUSAL_MATCH = /^(permission_denied: )?onboarding_incomplete/` (`src/modules/organiser/shared/selfServeErrors.ts:152`), first row of COMMAND_COPY/PROGRAMME_COPY, fallback copy `ONBOARDING_REFUSAL = 'Finish your details first, then you can add or change your events.'` (`:153`).
- Sheet route: `useGatedCopy()` / `gatedCopy()` (`p3/onboarding/gate.ts:68-100`) calls `openGate()` and returns `null` (no error line). `GateHost` mounted once in `P3Shell` (`p3/shell/P3Shell.tsx:71`) draws `GateSheet`.
- `openGate` does nothing when no GateHost is listening (`gate.ts:30-31`); `useGatedCopy` only opens while the sending screen is mounted, tagged with its pathname (`gate.ts:85-99`).
- Sheet text (`p3/onboarding/gateModel.ts:9-18`, `GateSheet.tsx`): title **"A few details first"**, body **"We ask everyone who runs a page. It takes about five minutes and you only do it once."**, "N things left" + one row per code, **Continue** (Link to `p3StartReview(page)` = `/account/p3/start?o=<page>&at=review`, or `/account/p3/you/details` for a page not yours), **Not now**. Loading: "Checking what's left...". Read failed: "We couldn't load your details. Try again." Not yours: "These details are for a page you don't run, so its team finishes them. ..." (Continue disabled).

## 2. The door table

Legend: **Gated** = live server gate refuses this door when flag ON. **Handled** = `sheet` (A1 sheet via useGatedCopy), `card` (own refusal card with link), `static` (the ONBOARDING_REFUSAL line, no link/sheet), `generic` (wrong generic copy), `n/a`.

| # | Door (screen + command kind) | RPC | Gated server side? | Client handling (file:line) | Text shown on refusal |
|---|---|---|---|---|---|
| 1 | Event page > Status > **Hide** (`series.set_lifecycle` paused) | series_command_p5 | yes (S2 line) | sheet: `p3/screens/StatusSheet.tsx:65,77-78` (`run` -> `gated(e, commandErrorMessage)`); send = `useToast.run` -> `useRunCommands` (`shared/runCommands.ts:62-77`) | A1 sheet |
| 2 | Status > **Show** (`set_lifecycle` live) | series_command_p5 | yes | sheet, same path | A1 sheet |
| 3 | Status > **Put it live** (draft/paused -> live) | series_command_p5 | yes | sheet, same path | A1 sheet |
| 4 | Status > **End it** (`series.end_run`, today_session) | series_command_p5 | yes | sheet, same `run` (`StatusSheet.tsx:117`) | A1 sheet |
| 5 | Status > **Stop repeating** (`series.stop_repeating`) | series_command_p5 | yes | sheet, same `run` | A1 sheet |
| 6 | Status > **Remove** (`set_lifecycle` archived) | series_command_p5 | yes | sheet, `StatusSheet.tsx:176` -> `run` | A1 sheet |
| 7 | Status / date sheet > **Cancel the event** one-off (`series.cancel_one_off`) | series_command_p5 | yes | sheet: `CancelEventSheet.tsx:32,55-56` | A1 sheet |
| 8 | Toast **Undo** / **Bring it back** (any undo: set_lifecycle, unskip, `occurrence.cancel {cancelled:false}`) | series_command_p5 / occurrence_command_p5 | yes | sheet: `Toast.tsx:27,35-38` (toast removed) | A1 sheet |
| 9 | Event page > **Repeats** preview (`series.set_recurrence` dry_run) | series_command_p5 | yes (gate runs before dispatch; dry run is refused too) | sheet ONCE per sheet: `RepeatSheet.tsx:147,169` (`useGatedCopy({once:true})`), then preview reads `REPEAT_COPY.previewNeeded` | A1 sheet opens on its own ~350 ms after the first change; Save stays off |
| 10 | Repeats > **Save** (`series.set_recurrence`) | series_command_p5 | yes | sheet: `RepeatSheet.tsx:145,200-201` (but Save is unreachable while preview failed, `:183-186,194`) | A1 sheet (in practice the preview's) |
| 11 | **Name and details** Save (`series.upsert` + `series.set_group_chat`) | series_command_p5 | yes | sheet: `EditTray.tsx:96,115-120` (`useSaveRun`) via `DetailsScreen.tsx:32,51`; ALSO client lock `useEditLock` (`EditTray.tsx:76-83`, `DetailsScreen.tsx:34`) from a different read | A1 sheet, or before any tap: "Finish your profiles first, N answers left" (profileLock, `shared/profileProgress.ts:65-68`) |
| 12 | **Prices** Save (`series.upsert` passes/price) | series_command_p5 | yes | sheet: `useSaveRun` via `PricesScreen.tsx:18,32`; same client lock | same as 11 |
| 13 | **Session** sheet, every date (`series.set_program`: add/edit/remove/line-up) | series_command_p5 | yes | sheet: `SessionSheet.tsx:62,109-110` (`useEverySend` rethrows, `data/sessions.ts:259-263`) | A1 sheet |
| 14 | Session sheet, **just this date** (programme save) | organiser_set_occurrence_programme_v1 | yes (S2 line) | sheet: `data/sessions.ts:289-291` rethrows refusal unwrapped, `SessionSheet.tsx:110` | A1 sheet |
| 15 | Date sheet > **Cancel this date** (`occurrence.cancel` reason) | occurrence_command_p5 | yes | sheet: `DateSheet.tsx:46,54-55` (`useGo`) | A1 sheet |
| 16 | Date sheet > **Bring back** (`occurrence.cancel` false) | occurrence_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 17 | Date sheet > **Move date** (`occurrence.move_date`) | occurrence_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 18 | Date sheet > **Change time** (`occurrence.set_time`) | occurrence_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 19 | Date sheet > **Back to usual time** (`occurrence.set_time` reset) | occurrence_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 20 | Date sheet > per-date **Where / About / Ticket / Photo / Name / Photos / Price** (`occurrence.set_override`) | occurrence_command_p5 | yes | sheet, `useGo` (`DateSheet.tsx:330-349` photo -> `saveDetail`) | A1 sheet |
| 21 | Date sheet > **Put this date back to normal** (set_override + set_time composite) | occurrence_command_p5 x2 | yes (step 1 refused, step 2 never sent) | sheet; `PlanStepError` wraps only step i>0 (`data/dates.ts:309-312`) | A1 sheet |
| 22 | Date sheet > **Skip this date** (`series.skip_date`) | series_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 23 | Break sheet > **Put it back** (`series.unskip_date`) | series_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 24 | **Add a date** (`series.add_date`) | series_command_p5 | yes | sheet, `useGo` | A1 sheet |
| 25 | (main) **New event** name step, create (`series.upsert` with organiser_ids) | series_command_p5 | yes (target = payload.organiser_ids) | **static**: `flows/new/NewFlow.tsx:146-147` `setError(commandErrorMessage(err))` | "Finish your details first, then you can add or change your events." no link |
| 26 | (main) New event venue/date(+weekly rule)/time/cover/**go live** steps | series_command_p5 | yes | **static**: `flows/new/useNewSend.ts:44-49`; go-live first asks `profileQuestionsLeft` (different read) -> Review (`NewFlow.tsx:325-329`) | static line (unreachable in practice: the create is refused first) |
| 27 | Event > **Organisers** add/remove page (`series.set_organisers`) | series_command_p5 | yes | **static**: `events/SeriesOrganisers.tsx` -> `useEventSend` -> `flows/add/useFlow.ts:54-56,67-68` `commandErrorMessage` | static line, no link |
| 28 | Tickets > **Add ticket** (new type) | ticket_type_upsert_v1 | **conditional**: create branch only | **generic**: `p3/tickets/TypeSheet.tsx:119,130-131` `catch { refuse(reasonMessage(null)) }` | "That did not work. Try again in a moment." (`tickets/ticketModel.ts:407-408`) |
| 29 | Tickets > **Edit** existing type | ticket_type_upsert_v1 | **no** (update branch has no gate line) | n/a | saves |
| 30 | Tickets > **Add and sell** / switch to **Selling** (`on_sale`) | ticket_type_set_status_v1 | **conditional**: only `p_status='on_sale'` | **generic**: `TypeSheet.tsx:127` `.catch(() => ({ok:false, reason:null}))`; `TicketsEntry.tsx:160,166-167` | "Ticket saved as a draft, not on sale yet. That did not work. Try again in a moment." / row: "That did not work. Try again in a moment." |
| 31 | Tickets > Pause / Sold out / **Close sales** | ticket_type_set_status_v1 | no | n/a | saves |
| 32 | Ticket **Refund** | edge fn `ticket-refund` | CANNOT-TELL (edge function; the live guard only scans SQL) | `RefundSheet.tsx:47-57` -> `reasonMessage` | if refused: generic |
| 33 | Get paid > **Connect Stripe** | edge fn `stripe-connect-onboard` | CANNOT-TELL (edge) | `p3/tickets/data.ts:85-99` | if refused: generic |
| 34 | **Door** scan check-in | ticket_check_in_v1 | no (correct: the door must work) | n/a | n/a |
| 35 | Flyer / picture **uploads** (Details photo, date photo, date photos, New event cover) | Storage (`uploadFlyer`, `uploadEventPicture`) | no | n/a | upload lands, then the save is refused (orphan file) |
| 36 | You > Page edit, Settings rename (`organiser_profile_update_p5_v1`) | organiser_profile_update_p5_v1 | no (by design: onboarding saves this) | n/a | n/a |
| 37 | You > Team (set public, add/set member, remove member, resolve access request), Handover | organiser_team_* / remove_organiser_member_v1 / resolve_organiser_access_request_v1 | no (not event writes, `scripts/onboarding-write-doors.json`) | n/a | n/a |
| 38 | Add a page: claim / ask to join / create page | claim_organiser_v1 / request_organiser_access_v1 / create_organiser_profile_v1 | no | n/a | n/a |
| 39 | Onboarding writes (dancer profile, roles/declines, confirm contact, skip about, complete) | save_my_dancer_profile_v2, save_my_role_v1, set_my_role_declined_v1, set_my_role_intent_v1, confirm_organiser_contact_v1, skip_organiser_about_v1, complete_organiser_onboarding_v1 | no (must not be) | n/a | n/a |
| B1 | (build branch) **New event** save plan: create, set_recurrence, add_date xN, set_program, go live | series_command_p5 | yes | **card**: `p3/new/useCreateSave.ts` catch -> `{s:'failed', onboarding: isOnboardingRefusal(e)}`; `p3/new/CreateFlow.tsx:228-232` | Card "Finish your details first" + "Finish your details first, then you can add or change your events. Nothing was saved; what you typed is still here." + link "Finish your details" (-> Review) |
| B2 | (build branch) New event **Discard** draft (`set_lifecycle` archived) | series_command_p5 | yes | **generic**: `useCreateSave.ts` discard `catch { setState({s:'discardFailed'}) }` | "The draft could not be discarded. Check your connection and try again..." (only reachable if gate flips ON after a create landed) |
| B3 | (build branch) New event cover upload before create | Storage | no | n/a | uploaded, then create refused (orphan) |

**Counts.** 42 rows (39 on main incl. 4 grouped non-event rows 36-39, plus 3 build-branch rows). Of the event-content doors (1-35, B1-B3 = 38):
- **Gated server side: 29** (1-28, 30, B1, B2; 28 and 30 conditionally). Not gated: 29, 31, 34, 35, B3 (+ 32/33 CANNOT-TELL).
- **Handled with the A1 sheet: 24** (1-24).
- **Own card with a working link: 1** (B1).
- **Static line, no way to act: 3** (25, 26, 27).
- **Wrong generic error ("Try again"): 3** (28, 30, B2).
- **Silently swallowed: 0** (but see A-gate-6: Repeat opens the sheet unasked, and A-gate-7: undo toast just disappears, which is by design).

## 3. Prod counts (SELECT count only, 2026-10-30)

| Fact | Count |
|---|---|
| Claimed organiser pages (an `entity_members` organiser row; legacy `claimed_by` not added) | **48** (58 member rows, 13 users) |
| ... with a non-admin member | **9** pages / **11** non-admin users (39 pages have admin members only) |
| `organiser_onboarding_progress` rows (any) | **0** |
| rows with `completed_at` / `contact_confirmed_at` | **0 / 0** |
| Pages that would PASS the gate for at least one member (`_onboarding_missing_v1 = {}`) | **0** |
| Non-admin (user, page) pairs: missing codes min / avg / max | 3 / 5.8 / 10 (none at "contact_confirm only") |
| Claimed pages with a live series with a future scheduled date | 26 (all 26 fail the gate) |
| ... pages with a non-admin member and live future dates | **4** pages, **7** live series |
| Flag `organiser_onboarding_gate` | **false** |

So with the flag ON today, **every non-admin organiser (11 people, 4 pages with 7 live, upcoming series) is refused on every event write**, including cancelling tonight's date. Admins are never refused.

## 4. Findings

### A-gate-1 - blocker - J-d8 / J-d9 (flag flip)
**What happens:** No grace exists. The gate is one global boolean; on flip, 11 of 11 non-admin organisers (4 pages, 7 live upcoming series) lose every event write at once, including emergency moves (cancel tonight, End it, move a date). 0 of 48 pages pass, because `contact_confirm` needs an `organiser_onboarding_progress` row and the table is empty.
**Evidence:** `_require_onboarding_complete_v1` (no date/grace branch, `IF NOT is_feature_enabled(...) THEN RETURN`); `_onboarding_missing_v1` contact_confirm clause; counts table above; flag row false.
**Fix:** Do not flip until those 11 have finished (or add a server grace: per-account deadline + exemption for cancel/move on dates within N days).
**Owner question:** Should cancel / move / time on a date in the next 7 days stay open during and after grace (safety writes), or is a hard gate on all writes intended?

### A-gate-2 - high - J-d8 (banner S02)
**What happens:** The grace banner always says **"Finish your details to create and edit events. N things left. Until then everything works as usual."** (`p3/screens/GraceBanner.tsx:66-67`). It never reads `gate_on`, so when the flag is ON the copy is false (nothing works); when OFF it implies a requirement that is not enforced. No end date is shown because none exists (`graceModel.ts:48`). Grace length: decided by nothing (manual flag flip). Banner shows only on Home, only with >0 left, hidden per device per day ("Hide for today").
**Evidence:** `grep gate_on src` = 0 non-test hits; banner text above.
**Fix:** Read `gate_on` from the status call: ON -> "Finish your details to make changes to your events" (no "works as usual"); OFF -> today's line; show the deadline once the server has one.
**Owner question:** Grace length and whether the banner shows a date (plan Q1).

### A-gate-3 - high - J-e8
**What happens:** Main New event (rows 25-26) and event Organisers (row 27) are inside the P3 frame (GateHost listening) but use `commandErrorMessage`, so a refused create shows only the static line "Finish your details first, then you can add or change your events." with no Continue link, and no sheet. Creating a first event is the most likely first write for a new organiser.
**Evidence:** `flows/new/NewFlow.tsx:146-147`; `flows/new/useNewSend.ts:44-49`; `flows/add/useFlow.ts:54-56,67-68`; P3 mounts them at `p3/shell/P3Routes.tsx:94-97`.
**Fix:** Route these through `gatedCopy(e, commandErrorMessage, pathname)` when rendered in P3 (or land the build branch, which replaces New event, and fix Organisers).

### A-gate-4 - high - J-d9 (tickets)
**What happens:** Ticket doors are gated (new type; set to on_sale) but the screens catch the throw and show "That did not work. Try again in a moment." Retrying never works. "Add and sell" saves the draft and then says "Ticket saved as a draft, not on sale yet. That did not work. Try again in a moment." Also the config `scripts/onboarding-write-doors.json:119-125` still classes both as "not an event edit, neither gated", which is now false.
**Evidence:** live bodies (S8 gate lines above); `p3/tickets/TypeSheet.tsx:127,130-131`; `TicketsEntry.tsx:166-167`; `tickets/ticketModel.ts:407-408`.
**Fix:** In the ticket catches, `gatedCopy(e, () => reasonMessage(null))`; move both names to `gated` in the doors config.

### A-gate-5 - high - J-e8 step 3 ("without retyping")
**What happens:** After the sheet's Continue, the person does Review -> Live screen, whose exits are Home or Page (`OnboardingFlow.tsx:130,286`), never the refused screen. **Nothing is retried automatically**; the person must find the event again and redo the write. Retyping: date sheet / session sheet / status choices are sheet state and are lost. Details / Prices typing is lost unless they stay (the EditTray router blocker should ask before leaving, CANNOT-TELL whether it fires on the sheet's Continue Link). Build-branch New event keeps the typed text in sessionStorage (same tab, same kind) but **not the photo** (`cover` is `useState<File>`, uploaded URL in a ref), so the photo must be picked again.
**Evidence:** `GateSheet.tsx:65` (Link + close, no return state); `gate.ts` holds no pending command; `p3StartReview` has no return param (`shell/paths.ts:61-62`).
**Fix:** Pass `?back=<refused pathname>` into Review and make Live's primary button go back there; optionally keep the refused command in gate state for a one-tap "Save it now".
**Owner question:** Auto-retry the held write on return, or bring the person back to the screen with a "Try again" (safer for stale versions)?

### A-gate-6 - medium - J-c7
**What happens:** Opening **Repeats** and changing anything fires a dry-run preview through `series_command_p5`, which the gate refuses; the A1 sheet opens by itself (~350 ms after the first change) before the person taps Save, and the preview area then says "not checked yet". Every refused preview also writes a 'failed' audit row (`_command_audit_refusal_p5` in series_command_p5's EXCEPTION block). This is the only read-like call refused.
**Evidence:** `RepeatSheet.tsx:147,163-171`; `data/repeat.ts:10-13`; series_command_p5 body.
**Fix:** Either check status before previewing (skip the preview when the status read says gate_on and not complete) or let the server skip the gate for `dry_run:true`.

### A-gate-7 - medium - J-c7 (two definitions)
**What happens:** Details and Prices are locked BEFORE any tap by `useEditLock` -> `profileLock`, which reads `my_profile_progress_v1` (`publish_ready`). That body does not call `_onboarding_missing_v1` and has no contact_confirm (live: `position('_onboarding_missing_v1')=0`, `position('contact_confirm')=0`). The two can disagree: the lock says "Finish your profiles first, N answers left" (different count from the sheet's "N things left"), or the lock is open and the server refuses. The New event go-live (main and build branch) also uses `profileQuestionsLeft` (the same other read). Two counts for one fact, against the doctrine's "one shared mapping".
**Evidence:** `p3/screens/EditTray.tsx:76-83`; `shared/profileProgress.ts:47-68`.
**Fix:** Make the P3 lock read `organiser_onboarding_status_v1` (graceModel's one count) when `gate_on`, or drop the client lock and let the A1 sheet answer.
**Owner question:** Should the edit screens be locked up front (no typing wasted) or open with the sheet at Save?

### A-gate-8 - medium - J-d8 (multi-page)
**What happens:** The series doors pass if the caller has finished ANY ONE of the series' pages they are a member of. A person who finished page A can then edit a co-organised series that also lists their unfinished page B. Ticket doors check only the ticket's own page (`ARRAY[v_org]`), so the same person can edit the event but not sell its tickets. The sheet's DETAIL names "the first target page still missing something", which may not be the page the person thinks of as the event's.
**Evidence:** `_require_onboarding_complete_v1` loop (`IF cardinality(v_m)=0 THEN RETURN`); ticket gate lines.
**Fix:** Pick one rule (the series' first page you belong to, or any) and use it in both door families.
**Owner question:** Is "any one finished page" the intended rule for co-organised events?

### A-gate-9 - low - J-c7 step 3 (route change)
**What happens:** Changing route closes the sheet: `GateHost` closes on any pathname change and drops an ask tagged for another path (`GateHost.tsx:18-23`); leaving the P3 frame unmounts it (`:24`). A late refusal after the person moved on is dropped (`gate.ts:30-31`, `:94`). Only a query-string change (for example `?o=`) does not close it. Screens outside P3Shell (DoorScreen, `start`, `you/details`) have no GateHost (no event writes there except the door scan, which is ungated). **Verified in code. A browser walk must confirm the Back button and the tab bar close it.**

### A-gate-10 - low - build branch
**What happens:** New event on the build branch shows its own card ("Finish your details first" + link), not the A1 sheet, so a create refusal reads differently from every other write (gate.ts says "ONE sheet"). The copy is fine and it does say what was kept. The cover file is uploaded to storage before the create, so every refused create leaves an orphan file (B3; also row 35 for edit screens).
**Evidence:** `p3/new/CreateFlow.tsx:228-232`, `p3/new/useCreateSave.ts` (upload before the `create` step).
**Fix:** Use `useGatedCopy` there too (sheet + keep the draft), and upload the cover after the create lands.

### A-gate-11 - low - CI guard config
**What happens:** `scripts/onboarding-write-doors.json` is stale against live: `admin_bulk_occurrence_command_p5` is still `expected_pending` (it is gated live via `_require_onboarding_for_door_v1`), and `ticket_type_upsert_v1` / `ticket_type_set_status_v1` are `not_event_writes` "neither gated" (they are gated, S8). Edge functions (`ticket-refund`, `stripe-connect-onboard`) are outside both the live guard (SQL catalog only) and this static check.
**Fix:** Move the three names to `gated`; add a note that edge functions are not covered.

## 5. CANNOT-TELL / what the browser walk (390x844, test account with the flag ON on a branch DB, never prod) must check
1. Each of rows 1-24: the A1 sheet opens over the refused sheet and both stack (the date sheet stays below); Not now leaves the person exactly where they were.
2. Details/Prices: whether `profileLock` already locks the Save (and with which count), and whether the EditTray leave blocker stops the sheet's Continue when typing is dirty.
3. Repeats: the sheet opening by itself on the first change.
4. Back button and tab bar close the sheet; a `?o=` change does not.
5. After Review -> Live, where the person lands and how many taps to redo the write.
6. Refund / Stripe connect: whether either edge function refuses an unfinished organiser.
7. Ticket "Add and sell" copy with the flag ON.

---

# Part 2: journey steps (A-gate-J1..n)


Working tree: origin/main @472ecde. I only read code and ran SELECT queries on prod `stsdtacfauprzrdebmzg` (counts only). I edited nothing.
Onboarding-gate write handling is out of scope; another auditor covers it.
Paths are relative to `src/` unless they start with `app/` or `supabase`.

## Prod shape survey (counts only)

**Series by format / rule mode / status** (`event_series_p5`, non-template):

| format | rule mode | live | draft | paused | ended | archived | no cover (non-archived) |
|---|---|---|---|---|---|---|---|
| recurring | weekly (interval 1) | 28 | 7 | 1 | 0 | 7 | 7 (all drafts) |
| recurring | monthly (interval 1) | 6 | 0 | 0 | 0 | 2 | 0 |
| recurring | custom | 1 | 0 | 0 | 0 | 0 | 0 |
| recurring | no rule (explicit dates or legacy) | 10 | 1 | 0 | 13 | 3 | 1 |
| course | weekly / none | 6 | 1 | 0 | 8 | 1 | 1 |
| festival | none | 8 | 0 | 0 | 0 | 5 | 0 |
| one_off | none | 10 | 4 | 1 | 0 | 635 | 3 |

**Shape gaps against J-d3's list:**
- Prod has no every-2-months series (monthly interval is always 1).
- Prod has no cancelled one-off: 0 live one-offs have a cancelled date.
- There are no `pending_review` or `rejected` series.

**Volume:**
- Most non-archived series on one organiser page: 12. Most including archived: 45.
- Most non-archived series one *user* sees across all their pages: **103**. That is over 100, so prod has a real case for G-10.
- Most future dates on one series: 57. One series has more than 100 dates in total (132).

**Live but nothing coming up:** 9 one-offs, 5 courses, 2 festivals and 7 recurring series are live with no scheduled future date. These are the realistic "all ended" shapes; there are only 21 series with lifecycle `ended`.

**Festivals:** 6 of the 8 live festivals have no stored prices (`passes` empty or null).

**Team roles** (`entity_members`, organiser): 18 owners, 45 managers.

**Server reads:**
- `organiser_home_v1` returns ONE jsonb value. Its `series` CTE has no LIMIT (body lines 26-46, 111) and it drops archived series (line 45). Only `next_dates` is capped, at 3 (line 96). So the 100-row cap does not apply to the Events list.
- `admin_event_workspace_p5` defaults to 100 dates (line 44) and pages with `has_more`.
- `admin_event_workspace_p5` does NOT refuse an archived series. `_assert_can_edit_series_p5` lets in owner OR manager (line 38).

---

## J-c7 step 3 only

| step | verdict | evidence | note |
|---|---|---|---|
| 3. Changing route closes the gate sheet | PASS | `modules/organiser/p3/onboarding/GateHost.tsx:17-24`: a pathname change calls `closeGate()`, and so does unmount. `GateHost` is mounted once, in `shell/P3Shell.tsx:71`. | `you/details` and `start` sit outside P3Shell (`P3Routes.tsx:67-68`), so following the sheet's link unmounts the host and closes the sheet. An ask tagged for another screen is dropped (`GateHost.tsx:18`). A change to the query string only (`?o=`) does not close it, which is acceptable. |

## J-d1: returning organiser finds P3

| step | verdict | evidence | note |
|---|---|---|---|
| 1. ContinueAs lands on P3 Home | FAIL [G-01] | `lib/accountRouting.ts:352`: an organiser side's `to` is `/account/o`. `signInLanding` uses it (`:396`). `lib/auth-otp-routing.ts:172-173`: `organiserHomeHandoff` only fires when `organiserCount === 0`. `modules/organiser/home/index.tsx:119-120` | An organiser with a page always lands on R1 Home. |
| 2. Dancer home link, Options link and Your areas row reach P3 Home | FAIL [G-01] | `components/account/DancerHome.tsx:298,310,320` all use `ORGANISER_HOME_PATH` (`/account/o`). `modules/dancer-app/screens/options/optionsModel.ts:42` and `NoProfileWayOut.tsx:31` use `/account/o`. `modules/areas/home/areaStatus.ts:28` has `organiser: '/account/o'` | Every one goes to R1. The copy "Open the organiser area" matches (`DancerHome.tsx:299,311`). |
| 3. Legacy `/account/new`, `/account/series/<id>`, `/account/team` reach P3 | FAIL [G-04] | `components/AnimatedRoutes.tsx:241-255` sends these to `LegacyAccountRedirect`. `modules/organiser/shell/legacyPaths.ts:23-28` maps them to `ORG_PATHS.newWhat` / `.event` / `.team` (R1). The P3 flags are never read. | All three land in R1. |
| 4. `/account/tickets/...` (ticketing on) reaches S07 or S34 | PASS | `AnimatedRoutes.tsx:271-273` mounts the route only when ticketing, P3 and self-serve are all on. `modules/organiser/tickets/legacyRedirect.ts:13-22` sends an event screen to `P3_PATHS.event` and anything else to P3 Get paid (`p3/tickets/paths.ts:5-9`), keeping `?o` and `stripe`. | Ticketing is off on prod, so a walker needs a preview with `VITE_ENABLE_ORGANISER_TICKETING`. |

## J-d2: Home

| step | verdict | evidence | note |
|---|---|---|---|
| 1. Next up (next live date across all series), views tile, going numbers | PASS | `p3/screens/HomeScreen.tsx:82,91-113`. `p3/data/home.ts:122-153`: `rowsOf` covers every page, `nextUpOf` picks the soonest live row with a date. Views tile at `HomeScreen.tsx:139-154` (`useP3Views`, 30 days). Going at `GoingTile` (`parts.tsx:92-100`) and the Next up going (`HomeScreen.tsx:104-106`). | Going only renders when `p3GoingOn()` (`P3Going.tsx:11`). `GOING_CHECKIN_ENABLED` is OFF on production by design (`lib/goingCheckin.ts:4`), so the going numbers never show on prod. A views total of 0 renders a non-tappable card, not a link (`:150-153`). |
| 2. Tap Next up "going", the Who is going sheet shows the list or none yet | CANNOT-TELL (flag) | `P3Going.tsx:36-61` opens `GoingPeopleSheet` in a P3 `Sheet`. `modules/going/OrganiserGoing.tsx:43-75`: 0 going is plain text "Nobody has said they're going yet" (`goingCopy.ts:91`), never "0 going". People list at `:100-160`. | The code path is right. It needs a preview build with `VITE_ENABLE_GOING_PREVIEW=true` and `VITE_VERCEL_ENV=preview`. |
| 3. Views tile opens Stats on the default range; an empty range shows "Show 30 days" | PASS | `HomeScreen.tsx:146` links to `P3_PATHS.stats`. `StatsScreen.tsx:33` defaults to `'m'` (30 days). `:85-89` shows the "Show 30 days" button when the range has 0 but 30 days has more than 0. | Exact copy matches. |
| 4. On A-org-ended-only, Home shows the all-ended copy with Add an event | FAIL | `HomeScreen.tsx:15-20,109-113,169-176` | All ended (lifecycle `ended`): the copy says "Add an event and its next date shows here." but the only control is "Open your events". The "Nothing current" card links "See them in Events". There is no Add an event control (U2). For the common prod shape (live but past: 9 one-offs, 5 courses), `noNextCopy` keys on `lifecycle === 'live'`, so it says "None of your live events has a date coming up. Add dates…" next to rows tagged "Finished", where adding dates is not possible. See A-gate-J4. |

## J-d3: Events list over every shape

| step | verdict | evidence | note |
|---|---|---|---|
| 1. Every non-archived series is listed, each with the same status tag as its Event page | PASS (code) | The server drops archived rows (`organiser_home_v1` line 45, plus `shared/homeModel.ts:49`). `EventsScreen.tsx:22-46` groups rows as current / Hidden / "Past and nothing coming up". Both screens call ONE `statusOf` (`model/status.ts:25-36`): Home with `upcoming_count` (`data/home.ts:96`), the Event page with the workspace's live dates (`data/eventPage.ts:130-131`). Both kind words come from `kindWordStored` (`home.ts:95`, `eventPage.ts:174`). | Two counts feed the one mapping. Only zero vs. more than zero matters and both agree on it. A **cancelled one-off** (its only date cancelled) is tagged "Finished" on both screens (`status.ts:23-24,35`), never "Cancelled": U9 holds, but the word is questionable (A-gate-J9). Prod has none of these, and no every-2-months series. |
| 2. A series with no photo shows the placeholder | PASS | `parts.tsx:26-34`: `Thumb` falls back to "No photo yet" when there is no cover AND on `onError`. | The Event page head draws `v.cover && <img>` with no `onError` (`EventPage.tsx:199`), so a broken cover URL there shows a broken image. That is low and outside S05. |
| 3. Over 100 series rows, all reachable | PASS (server) | `selfServeApi.ts:75-83` calls `organiser_home_v1`, which returns a single jsonb. The series aggregate has no LIMIT (body 26-46, 111), so PostgREST max-rows does not apply. `EventsScreen` renders every row, with no slicing. | Prod has a user who sees 103 non-archived series. Browser check: that the list scrolls fully at 390x844 with 103 or more rows. Home slices to 4 and says "See all N" (`HomeScreen.tsx:163-170`). |

## J-d8: status changes

| step | verdict | evidence | note |
|---|---|---|---|
| 1. Each greyed row says why | PASS | `StatusSheet.tsx:30-45`: a disabled row shows `row.reason` in place of its sub line. The reasons come from `data/eventPage.ts:206-225,244-271` (draft: no date / no cover / no session; live: back to draft; end: never ran; stop: course or too many dates; ended, archived and review rows). | Visible text, not a tooltip. |
| 2. Hide, then Show, then Put it live: each has Undo | FAIL | `data/eventPage.ts:279-283`: `hide` and `show` carry an `undo`; `live` has `undo: null`. `Toast.tsx:16` draws Undo only when `done.undo`. | Put it live has no Undo. The server does not allow live back to draft (`backDraftWhy`, `eventPage.ts:215`), so an Undo would have to mean Hide. Product choice needed. |
| 3. End it asks "Did tonight happen?", needs an answer and lists the dates that go | PASS | `StatusSheet.tsx:92-125`: the question at `:97-105` (copy matches), Confirm disabled until answered (`endCommand`, `eventPage.ts:356-359`), going dates listed `:110-114` (first 4, then "and N more"). | The question shows only when today is one of the event's dates (`plan.tonight`, `eventPage.ts:342`). Otherwise it ends with no question, which looks right. `endPlan` reads the newest 100 dates; the most future dates on prod is 57, so nothing is under-counted today. |
| 4. Remove archives the series, which leaves Events; a later deep link shows not found or archived | FAIL | Confirm at `StatusSheet.tsx:169-182` sends `lifecycleCommand('archived')` (`eventPage.ts:285`). Toast: "Removed from your events.", with no navigation. `admin_event_workspace_p5` does not refuse archived. `status.ts:28` maps `archived` to the "Finished" tag. | It does leave Events (home_v1 line 45). But the person stays on the Event page, which now reads **"Finished"**. A deep link later opens the full page tagged Finished. Only the Status sheet ("This event was removed…", `eventPage.ts:223`) and the edit screens' lock (`shared/eventState.ts:57`, "This event is archived…") say what happened. Not broken, but not "archived" either. |

## J-d9: details, prices and per-date fields

| step | verdict | evidence | note |
|---|---|---|---|
| 1. Opening Name & details and leaving with no change sends nothing and shows no leave prompt | PASS | `EditTray.tsx:27-69`: dirty means `changed.length > 0`. Save is disabled with "Nothing changed yet" (`:207,229`, `labels.ts:171`). The guard only blocks while dirty (`:148,202`). `DetailsScreen.tsx:43,50-53` | |
| 2. Edit, then try to leave: the Leave? sheet appears and Undo mine reverts | PASS (code) | Router blocker `EditTray.tsx:142-176`. Sheet `:242-253`: "Leave without saving?" / "Leave and lose them". "Undo my changes" with confirm `:224-241` sets `form.undo` (`:39`). | The blocker needs the data router: prod is RR7 framework mode (`react-router.config.ts`, `app/root.tsx`). `src/App.tsx` (BrowserRouter) falls back to Back-link-only asking. Browser check: tab bar and phone Back while dirty. |
| 3. Pick place: venue loading and error states; a city lookup failure shows Retry | FAIL (U7) | Loading at `DetailsScreen.tsx:149`. Error at `:150` with **no Try again** in the place sheet. City failure plus Try again at `:106-111,173-196` (10s timeout). | A venue read failure gives a dead sheet (Close only). An empty venue list renders nothing, with no copy. The per-date "Where" sheet has the same gap (`DateSheet.tsx` edit-where branch). |
| 4. Prices: the free switch, the locked rows count, and "no prices" | FAIL (festival) | `PricesScreen.tsx:48-72`. Free switch only when `choices.length > 1`. A festival has one choice (`events/paymentModel.ts:31-32`). The empty copy "No prices yet. Add one, or switch on 'It's free'." (`labels.ts:265`) shows anyway. Locked count `labels.ts:272` (PASS). | On a festival with no prices (6 of 8 live festivals on prod) the copy names a switch that is not on screen (U2). Other formats pass. |
| 5. Per-date name, photo and price: a dirty sheet asks before closing; a cancelled date is locked with a reason | PASS | `DateFieldSheets.tsx:35-75`: Back, Close and scrim go through `guard` and an inline ask. A cancelled date's "details" action is disabled with "This date is cancelled. Bring it back first." (`model/dates.ts:70,111,123`), shown as text by `ActionChoice` (`DateSheet.tsx:64-69`). | A dirty field sheet is not registered with the leave guard, so a tab-bar tap while it is open drops the draft silently (low). |
| 6. A non-owner team member sees the edit lock banner with a reason | FAIL (contract vs server) | `useEditLock` (`EditTray.tsx:77-84`) only knows ended/archived and the unfinished-profile lock. P3 has no owner/manager check (grep). The server lets managers edit (`_assert_can_edit_series_p5` line 38). | A manager gets full edit screens and no banner. A contributor gets the Not yours card from the workspace refusal (`EventPage.tsx:274`), not a lock banner. Separately, the profile-lock link "Complete your profile" goes to R1 `/account/o/complete` (`DetailsScreen.tsx:80`, `PricesScreen.tsx:45`, `shared/profileProgress.ts:45`). |

## J-x1: old links, bookmarks and emails

| step | verdict | evidence | note |
|---|---|---|---|
| 1. `/account/o`, `/account/o/series/<id>`, `/account/new`, `/account/team` land on P3 | FAIL [G-04, G-26] | `/account/o` is R1 Home (`AnimatedRoutes.tsx:258-262`). The handoff only fires with 0 pages (`home/index.tsx:119`). `/account/o/series/<id>` has no R1 route, so it hits the `*` catch-all and goes to `/account/o` (`OrganiserRoutes.tsx:153`): R1 Home, not even R1's event. `/account/new` and `/account/team` go through `legacyPaths.ts:23-28` into R1. | Every one lands in R1. Bare `/account?o=` / `?from=` / `?claim=` also goes to R1 Home (`pages/Account.tsx:42,56-57`, `lib/accountRouting.ts:71-75`). |
| 2. Claim, invite and approval email links land in P3 | FAIL | **Invite:** `admin_invite_person_v1` builds `/invite/<token>` (body line 133). The Join Done screen uses `acceptedInviteLanding`, which gives P3 `you/welcome?o=` while P3 is live (`admin-organisers/join/JoinScreens.tsx:166-168`, `p3/shell/paths.ts:68-69`): PASS. **Claim:** `PublicClaimCard.tsx:212` links done to `ORG_PATHS.home` (R1): FAIL. **Dancer-only invite** (no page) links `/account` (body line 95), which is correct for a dancer. **Approval:** no prod DB function or edge function in the project sends an approval email with a site URL: only `admin_invite_person_v1` holds `c_site`; `send-listing-request-email` and `send-organiser-edit-digest` go to the owner. | The approval email target is CANNOT-TELL: the sender, if any, is outside this repo and the deployed functions (admin repo or manual). An invite with no organiser id falls back to R1 `ORG_PATHS.home` (`JoinScreens.tsx:168`). |

---

## Findings

**A-gate-J1** (J-d1.1-2, J-x1.1) **blocker**
- What happens: an organiser who already has a page never reaches P3 without typing the URL. ContinueAs, `/account`, the dancer home's three links, Options, Your areas and `/account/o` itself all end on R1 Home.
- Evidence: `lib/accountRouting.ts:352`; `lib/auth-otp-routing.ts:172-173`; `modules/organiser/home/index.tsx:119`; `components/account/DancerHome.tsx:298,310,320`; `modules/dancer-app/screens/options/optionsModel.ts:42`; `modules/areas/home/areaStatus.ts:28`.
- Fix: while P3 is live, make `organiserHomeHandoff` return P3 Home (keeping `?o=`) when the person has 1 or more pages, and point `ORGANISER_HOME_PATH` / `AREA_HREF.organiser` at one P3-aware helper.
- Owner question: switch everyone with a page at once, or only behind a per-account opt-in?

**A-gate-J2** (J-d1.3, J-x1.1) **medium**
- What happens: `/account/new`, `/account/series/:id` and `/account/team` redirect into R1 even while P3 is live.
- Evidence: `modules/organiser/shell/legacyPaths.ts:23-28`; `components/AnimatedRoutes.tsx:241-255`.
- Fix: give `legacyAccountPath` a `p3Live` argument that maps to `P3_PATHS.newWhat`, `.event(id)` and `.youTeam`.

**A-gate-J3** (J-x1.1) **medium**
- What happens: `/account/o/series/<id>` (an old R1 bookmark shape) has no route. It falls to R1's `*` and lands on R1 Home, so the event is lost.
- Evidence: `modules/organiser/shell/OrganiserRoutes.tsx:128-153` (only `events/:seriesId` exists).
- Fix: add `series/:seriesId` that redirects to `P3_PATHS.event` when P3 is live, else to `ORG_PATHS.event`.

**A-gate-J4** (J-d2.4) **high**
- What happens: the no-Next-up copy keys on lifecycle, not status. A page whose live events have all run (the common prod shape: 9 one-offs, 5 courses, 2 festivals) reads "None of your live events has a date coming up. Add dates…" next to rows tagged "Finished", where Add date is refused. The all-`ended` copy says "Add an event" but no Add an event control is on Home. The "Nothing current" card has no Add control either.
- Evidence: `modules/organiser/p3/screens/HomeScreen.tsx:15-20,109-113,172-176`.
- Fix: choose the copy from `status.key` (`warn` means add dates; finished-only means "All your events have finished" plus `<AddEventLink/>`), and put `AddEventLink` in both cards.

**A-gate-J5** (J-d8.2) **medium**
- What happens: Put it live has no Undo, though the contract wants Undo on all three one-tap moves.
- Evidence: `modules/organiser/p3/data/eventPage.ts:282`; `screens/Toast.tsx:16`.
- Fix: either give `live` the undo `lifecycleCommand('paused')`, labelled "Hide it", or change the contract to "Hide and Show have Undo".
- Owner question: is "undo" of going live = Hide acceptable, given live back to draft is refused?

**A-gate-J6** (J-d8.4) **medium**
- What happens: after Remove, the person stays on the Event page, which now says "Finished". A deep link to an archived series opens the full page tagged "Finished". The Status sheet reason and the edit-screen lock are the only places that say "removed" or "archived".
- Evidence: `modules/organiser/p3/screens/StatusSheet.tsx:176`; `model/status.ts:28`; `admin_event_workspace_p5` (no archived refusal).
- Fix: on a landed remove, navigate to Events with the toast. In `WorkspaceGate`, render an "This event was removed" StateCard (with Events link) for `lifecycle_status === 'archived'`.

**A-gate-J7** (J-x1.2) **medium**
- What happens: a claim made from the public organiser page (`?claim=1`) ends with a "go" link to R1 Home.
- Evidence: `modules/organiser/shared/components/PublicClaimCard.tsx:212`. Also `JoinScreens.tsx:168` (the invite fallback without an organiser id) and `EmailCodeProof.tsx:27` (default `returnTo`).
- Fix: route these through one `organiserHomeLanding(p3Live)` helper (the same one as J1).

**A-gate-J8** (J-d9.6) **medium**
- What happens: the contract expects a lock banner for a non-owner member, but the server lets managers edit and P3 has no owner check. A manager sees full edit screens. 45 manager rows are on prod.
- Evidence: `modules/organiser/p3/screens/EditTray.tsx:77-84`; `_assert_can_edit_series_p5` line 38.
- Fix: none in code until the owner decides; then either update the contract or add a role lock to `useEditLock` from `home.organisers[].role`.
- Owner question: may a manager edit event details and prices?

**A-gate-J9** (J-d3.1) **low**
- What happens: a cancelled one-off is tagged "Finished" on Events, Home and the Event page (consistent, but it never ran). Prod has 0 today.
- Evidence: `modules/organiser/p3/model/status.ts:23-24,35`; `organiser_home_v1` line 94 (scheduled-only `next_dates`).
- Fix: use `cancelled_upcoming_count` (already in the home_v1 payload, line 66) to tag "Cancelled".
- Owner question: "Cancelled" or "Finished"?

**A-gate-J10** (J-d9.3) **low**
- What happens: a failed venue read in Pick place (and the per-date Where sheet) shows an error with no Try again. An empty list shows nothing. This breaks U7 and U3.
- Evidence: `modules/organiser/p3/screens/DetailsScreen.tsx:149-159`; `DateSheet.tsx` edit-where branch.
- Fix: add a `RetryButton` calling `venues.refetch()`, plus an empty-list line.

**A-gate-J11** (J-d9.4) **low**
- What happens: on a festival, the "No prices yet. Add one, or switch on 'It's free'." copy names a switch that is hidden for festivals. 6 live festivals have no prices.
- Evidence: `modules/organiser/p3/screens/PricesScreen.tsx:48,65`; `model/labels.ts:265`.
- Fix: use a festival variant, "No prices yet. Add one."

**A-gate-J12** (J-d9.6, U1) **low**
- What happens: the Details and Prices profile-lock link "Complete your profile" leaves P3 for R1 `/account/o/complete`, as a full page load (`<a href>`).
- Evidence: `modules/organiser/p3/screens/DetailsScreen.tsx:80`; `PricesScreen.tsx:45`; `shared/profileProgress.ts:45`.
- Fix: point it at `p3StartReview(organiserId)` / `P3_PATHS.youDetailsFor`.

**A-gate-J13** (J-d9.5) **low**
- What happens: a dirty per-date field sheet (name, photos, price) is not registered with the leave guard. A tab-bar tap or phone Back closes it and drops the draft silently.
- Evidence: `modules/organiser/p3/screens/DateFieldSheets.tsx:35-50` (no `useLeaveGuard`).
- Fix: call `useLeaveGuard(dirty || uploading)` in `FieldSheet`.

**A-gate-J14** (J-d3.2) **low**
- What happens: the Event page head cover has no `onError` fallback, so a broken cover URL shows a broken image.
- Evidence: `modules/organiser/p3/screens/EventPage.tsx:199`.
- Fix: reuse `Thumb`'s broken-URL state.

## CANNOT-TELL: what a browser walk must check

1. **J-d2.2** (going switch off on prod): on a preview build with `VITE_ENABLE_GOING_PREVIEW=true`, Home > Next up shows "N going" as a button of at least 44px. Tapping it opens a sheet titled with the event name and listing people. A night with 0 going shows "Nobody has said they're going yet" as plain text.
2. **J-x1.2 approval email**: find the real approval email template (admin repo or manual send) and open its link signed in, with P3 live. It must land on P3 Home or Welcome, not `/account/o`.
3. **J-d9.2 leave guard under the framework router**: on `/account/p3/events/<id>/details`, edit the name, then tap (a) the Events tab, (b) phone Back, (c) "Back". Each must show "Leave without saving?". "Leave and lose them" must navigate; "Keep editing" must stay.
4. **J-d3.3**: signed in as the account that sees 103 series (or a seeded one with more than 100), Events lists them all and scrolls to the last, and the count matches the seed.
5. **J-c7.3** (for confirmation): with the gate sheet open, tap a tab and use phone Back. The sheet must close, and must not reopen on the new screen.
6. **J-d8.4**: after Remove, check what the page shows, then reload the deep link. Record the tag text and whether any edit control is still enabled (Add date, Repeats, date sheets).

## Counts

| journey | PASS | FAIL | CANNOT-TELL |
|---|---|---|---|
| J-c7 (step 3) | 1 | 0 | 0 |
| J-d1 | 1 | 3 | 0 |
| J-d2 | 2 | 1 | 1 |
| J-d3 | 3 | 0 | 0 |
| J-d8 | 2 | 2 | 0 |
| J-d9 | 3 | 3 | 0 |
| J-x1 | 0 | 2 | 0 (approval email part CANNOT-TELL) |
