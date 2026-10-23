# P2-A Foundation audit

Refs audited: main d4bff82, rebuild head 94a7e5ea (origin/claude/er-c8-eventpage) | date 2026-10-23 | read-only | ticket dt_1b7777c7b677 | brief sha b521f895

## 1. Owner summary

1. **Back buttons and old screens.** Every screen has its own fixed "Back" address, copied from the old layout. So a new screen can drop an organiser into an old editor (W1), and the old screens can still be opened. The rebuild needs one map of which screen sits above which, and must close off the old screens once the new ones are on.
2. **No single way to load and save an event.** The same event is loaded twice, by two different readers. Five different places send saves. After a save, some screens keep showing old information. One "Update" tap is really several saves in a row, so half of it can land and half not, and nobody is told. If two co-organisers change the same thing, the last one silently wins. The rebuild needs one reader, one saver and one refresh rule, a save that either all lands or tells the person exactly what landed, and a clear "someone else changed this" screen.
3. **Stored values and on-screen choices are matched in several separate copies.** That is why 39 of the 63 live events that have music styles show duplicate chips, such as a ticked "bachata" next to an unticked "Bachata" (W2). It is also why 51 live events show two rows called "Ticket link" (W3), and why dates next year show no year (W6). The rebuild needs one list per idea (music styles, payment, formats, labels, dates) that every screen shares, with values cleaned up when they are saved.
4. **Errors are invisible to you, and misleading to organisers.** The error-reporting service was removed. When a page fails to load, the error only goes to the organiser's own browser. When the server refuses something, the screen says "check your connection" (W5). The rebuild needs one translator from server refusals to plain words, and every failure, loads included, reported to you with the event and the action.
5. **Launch items are blocked underneath.** Courses are switched off in both the app and the server. Organisers have no way to see views or saves. The pilot switch is fixed when the site is built, so changing it means a redeploy, and there is no off-switch. Every new event is stamped with London time. The rebuild needs courses turned on at both ends, a small stats read for organisers, a pilot list and off-switch you can change without a deploy, and the time zone taken from the event's city.

**Worth keeping:** the live server commands, the shared event-rules file, the Ember building blocks (sheets, buttons, chips, rows), the test data copied from real events, and the invite journey that is being built now.

## 2. Gap list

Prefixes: MAIN = origin/main d4bff82, RB = rebuild head 94a7e5ea. `org/` = `src/modules/organiser/`. Where no prefix is given, the path is the same on both trees, or the input recorded it without one.

| id | area | severity | evidence file:line | what | failing scenario an organiser would hit | rebuild requirement |
|---|---|---|---|---|---|---|
| G01 | 1 | blocker | RB:org/organisers/OrganisersScreen.tsx:145; RB:org/flows/change/WhatChanges.tsx:32; RB:org/flows/add/WhichDay.tsx:25; RB:org/flows/fix/CoverFlow.tsx:74; RB:org/shared/goLiveCheck.ts:77-80; RB:org/shell/OrganiserRoutes.tsx:143 | Back targets are hand-copied constants that ignore the switch, and the route table has no parent map (W1) | On a switched-on event the organiser taps Organisers, then Back, and lands on the old Details editor, which edits the same fields a second way. From Date, Add and Flyer, Back goes to Home or the old pickers | One `parentOf(route, switchState)` in the shell. Old-only routes (`/details`, `/programme`) redirect to the event when the switch is on. A test renders the real shell and checks every rebuilt screen's Back |
| G02 | 1 | major | RB:org/shared/goLiveCheck.ts:73,86-89 (0 readers of `returnTo` in org/) | Go-live fix links add `?returnTo=`, but no screen reads it. Fix links for venue and basics open the old Details | From the go-live checklist the organiser fixes the venue in the old Details, and Back takes them somewhere else | Read `returnTo` in the shell Back, or delete it and rely on G01's parent map. Fix links must respect the switch |
| G03 | 1 | minor | RB:org/events/OneEvent.tsx:245,259-262 | When the event read fails the switch stays OFF, so the old error or NoAccess body is shown | An allowlisted event whose read fails shows the old error screen | Decide the switch from the home read or the allowlist, not from the read that failed |
| G04 | 1 | minor | RB:org/shell/rebuildSwitch.ts:52-60; RB:org/shell/OrganiserRoutes.tsx:99 | The per-login switch answer `on` and `useRebuildSwitchPending` have 0 callers. Home and New are not gated per login | (dead code, no direct effect) | Delete them, or use them for Home and New |
| G05 | 2 | major | RB:org/shared/runCommands.ts:13-20 vs RB:org/shared/selfServeApi.ts:235,243-247; RB:org/events/OneEvent.tsx:205-206 | One RPC (`admin_event_workspace_p5`) is read under two cache keys with two parsers. The rebuilt page reads both | The organiser cancels a date in a flow, comes back to the event page, and the old date still shows. The version bump is not seen | One workspace read, one key, one parser |
| G06 | 2 | major | RB:org/shared/useOwnerCommand.ts:37-39; hand patches at RB:org/flows/event/useEventSend.ts:19, EventPage.tsx:151, LifecycleActions.tsx:113,123, DatesTakenOff.tsx:49, GoLiveFlow.tsx:168 | Invalidation after a save is per caller. It misses the event workspace, go-live, programme and organisers. Profile saves use 3 different strategies | After a fix the readiness checklist is stale. Details is stale after a change flow (cancel/Confirm, add/Time, change/*) | One `afterSeriesWrite(seriesId)` and one `afterOccurrenceWrite` invalidation set, owned by the single sender |
| G07 | 2 | major | RB:org/events/EventPage.tsx:168-184 (sequential `saveAll`); RB:org/events/eventPageModel.ts:229-245 | One Update sends N series commands one after another. If command k fails, commands 1 to k-1 have already landed, and the page shows only the error | Update sends name and venue, then the programme. The programme is refused. The page says it did not go through, but the new name is already live | A server-side batch command, or a truthful "this saved, this is still pending" report |
| G08 | 2 | major | RB:org/flows/new/useNewSend.ts:40; RB:org/flows/new/NewFlow.tsx:136; RB:org/flows/fix/CoverFlow.tsx:60-62 | 3 direct senders bypass useOwnerCommand. Each reads its own version and does its own invalidation | After a cover change via CoverFlow, the event page's cache key is not refreshed | All series writes go through one sender |
| G09 | 2 | minor | RB:org/dates/peoplePicker.ts:48 vs RB:org/shared/selfServeApi.ts:358 | Two people pickers: a direct `dancer_profiles` table read and an RPC | Different search results on different screens | One picker RPC |
| G10 | 2 | minor | 10 files declare their own `UntypedRpc` shim; RB:org/shared/selfServeApi.ts:305; RB:org/organisers/organiserApi.ts:47 | No single RPC client. Errors are mapped per file | Inconsistent error copy and retry behaviour | One typed client wrapper (function, args, parser, error map) |
| G11 | 2 | minor | RB:org/shared/runCommands.ts:35 | `useRunCommands` has no production caller (test only) | none | Drop it |
| G12 | 3 | blocker | RB:org/ui/States.tsx:42; RB:org/organisers/organiserApi.ts:44; RB:org/flows/change/parts.tsx:48-50; RB:org/dates/index.tsx:172; RB:org/shared/selfServeErrors.ts:248-250 | Read errors never pass through a mapper. ErrorState defaults to "Check your connection". Only `^permission_denied` is told apart from a network failure. `organiserApi.toError` drops the code (W5). Same on MAIN | A co-organiser opens a date or Organisers, the server refuses, and the screen says "Check your connection". They retry forever | One `readErrorCopy(err)` built on `isServerRefusal`. ErrorState has no network wording by default. Known codes (`viewer_role_mismatch`, `permission_denied`, `series_not_found`) get real copy. API wrappers keep `code` and `message` |
| G13 | 3 | major | RB:org/events/eventPageModel.ts:182-190; RB:org/events/EventPage.tsx:103-109; `conflictingFields` RB:org/events/eventModel.ts:141-148 has 0 non-test callers | On a re-read, `rebaseDraft` keeps the local edits over the new data, then saves with the NEW version. A field both people changed is overwritten silently | Two co-organisers edit the same field and the last save wins, with no warning | On rebase, a field changed on both sides stops the save and shows both values |
| G14 | 3 | minor | 3 leave guards (useLeaveBlocker, useUnsavedChangesGuard RB:org/dates/index.tsx:81, raw beforeunload RB:org/events/EventPage.tsx:144-149); 4 network regexes (RB:org/shared/selfServeErrors.ts:218, wizard/dancerApi.ts:48, edit-in-place/teamPickerModel.ts:162, edit-in-place/draftModel.ts:290); 17 error mappers | Many copies of the same mechanism | The same situation behaves differently on different screens | One leave guard, one network test, one error mapper |
| G15 | 4 | blocker | RB:org/events/EventPage.tsx:390-392; RB:org/events/eventModel.ts:226,402-436; normaliser RB:org/events/musicModel.ts:12-23 not used by EventPage | Music chips are matched case-sensitively and saved raw (W2). 3 editors, 2 matching rules. Prod has 26 spellings for about 13 styles | The organiser opens an event (39 live are affected) and sees a ticked "bachata" next to an unticked "Bachata". Ticking it stores both spellings | One music module (vocabulary, aliases, `keyOf`, canonicalise on save) used by every editor, with a table test over the 26 prod spellings |
| G16 | 4 | major | RB:org/shared/event-rules.json:28; RB:org/events/EventPage.tsx:59,364-366; RB:org/events/EditorSheet.tsx:19,291; RB:org/flows/change/Copy.tsx:17; RB:org/events/eventPageModel.ts:65-69; prod payment_methods set on 0 series | One word is used for two facts: the payment-method label and the URL field label. There is no label dictionary (W3) | 51 live events show two "Ticket link" rows. The organiser cannot tell which one sets the web address | A field-label registry keyed by FIELD and by CODE, plus a uniqueness test per Card. Rename the URL row (e.g. "Ticket web address") or merge it into the pay row |
| G17 | 4 | major | RB:org/shared/event-rules.json:11 + RB:org/shared/eventRules.ts:182 vs RB:org/events/eventType.ts:1-18, MAIN+RB:org/flows/new/model.ts:19-23 | The format list and labels exist in 2 copies, and they contradict the rules on whether a festival can be created | The organiser cannot create a festival although the rule says they can (or the other way round) | Format list and labels come from event-rules.json only |
| G18 | 4 | minor | RB:org/shared/event-rules.json:19 vs RB:org/shared/programmeModel.ts:40-45; RB:org/events/programmeSeriesModel.ts:35 | Stored `performance` is shown as "Showcase" on one screen and "Performance" on another (3 session-type label maps) | The same session has a different name on two screens | Type labels come from `sessionKinds` only |
| G19 | 4 | minor | scripts/check-event-rules-mirror.mjs (no workflow references it) | The admin mirror check exists but is not in CI, and it passes green when the admin copy is missing | The admin rules drift silently | Wire it into db-contract-check with EVENT_RULES_ADMIN_REQUIRED=1 |
| G20 | 5 | blocker | RB:org/shared/dateList.ts:26-27; RB:org/shared/dateWords.ts:15; RB:org/events/eventPageModel.ts:361 -> EventPage.tsx:485; MAIN:org/flows/event/EventStep.tsx:80,123 | `fullDate` shows a year only if it is handed `today`, and `dayLabel` (25 call sites) never hands it over (W6) | In Oct 2026 Stop repeating offers "Friday 8 January" (which is 2027). The organiser picks the wrong year | One formatter with the year on by default (`today` required). Delete `dayLabel`. A matrix test across a year boundary |
| G21 | 5 | blocker | RB:org/events/EventPage.tsx:246-247 (MAIN:org/events/OneEvent.tsx:235-236 was a 52px row) | The title rename button is hand-rolled: `text-[24px] leading-tight` with no min-h gives a 30px box (W4). This is a rebuild regression | The rename is missed or mis-tapped on a phone | Edit the title with TitleInput or SummaryRow. A tap-size test renders every screen and asserts every box is >=44px |
| G22 | 5 | major | RB:org/events/EventPage.tsx:203-207,403,409,414 | There is no ActionRow or quiet-button primitive. The off-state reason is stacked inside a flex item that is centred (W7) | Pause and Cancel are out of line, and the reasons wrap unpredictably | `ActionRow` + `QuietButton` primitives. The reason goes BELOW the row, aligned to its item |
| G23 | 5 | major | about 47 duplicate implementations (see Numbers); e.g. flows/add/parts.tsx:20 vs flows/change/parts.tsx:12 `StepRow` (same name, different API) | Rows, buttons, sheets, frames and states are forked | A fix lands in one copy only (the two StepRows already differ) | One Row, one Step frame, one States set. Delete the flows/*/parts copies |
| G24 | 5 | major | RB:org/ui/ember.css:28-66; RB:org/shell/OrganiserShell.tsx:84; RB:docs/organiser-rebuild/er/handover/ER-FIX-C2.md:53; DESIGN-base.md (public site system) | There is no Ember design spec, and no organiser route mounts EmberWorld. Phones see the old cream/gold theme (RB:org/theme.css:10-35) | The rebuild is called "Ember", but organisers see cream/gold, and reviewers have no spec to check against | Write the Ember DESIGN doc (tokens, primitives, sizes). Mount EmberWorld in OrganiserShell behind a flag |
| G25 | 5 | minor | 145 rem spacing classes in 38 files (MAIN 140); 22 rem text classes; src/components/ui/button.tsx:20-21 | The px-only rule is written down but not enforced | Spacing renders about 16% small, and future rem heights slip in | A guard test that bans rem size and spacing classes under organiser/ |
| G26 | 5 | minor | org/edit-in-place/parts.tsx:11-13, sheetStyles.ts:7, FieldSheet.tsx:299, TeamSheet.tsx:169, ContactSheet.tsx:113, EditInPlaceLayer.tsx:493 | edit-in-place has a 3rd palette, 4 hand-rolled dialogs and 160 inline styles | Look and focus behaviour drift between screens | Port it to SheetView and the tokens, or quarantine it |
| G27 | 5 | minor | org/ui/AttentionStrip.tsx (0 importers); shared/dateWords.ts:7 vs events/eventModel.ts:72; events/eventModel.ts:279 vs home/homeView.ts:10 | Dead primitive, duplicated weekday names, two `shortDate` functions | (drift) | Drop or adopt them, with one copy of each helper |
| G28 | 6 | major | org/ui/Buttons.tsx:29; org/ui/SummaryRow.tsx:80; RB:org/events/EventPage.tsx:425,449,477; flows/newpage/NewPageFlow.tsx:163; flows/new/WhichPage.tsx:42; switch/Welcome.tsx:51 | The primitives have no `reason` prop. Native `disabled` drops focus, so the reason is never announced. There are 133 native `disabled` against 27 `aria-disabled` | A disabled Update or Done tells VoiceOver nothing, and the reason sits on another row | A `reason` prop: aria-disabled plus aria-describedby, with the reason at full contrast |
| G29 | 6 | major | RB:org/events/OneEvent.tsx:213,266 (MAIN:232); page/index.tsx:52,54; team/index.tsx:57 | Some empty states have no body and no action. "Event not found" is a dead end | The organiser is stuck on "Event not found" with no way on | EmptyState requires `body` and `action` at type level |
| G30 | 6 | minor | ErrorState default "This did not load" vs "Did not load" passed in 21 files (flows/add/parts.tsx:52, flows/change/parts.tsx:50); RB:org/events/EventPage.tsx, flows/event/*, flows/Done.tsx have no state of their own | Title drift, and screens with no own loading or failure state | Inconsistent wording, and a blank screen or a parent's state | One default title with no override. Every screen owns Loading, Failed and Empty |
| G31 | 7 | major | RB:org/ui/ember.css:26; 49 non-test `text-[var(--gold)]` vs 2 `--gold-fg`; emberContrast.test.ts checks primitives only | Ember `--gold` used as text is 4.04:1 on card2 (fails 4.5). Latent: fg on danger is 2.27 | Selected items and links become unreadable once Ember is switched on | A lint or test rule: `--gold` is never used as `text-`; use `--gold-fg` |
| G32 | 7 | major | org/flows/add/parts.tsx:33,37; org/ui/SummaryRow.tsx:65 | The reason text sits inside an `opacity-60` button, which gives 3.13:1 | The organiser cannot read why a row is locked | Reason text never inherits opacity |
| G33 | 7 | minor | org/ui/SheetView.tsx:102,180; role=radio groups RB:org/events/EventPage.tsx:482-486, flows/event/parts.tsx:69, events/EditorSheet.tsx:45; the edit-in-place sheets have no `inert` | A cramped sheet hides its footer. Radio groups have no arrow-key roving. The hand-rolled sheets have no `inert` background | With the keyboard up on a short phone, Done cannot be reached | Keep the primary button visible (shrink the body instead). Use one radio group primitive |
| G34 | 7 | minor | RB:org/events/EventPage.tsx:431; flows/handover/Confirm.tsx:52; team/AddSomeone.tsx:108,110; team/Person.tsx:76; home/onboarding/OnboardingView.tsx:146 | 7 more sub-44px targets (inline text buttons and links, about 20px), on top of W4 | Missed taps on retry and team links | Covered by the G21 tap-size test |
| G35 | 8 | major | RB:org/events/OneEvent.tsx:27,248; bundle table | The rebuilt EventPage is statically imported into OneEvent. The chunk grows 7.5 -> 21.0 KB gz, and the event route grows +17 chunks and +35 KB gz | Every organiser on a phone downloads the rebuilt page even with the switch OFF | Make RebuiltEvent/EventPage its own `lazyWithRetry` chunk |
| G36 | 8 | major | MAIN+RB:perf-budgets.json `routes` (nothing under /account/o) | No organiser route has a budget or ratchet | G35 merged without a red check, and organiser payloads grow unwatched | Add organiser home and organiser event budgets |
| G37 | 8 | major | RB:org/events/OneEvent.tsx:243,248; RB:org/shared/useOrganiserSeries.ts:105-115; RB:org/shared/selfServeApi.ts:243 vs runCommands.ts:17; RB:org/events/EventPage.tsx:96,128 | The event page is a chained waterfall: the switch is decided only after ws, then home, then a duplicate workspace RPC, then venues and go-live. Worst case is 4 sequential hops plus 1 duplicate 100-date read | On slow 4G the organiser sees skeletons for 3-4 round trips | One workspace key. Decide the switch from home (already prefetched) or from the route |
| G38 | 8 | minor | RB:org/shared/profileProgress.ts:55-57 | `my_profile_progress_v1(null)` fires before ws arrives | One wasted RPC per event open | `enabled: !!organiserId` |
| G39 | 8 | minor | RB:org/shell/OrganiserShell.tsx:84-85; org/ui/PreviewBar.tsx:52 | The whole area is a fixed 100dvh inner scroller. PreviewBar clips at 22dvh with no scroll | The phone URL bar never collapses, and scroll position is lost on Back | A document-scroll layout, or explicit scroll restore |
| G40 | 8 | minor | RB:org/shell/OrganiserRoutes.tsx:76-83,101,108 | A screen chunk starts loading only after the account-gate query (and, with an allowlist, after home) | One extra serial hop on a cold load | Preload the screen chunk in parallel with the gate |
| G41 | 9 | major | MAIN:src/App.tsx:34-38 | Query (read) errors only go to `console.error` | The event page shows "Try again" forever, and you have no record of it | Report read errors (deduped) with the screen and RPC name |
| G42 | 9 | major | RB:org/flows/change/Pick.tsx:76-85; RB:org/events/EventPage.tsx:217-221 | Raw-async writes (bulk move or cancel, picture upload) bypass the MutationCache reporter | A failed bulk change or upload is seen only by the organiser | All writes go through one reported path |
| G43 | 9 | major | MAIN:src/lib/clientErrorReporter.ts:1-4,13-21,45; RB:org/shared/useOwnerCommand.ts:60-62 | Sentry was removed on 2026-09-13. Reports are one scrubbed line, capped at 5 per load, with no RPC, command kind, organiser or series. Expected refusals and conflicts are counted as save_failed. There is no admin viewer | You cannot tell which organiser or event failed, and real failures drown in noise | Structured fields (rpc, command kind, error code, ids), with expected refusals and conflicts excluded, and an admin view |
| G44 | 9 | minor | MAIN:src/components/AnimatedRoutes.tsx:99; RB:org/shell/OrganiserShell.tsx:49-54 | No organiser-level error boundary | One screen crash blanks the whole area and loses an unsaved draft | A boundary per screen inside OrganiserShell, with retry |
| G45 | 10 | major | RB:playwright.config.ts:50; no VITE_ORGANISER_REBUILD in tests/e2e or the workflows | The rebuilt screens have zero e2e coverage | A regression in the rebuilt event page ships with green checks | An e2e job with VITE_ORGANISER_REBUILD='*' over the event page at 390x844 |
| G46 | 10 | major | RB:org/events/__tests__/er-c8.page.test.tsx:33-37 | The rebuilt EventPage tests use a hand-made 3-date fixture, not shapes.ts | The 2026-10-08 class of bugs (ended series, 13 weekly dates, over 100 dates) is not caught for the rebuild | Run EventPage through every SeriesShape in a consistency matrix |
| G47 | 10 | minor | RB:org/events/__tests__/er-c8.route.test.tsx:20,69-74; er-c8.page.test.tsx:230-239; organisers.screen.test.tsx:21; consistency.render.matrix.test.tsx:424,427 (it.skip) | Vacuous and source-scan assertions. Screen tests mock the shell, so Back is never rendered | The suite is green on wrong behaviour | Behavioural assertions, the real OrganiserShell in screen tests, and a mutation check on the key guards |
| G48 | 11 | blocker | RB:org/shared/event-rules.json:11-12; RB:org/shared/eventRules.ts:183-190 (no non-test caller); MAIN+RB:org/flows/new/model.ts:19-23; RB:org/events/schedule.ts:103; RB:org/flows/event/eventSteps.ts:23,56-57; prod `_cmd_series_upsert_p5` | Course create is off in the rules, the UI and the server. Course dates are read-only. There is no step for weeks or total sessions | A teacher with a 6-week course cannot list it | An admin migration adds course to the owner create list. One New event list built from `ownerCreateFormats`. Course steps. Course dates editable |
| G49 | 11 | blocker | no organiser read path in org/**; only admin RPCs (`admin_organiser_run_stats_v1`, `admin_event_views_top_v1` src/types/supabase.ts:5128) | Organisers have no stats RPC and no stats screen. "Saves" has no table (event_attendance holds 7 rows) | The organiser asks "did anyone see my event?" and there is no answer | An owner-callable RPC for series views (7 and 30 days) from `event_views.event_id_p5`, plus saves (interested + going, definition to decide), and a stats card |
| G50 | 11 | blocker | RB:org/shell/OrganiserRoutes.tsx:96; RB:org/shell/rebuildSwitch.ts:1-28; MAIN+RB:org/shared/a1Gate.ts:3, parityGate.ts:5; RB:docs/organiser-rebuild/er/handover/ER-FIX-C3.md:17 | The pilot switch is build-time and keyed on the owner page. Rollback constants are code. There is no runtime kill switch | Changing the pilot list, or switching things off in an incident, waits for a redeploy | A runtime flag read from the DB (allowlist, plus a global OFF that also stops writes), cached, defaulting to OFF |
| G51 | 11 | blocker | RB:org/shared/seriesCommands.ts:313,343,362; RB:src/modules/event-page/bento/BentoPage.tsx:578,584; bento/blocks/RsvpBlock.tsx:47 | Every create is stamped Europe/London. Public pages fall back to London | A Budapest organiser's 21:00 is stored and shown at the London offset | Take the time zone from the city or venue. Public fallbacks read the series time zone |
| G52 | 11 | major | prod `check_owner_command_allowlist_v1` (owner-team logic); ER-INTERFACE AS BUILT; RB:org/organisers/organiserModel.ts:4-6,121-127,161 | The server may still keep end, stop, cancel one-off and set organisers for the owner team only, while the UI treats everyone as equal | A co-organiser taps End and is refused, or it works; nobody has proved which | Prove it with a co-organiser login. If it is owner-only, an admin migration to make all organisers equal. A role x action test against the real server |
| G53 | 11 | major | RB:org/events/eventPageModel.ts:350-356; RB:org/dates/dateChanges.ts:137; prod `_cmd_series_cancel_one_off_p5` exists | "Cancel the event" for a one-off is parked as "Not available yet", although the server command exists on prod | A party organiser cannot cancel their party | Re-check on prod and wire `series.cancel_one_off` |
| G54 | 11 | major | RB:org/shared/components/PublicClaimCard.tsx:167,237; RB:org/home/onboarding/OrganiserSheet.tsx:100-101 | The claim and request-access flows (with admin approval) still ship | A pilot organiser who signs in without the invite lands in a claim and approve flow | Day one goes only through the invite. Hide request-access, or keep it only as a fallback |
| G55 | 11 | major | RB:org/shared/programmeModel.ts:69; RB:org/sessions/sessionsModel.ts:391 | Only teaching and djing can be picked. Performer and judge search for `teaching`. People with no role cannot be found, and there is no invite path | A showcase cannot list its performers | Map the role per session kind. Add a "not listed? ask them to join" path |
| G56 | 11 | major | RB:org/organisers/organiserModel.ts:146; RB:org/organisers/organiserApi.ts:78 | Co-organiser invites target a PAGE, not a person or email | The partner has no page, so they cannot be invited | Invite by person or email, through the invite journey (W3 "invite names the person") |
| G57 | 11 | minor | RB:org/shared/eventRules.ts:203 vs goLiveCheck.ts | The client recomputes the publish rule (`blockers()`) | The Publish button and the server disagree | Read `series_go_live_check_v1` only |
| G58 | 11 | minor | RB:org/shared/event-rules.json:2,5; MAIN:src/components/calendar/CalendarGrid.tsx:29, CalendarListView.tsx:246 (EXCLUDED files, ask Ricky) | London wall-clock time and an 08:00 rollover are fixed in the rules and in the calendar "today" | Wrong "tonight" for another time zone | Make the rules relative to the series time zone (needs the admin mirror). The calendar change needs Ricky's approval |

## 3. W1-W7 root causes

| W | symptom | foundation root cause | evidence | rebuild requirement |
|---|---|---|---|---|
| W1 | Back from Organisers lands on the OLD /details screen | Back is 100% explicit routes (71 hand-written targets, 0 history-based) copied from the old layout. `paths.ts` has no idea of a parent, and nothing makes a parent depend on the switch. The rebuild moved the parent of Organisers, date, add and flyer from Details to the event page without changing those targets. Old-only routes stay mounted. The screen test mocks the shell, so Back is never rendered | RB:org/organisers/OrganisersScreen.tsx:145; WhatChanges.tsx:32; WhichDay.tsx:25; CoverFlow.tsx:74; goLiveCheck.ts:77-80,86-89; organisers.screen.test.tsx:21 | One parent map in the shell, switch-aware. Old routes redirect when the switch is on. Real-shell Back tests |
| W2 | lowercase `bachata` ticked next to unticked `Bachata` | No single music-style mapping. There are 3 editors and 2 matching rules: an exact-compare chip render, a `keyOf` normaliser in musicModel that EventPage does not use, and a text editor. The save writes the raw array, so the bug writes itself into prod. Prod has 26 spellings | RB:org/events/EventPage.tsx:390-392; musicModel.ts:12-23; eventModel.ts:66,226,402-436 | One music module with vocabulary, aliases and canonicalise-on-save, used by every editor. A test over every prod spelling |
| W3 | two Details rows called "Ticket link" | No field-label dictionary. The payment-method code label (`ticket_link: "Ticket link"`) doubles as the URL field label. Because prod has 0 series with payment_methods, every series with a ticket URL is given the `ticket_link` method | RB:org/shared/event-rules.json:28; EventPage.tsx:59,364-366; eventPageModel.ts:65-69; EditorSheet.tsx:19,291 | A label registry keyed by field and by code, with a uniqueness test per card |
| W4 | title rename button 30px | The screen hand-rolls a button instead of using TitleInput or SummaryRow, and no test gates tap size. The px rule is only written in docs | RB:org/events/EventPage.tsx:246-247; ui/TitleInput.tsx:51 (1 importer) | Screens use primitives only, plus a render-every-screen tap-size test |
| W5 | a server refusal shown as "Check your connection" | Read errors never pass through a mapper. ErrorState's default body asserts a network cause. Only `^permission_denied` is distinguished. API wrappers drop the code. 17 mappers exist, but none of them is for reads | RB:org/ui/States.tsx:42; selfServeErrors.ts:248-250; organiserApi.ts:44; flows/change/parts.tsx:48-50; dates/index.tsx:172 (same on MAIN) | One read-error mapper. A neutral ErrorState default. Wrappers keep the code |
| W6 | Stop-repeating dates past this year show no year | The year is opt-in: `fullDate` needs `today`, and `dayLabel` (25 callers) never passes it. The unsafe default is the easy one | RB:org/shared/dateList.ts:26-27; dateWords.ts:15; eventPageModel.ts:361 | One formatter with the year on by default, plus a year-boundary matrix test |
| W7 | Pause and Cancel not baseline-aligned | No ActionRow or quiet-button primitive. Each screen builds its own: the off-state reason sits inside a centred flex item, and there are 3 different shapes in one row | RB:org/events/EventPage.tsx:203-207,403,409,414 | `ActionRow` + `QuietButton`, with the reason below the row |

## 4. SALVAGE list

| module/file(s) | verdict | reason | tests that prove it |
|---|---|---|---|
| AD1 co-organiser client RB:org/organisers/organiserApi.ts (invite, cancel, respond, leave, remove, `series_organisers_v1`, `my_organiser_invites_v1`) | KEEP WITH CHANGES | One file, injectable rpc, parsed results, and it matches the ER-INTERFACE AS BUILT names. It must keep `code`/`message` on `failed` (G12), needs the G52 proof, and needs person invites (G56) | organisers/__tests__/* (the inputs say these test the wrong truth; redo against the real server) |
| AD1 venue client RB:org/venue/venueApi.ts (`owner_similar_venues_v1`, `owner_create_venue_draft_v1`) | KEEP AS IS | Matches the spec signatures, and the rate-limit code is handled (:33) | venue tests |
| AD1 go-live RB:org/shared/goLiveCheck.ts (`series_go_live_check_v1`) | KEEP WITH CHANGES | The single publish-rule reader, with codes from event-rules.json. The fix-link targets must respect the switch, and `returnTo` must be read or removed (G02) | shared/__tests__/goLiveCheck.parse.test.ts, GoLiveFlow.test.tsx |
| AD1/AD2 command callers: RB:org/shared/selfServeApi.ts (`runSeriesCommand` :282, `runOccurrenceCommand` :288, `fetchDateDetail`, programme RPCs) | KEEP WITH CHANGES | Thin and correct RPC calls. Move the keys to one registry, and drop the untyped casts once the types are regenerated | shared/__tests__/selfServeApi.payload.test.ts, selfServe.test.ts |
| RB:org/shared/useOwnerCommand.ts + org/flows/add/useFlow.ts `useFlowSend` | KEEP WITH CHANGES | The right shape: idempotency key reused on retry, conflict state, version bump. It must own the FULL invalidation set and become the only sender (G06, G08), and must not report expected refusals (G43) | er-c8.page.test.tsx, er-c8.fix2.page.test.tsx; needs a new test: every command kind -> invalidated keys |
| RB:org/shared/runCommands.ts | KEEP WITH CHANGES | Keep ONE workspace parser (this one or seriesWorkspace) and drop the dead `useRunCommands` | shared/__tests__/runCommands.test.tsx (covers only the dead hook) |
| AD2 "all equal" model RB:org/organisers/organiserModel.ts:121-127 + eventPageModel.ts:333-344 pageActions | KEEP WITH CHANGES | One shared permission table. It relies on "AD2 live on prod" (organiserModel.ts:4-6), which is unproven against `check_owner_command_allowlist_v1` | organisers model tests; add a role x action matrix against the real server |
| AD3 / AD4 server commands | NOT ASSESSED | No AD3 or AD4 reference exists in RB org/ code, and the admin handovers were not readable | - |
| Festival artists RPCs (`series_festival_artists_get_v1`/`_set_v1`, ER-INTERFACE section 5) | NOT ASSESSED | No caller found in RB src/ (grep 0 hits). Festivals are lower priority | - |
| RB:org/shared/event-rules.json + org/shared/eventRules.ts | KEEP WITH CHANGES | A good single source for payment, formats and blockers, and the admin mirror. Add the music vocabulary and aliases, format labels and field labels. Make eventType.ts, flows/new/model.ts and programmeModel TYPE_LABEL read from it. Use `ownerCreateFormats`/`formatOffReason` (0 callers today). Wire the mirror check into CI (G19) | eventRules.test.ts, plus the .fix, .fix2 and .nofield variants |
| RB:org/events/musicModel.ts | KEEP WITH CHANGES | The correct normaliser. Extend the aliases (zouk, bachata sensual, etc.), canonicalise on save, and make it the only chip source | events/__tests__/sw1.parity.test.tsx, __tests__/parity-matrix.test.ts |
| RB:org/events/EventPage.tsx music chips (:390-392) + eventModel.ts text music editor (:402-436) | DROP | The second and third music mappings, and the root of W2 | - |
| RB:org/events/eventModel.ts (`changedFields`, `savePlan`) | KEEP AS IS | "Untouched save sends nothing" is proven | schedule.matrix.test.ts:67-76 |
| RB:org/events/eventPageModel.ts | KEEP WITH CHANGES | `pendingParts`/`pageCommands` are good. Rebase must use `conflictingFields` (G13) | er-c8.model.test.ts:63-66, er-c8.fix2.model.test.ts:44-62 |
| org/shell/paths.ts | KEEP AS IS (+ add parents) | The single URL table, guarded | shell/__tests__/paths.test.ts, noHandBuiltLinks.test.ts |
| RB:org/shell/rebuildSwitch.ts | KEEP WITH CHANGES | The pure per-event owner rule is sound. Remove the dead `on`/pending hook. The source must become a runtime flag plus a kill switch (G50) | rebuildSwitch.test.ts, rebuildSwitch.perEvent.test.ts |
| RB:org/shell/OrganiserRoutes.tsx | KEEP WITH CHANGES | Add switch-aware redirects for /details and /programme. Lazy-load the rebuilt event page | shell/__tests__/routes.test.tsx, legacy.test.tsx, gate.matrix.test.tsx |
| org/shared/useLeaveBlocker.ts | KEEP AS IS (make it the one guard) | In-app blocking with proceed and reset | change.flow.test.tsx, pdates.flow.test.tsx |
| RB:org/shared/selfServeErrors.ts | KEEP WITH CHANGES | The write copy table is rich. Add a read mapper and the missing codes | shared/__tests__/selfServe.test.ts, ownerWritesD8.test.ts, copy.test.ts |
| org/flows/doneState.ts | KEEP AS IS | Reload-safe (goes to Home) | flows tests using readDoneState |
| MAIN+RB:org/events/Details.tsx, org/events/SeriesOrganisers.tsx + MAIN:org/events/organisersModel.ts | DROP once the switch is `*` | Superseded by EventPage and OrganisersScreen. The owner-only model contradicts "all equal" | sw1.parity.test.tsx (retire with them) |
| Ember ui: org/ui/SheetView.tsx | KEEP WITH CHANGES | A solid Radix focus trap, focus return and nesting guard. Fix the cramped footer (G33) | ui/__tests__/SheetView.test.tsx (3), focusReturn.test.tsx (3) |
| Ember ui: org/ui/Buttons.tsx (PrimaryButton, GhostButton) | KEEP WITH CHANGES | Add `reason` and `tone: danger/quiet` (G28) | primitives.test.tsx "Buttons" |
| Ember ui: org/ui/SummaryRow.tsx | KEEP WITH CHANGES | Make it THE row (add `to`, `accent`, `reason`), with no opacity on the reason | primitives.test "SummaryRow" |
| Ember ui: Card, SectionLabel, Pill, Chip, Field (+fieldNote), SearchField, Collapse, Skeleton, AnnounceRegion, useAnnounce, useDebounced, useKeyboardInset, useOpenerRef, useShake, initials | KEEP AS IS | px-sized, labelled, single-purpose | primitives.test.tsx, motion.test.tsx |
| Ember ui: org/ui/StatusTag.tsx | KEEP WITH CHANGES | Add paused and ended tones, so screens stop re-rolling TAG_TONE | primitives "StatusTag / Pill" |
| Ember ui: org/ui/States.tsx | KEEP WITH CHANGES | EmptyState must require body and action. ErrorState gets a fixed title and no network default | primitives "States..." |
| Ember ui: org/ui/TitleInput.tsx | KEEP AS IS (adopt in EventPage) | Already >=44px | primitives "TitleInput" |
| Ember ui: org/ui/DateChip.tsx, org/ui/londonDate.ts | KEEP WITH CHANGES | `today` must be required (year on by default). The time zone must not be hard-coded London | primitives "DateChip", consistency.matrix |
| Ember ui: PersonRow.tsx, Cover.tsx, PreviewBar.tsx | KEEP AS IS | Labelled and px-sized (PreviewBar clipping noted in G39) | primitives |
| Ember ui: org/ui/AttentionStrip.tsx | DROP (or adopt) | 0 importers | - |
| Ember ui: org/ui/EmberWorld.tsx, org/ui/ember.css | KEEP WITH CHANGES | The tokens are fine, but they need a spec doc and mounting. `--gold` as text fails on card2 | ember.test.tsx (12), emberContrast.test.ts (2) |
| Ember ui: org/ui/README.md | KEEP WITH CHANGES | Becomes the primitive section of the Ember design doc | - |
| (new) ActionRow, QuietButton, ChoiceList, InlineError, StepFrame, labels.ts | ADD | Close G16, G22, G23, G28 | new tests |
| Hand-rolled copies: flows/add/parts.tsx, flows/change/parts.tsx, flows/event/parts.tsx, EventPage `Go`/`Still`/`LABEL`/`TAG`/`QUIET`, edit-in-place dialogs | DROP (replace with primitives) | Forked copies (about 47) | - |
| Query hooks (7 copies of the home useQuery; 3 `cancellation-reasons` keys) | KEEP WITH CHANGES | Collapse into one hook per read, in one keys module | none centralised today |
| RB:org/dates/peoplePicker.ts + RB:org/sessions/SessionCard.tsx picker | KEEP WITH CHANGES | Real-profile search is correct and free text is refused. Widen the roles per session kind (G55), and use one picker RPC (G09) | peoplePicker tests; add a role x kind matrix |
| org/team/* (page team seats: AddSomeone, browse, public toggle) | KEEP AS IS | Page-level seats are what the invite redeem grants. This is separate from event co-organising | existing team tests |
| RB:org/flows/new/model.ts `NEW_FORMATS` | DROP (replace) | A hard-coded list. Use `ownerCreateFormats` | new format matrix |
| org/shared/a1Gate.ts, parityGate.ts | KEEP WITH CHANGES | The rollback switches stay, but move to the runtime flag | existing |
| Invite journey W1-W3 + `origin/claude/invite-type-email` (src/modules/admin-organisers/*) | KEEP AS IS | Ships first, is owned by another arc, and does not touch org/** | bindEmailStep, inviteSelfBoundGate, routes.matrix |
| Invite redeem landing `ORG_PATHS.welcome(o)` (MAIN:src/modules/admin-organisers/InviteRedeemPage.tsx:223,306; org/shell/paths.ts:17) | KEEP WITH CHANGES | The welcome page must list the events taken over (day one) and point at them | add: welcome x {0, 1, n events, co-owned} |
| RB:org/shared/createCity.ts | KEEP AS IS | The city comes from the venue, else the organiser's city, and is never guessed (:11-27) | existing |
| Test shapes: org/__tests__/shapes/{shapes,dateCapShapes,linkEntries}.ts + scripts/fixtures/event-truth-parity.json | KEEP AS IS | Prod-shape builders (survey of 2026-10-08, counts only) | imported by 8 (MAIN) / 10 (RB) test files |
| Matrix tests: consistency.dates.matrix, consistency.matrix, eventTruth.matrix, lifeLabel.matrix, schedule.matrix, takenOff.matrix, jobs/homeJobs.matrix, shared/ownership.matrix | KEEP AS IS | Table-driven over real shapes | themselves |
| src/lib/clientErrorReporter.ts | KEEP WITH CHANGES | A sound privacy-scrubbing transport. Extend it with structured fields (G43) | its own test |
| scripts/check-bundle-budget.mjs + perf-budgets.json | KEEP WITH CHANGES | Add organiser routes (G36) | CI budget step |

## 5. Numbers

| measure | MAIN | RB | note |
|---|---|---|---|
| Organiser routes under /account/o | 46 | 46 | 1 element differs (`events/:seriesId/organisers`) |
| Switch read sites / branch sites | 0 / 0 | 1 / 4 | per-login answer 0 callers, pending hook 0 callers |
| Back targets: history-based / explicit | 0 / 67 (31 + 36) | 0 / 71 (33 + 38) | old <-> new crossings on RB: 5 new->old, 1 old->new, 1 dead `returnTo` |
| Distinct RPC names called by organiser code | 38 | 48 | plus 7 direct `.from()` table reads and 1 direct table write (city_requests) on RB |
| Event/series read paths | - | 2 RPCs (workspace, home), but 2 parsers + 2 cache keys for the workspace; + go-live | home useQuery redeclared in 7 hooks |
| Series write senders | - | 5 (1 dead) | occurrence 2 (single, bulk) |
| Venue read / write paths | - | 2 / 2 | |
| Line-up/sessions read / write paths | - | 3 + 2 pickers / 2 | |
| Team / co-organiser read paths | - | 4 / 3 | writes 6 / 5 |
| Organiser profile read / write | - | 1 table + 5 RPCs / 1 RPC (3 callers) + 5 lifecycle | profile save invalidation: 3 strategies |
| RPC client shims (`UntypedRpc`) | - | 10 files | + programmeRpc + organiserApi `call` |
| Invalidate sites: org-event-workspace / series-workspace | - | 10 / 6 | |
| Error mappers / classifiers | - | 17 | 4 duplicated network regexes; 35 ErrorState sites, 0 with error-derived copy; 0 mentions of `viewer_role_mismatch` |
| Leave-guard mechanisms | - | 3 | |
| Music editors / matching rules | - | 3 / 2 | format label lists 2; session-type label maps 3; pay label maps 1 |
| ui/ primitives | 31 files, 1444 lines | same (byte-identical) | |
| Duplicate ui-concept implementations | most present | about 47 | rows 15, buttons 9, frames 5, sheets 4, states 8, inline errors 5, disabled-reason 4, label/tag 2 |
| Date formatters | - | 1 core + 9 wrappers | year-less `dayLabel` at 25 call sites |
| Sub-44px true targets | - | 8 of 183 scanned | 1 = W4 |
| rem spacing / rem text classes | 140 / - | 145 in 38 files / 22 | rem heights 0 |
| Inline `style={{` / hex in tsx | - | 192 (160 in edit-in-place) / 26 lines | |
| Disabled: native / aria | - | 133 / 27 | |
| Ember contrast failures | - | 1 in use (`--gold` text on card2 4.04), 1 latent (2.27) | org-theme: 0 failures, 1 marginal (4.56) |
| Organiser chunks, gz | 106.7 KB (301 raw) | 122.3 KB (356 raw) | 24 organiser-keyed chunks |
| OneEvent chunk, gz | 7.5 KB | 21.0 KB (72.2 raw) | static EventPage import |
| Event route closure (chunks / gz) | 68 / 237.4 KB | 85 / 272.9 KB | excludes the 113.7 KB gz entry closure |
| Home route closure (chunks / gz) | 58 / 224.2 KB | 58 / 224.7 KB | |
| Build (`npx vite build`) | exit 0, 1m01s | exit 0, 44s | VITE_ORGANISER_REBUILD unset |
| Organiser unit test files | 145 | 174 | `npx vitest run src/modules/organiser --reporter=dot` |
| Unit tests pass / skip | 3926 / 2 | 4688 / 2 | vitest 147 s / 156 s; skips are empty `it.skip` placeholders |
| Files importing shapes | 8 | 10 | table-driven files (`it.each`/`describe.each`) 92 / 117; source-scan files 23 / 26 |
| Organiser e2e specs in gate / total | 10 / 19 | 10 / 19 | 0 run with the rebuild switch on |
| Sentry calls / organiser error boundaries | 0 / 1 (switcher) | 0 / 1 (switcher) | |
| Prod: series total / live | 747 / 68 | | non-template live by format: recurring 44, one_off 11, course 6, festival 7 |
| Prod: series with styles / with a lowercase style | 110 (63 live) / 58 (39 live) | | 26 distinct spellings; 0 series holding both case variants yet; 37 live carry `bachata` |
| Prod: payment_methods set / ticket URL | 0 / 97 (51 live) | | 51 = W3 population; default_level set 0 |
| Prod: live series by organiser pages | 1 page 63, 2 pages 5 | | 35 pages on live series; 4 of 35 claimed; 63 active Leader seats |
| Prod: upcoming live by format / city | recurring 37, festival 5, course 4, one_off 2 / London 44, Budapest 2, Barcelona 1, Turku 1 | | timezone: London 596, null 138, UTC 10, Madrid 1, Budapest 1, Tunis 1 |
| Prod: event_views total / 30 days / series viewed in 30 days | 57,767 / 10,546 / 85 | | event_attendance: going 5, interested 2 |
| Prod: organiser_invites used / open; series_organiser_invites | 5 / 4; 0 | | person_roles active: teaching 123, dancing 95, djing 39, performing 2 |

## 6. Verified / Not verified

**Verified (actually run or read):**
- `npx vite build` on both trees: exit 0 (MAIN 1m01s, RB 44s), with VITE_ORGANISER_REBUILD unset. Bundle sizes were measured from the build manifests with gzip -9. Lazy chunks are emitted whatever the flag says.
- `npx vitest run src/modules/organiser --reporter=dot` on both trees. MAIN: 145 files, 3926 passed, 2 skipped. RB: 174 files, 4688 passed, 2 skipped. Also the 3 related tests/ files (8 tests) pass on both trees.
- Read-only SELECT counts on prod `stsdtacfauprzrdebmzg` (2026-10-23): series styles, payment, ticket URL, format x lifecycle, organiser pages, claims, seats, time zones, cities, views, attendance, invites, person roles. Also `pg_proc` text checks for `_cmd_series_upsert_p5`, `_cmd_series_cancel_one_off_p5` and `check_owner_command_allowlist_v1`. Counts only, no personal data, no writes.
- Code reading and grep on both trees for every file:line cited (routes, switch, Back targets, read and write paths, query keys, mappers, primitives, tap sizes, date helpers, contrast computed from the token values, e2e list, playwright config).
- Both trees were left clean (`git status --short` = 0 lines).
- The brief blob sha b521f895 matches `origin/brief/er-p2-audits:docs/organiser-rebuild/p2/A-foundation-audit.md`.

**Not verified:**
- The admin repo was not readable. All server-side behaviour comes from `docs/organiser-rebuild/briefs/ER-INTERFACE.md` (AS BUILT section) plus prod `pg_proc` text checks. AD3 and AD4 were not assessed.
- Which RPC raises `viewer_role_mismatch`, and for whom: there is no client mention, and the admin source was not readable. `event_view_p5`'s `p_viewer.role` is the only viewer-role argument the client sends.
- Whether the co-organiser "all equal" model really works on prod. The allowlist function still contains owner-team logic, but nothing was tested with a co-organiser login.
- Whether `series.cancel_one_off` is callable by organisers on prod (the function exists; the permission is untested).
- No browser walk at 390x844 was done. Tap sizes, alignment and contrast come from code and computed values, not a rendered phone.
- Request waterfalls come from reading the code, not from a network trace.
- The invite journey W1-W3 branches (`claude/invite-w1-join`, `claude/invite-w2-phone-ig-golive`, `claude/invite-w3-names-person`) do not exist yet. Only `origin/claude/invite-type-email` was read (12 files under src/modules/admin-organisers/*, none under org/**).
- The e2e suites were not run. The real-supabase and phone specs outside the gate were not run.
- The "about 47" duplicate count and the 8 sub-44 targets come from a manual and heuristic scan, and may be off by a few.
- The admin mirror of event-rules.json was not compared (the mirror check skips without the admin copy).

## Appendix: Evidence notes by area

Condensed. This keeps only details that are not already in the tables above. RB paths unless marked.

**Area 1. Routes and shell.**
- Routes: MAIN:org/shell/OrganiserRoutes.tsx:98-153, RB:111-166. Legacy redirects at RB:162-164. An unknown path goes to Home (:166).
- The rebuilt page is `RebuiltEvent` inside OneEvent (OneEvent.tsx:204-224,257). It has no route of its own.
- Switch:
  - The value is a comma list or `*` (rebuildSwitch.ts:12-20). The owner page decides (:23-28). `null` means OFF (:55). The pending skeleton shows only for a real list (:31-34).
  - Screens that ignore the switch: Details, ProgrammeSeries, Add, Cancel, CoverFlow, the WhichDate pickers, Done, Home, New.
- Crossings: the date row -> changeDate (EventPage.tsx:323), then the old picker (WhichDate.tsx:23-31). Add (:293,337). Flyer (:348). Go-live links (home/onboarding/golive/goLiveModel.ts:109). Old -> new: the Details Organisers row (Details.tsx:205).
- Refresh:
  - Rebuilt draft and date editor: in memory only (EventPage.tsx:101; dates/useDateEditor.ts:80-102).
  - Old Details: saves when each sheet closes (Details.tsx:89,121-130).
  - New event: the seriesId is in the URL (paths.ts:47-55).
  - Done: reload goes Home (flows/doneState.ts:21-26).
  - Edit in place: localStorage (EditInPlaceLayer.tsx:9; draftModel.ts:213). Chosen page: localStorage (switch/useOrganiserChoice.ts:14,23).

**Area 2. Data layer.**
- `series-workspace` callers: useFlow.ts:25, useChange.ts:27, NewFlow.tsx:221, CoverFlow.tsx:39, useDateEditor.ts:74, useOrganiserSeries.ts:110.
- `org-event-workspace` callers: OneEvent.tsx:206,238, Details.tsx:242, ProgrammeSeries.tsx:197, Done.tsx:13, dates/index.tsx:61, WhatChanges.tsx:27.
- The two parsers: eventModel.ts:48 vs seriesModel.ts:81.
- The home query is redeclared at OrganiserRoutes.tsx:95, useFlow.ts:20, useChange.ts:22, eventsApi.ts:19, programmeSeriesApi.ts:51, useOrganiserChoice.ts:39, useOrganiserSeries.ts:107.
- Other reads:
  - `event_view_p5` (selfServeApi.ts:251)
  - occurrence programme, untyped (:312)
  - series cast (programmeSeriesApi.ts:25,37)
  - cancel reasons (:267; keys at cancel/Confirm.tsx:96, change/Pick.tsx:35, dates/index.tsx:42)
  - venues (publicVenues.ts:20)
  - team (teamRpcApi.ts:16,34; browseApi.ts:49; publicTeamApi.ts:18)
  - own profile (src/modules/profile/organiserPublicProfile.ts:77-87)
- Writes:
  - sessions: per date (selfServeApi.ts:323) plus the series programme command (eventPageModel.ts:241)
  - venue: draft create (venueApi.ts:57) plus series.upsert (eventModel.ts:218,439)
  - profile (src/lib/organiserProfileUpdate.ts:100)
  - `city_requests` insert (home/onboarding/dancer4/dancer4Api.ts:25)
  - uploads (flyerUploadApi.ts:25, organiserPhotoUploadApi.ts:26)
  - No direct event-table writes.
- Optimistic updates are version bumps only (useOwnerCommand.ts:47-56). Profile writes the returned row into the cache (EditInPlaceLayer.tsx:290-304). Profile invalidation: EditInPlaceLayer.tsx:288,306, useOwnPage.tsx:99-100, wizardApi.ts:80-88.

**Area 3. State.**
- Draft: `pendingParts` (eventPageModel.ts:169-175). `dirty` (EventPage.tsx:125). Untouched-save tests: er-c8.model.test.ts:63-66, er-c8.page.test.tsx:106, schedule.matrix.test.ts:67-76. Date-editor dirty flag: useDateEditor.ts:127-130.
- Autosave: none on the event page. Organisers saves each action at once (OrganisersScreen.tsx:137).
- Undo:
  - Only a local undo before save (programmeModel.ts:156,310; ui/PersonRow.tsx:49-56).
  - The `undo_conflict`/`not_undoable` copy exists (selfServeErrors.ts:194-195), but nothing sends an undo.
  - D49: no Undo bar (OneEvent.tsx:230).
- Conflict: version on every command (EventPage.tsx:174-181), then EventConflict (useFlow.ts:55; EventPage.tsx:240). Idempotent retry (useFlow.ts:42-53).
- The 17 mappers:
  - selfServeErrors.ts:122,223,321,385,248,211,241
  - goLiveCheck.ts:140
  - organiserApi.ts:36-44
  - venueApi.ts:36
  - publicTeamApi.ts:45
  - teamErrors.ts:9,17
  - flows/newpage/model.ts:15
  - cancelModel.ts:30
  - teamPickerModel.ts:165
  - draftModel.ts:288
  - dancerApi.ts:47
- W5 date chain: `event_view_p5` with `p_viewer:{role:'organiser'}` (selfServeApi.ts:250-256), via useChange.ts:39-55. On a write, the same code gives "Something went wrong" (selfServeErrors.ts:108-110,233). MAIN has the same defaults (MAIN:org/ui/States.tsx:42, dates/index.tsx:152).

**Area 4. Normalisation.**
- Music vocabulary: `MUSIC_STYLES` (8) and `MUSIC_VOCAB` (+Urban Kiz, Cuban, musicModel.ts:11). `keyOf` is used only by MusicEdit.tsx:24. Music is not in event-rules.json. MAIN is unaffected (no EventPage.tsx).
- Prod spellings: the biggest are bachata 56/37 vs Bachata 52/24 and sensual bachata 27/17 vs Sensual Bachata 25/11 (all/live). `zouk`, `bachata sensual`, `hip hop`, `cross body salsa` and `Bollywood` are not matched even by keyOf.
- Pay methods: one mapping (event-rules.json:24-33; eventRules.ts:159-177).
- Levels: organiser (programmeModel.ts:23,47-53), dancer (wizardModel.ts:32), public (src/components/search/LevelFilter.tsx:9; src/modules/event-page/useFestivalDetailQuery.ts:85). `default_level` is free text (eventModel.ts:36,58).
- Ticket labels: also "Tickets" (eventModel.ts:394,398) and "Ticket link for this date only" (changeModel.ts:228).

**Area 5. Components.**
- `ui/**` is byte-identical on both trees. DESIGN-base.md describes the public site (amber #FF9900, Inter), not Ember (#f0703a, graphite #202226, Outfit). The binding organiser spec is still ARC.md (RB:docs/organiser-rebuild/ARC.md:61-80,205-241).
- Importers: Card ~86, PrimaryButton 56, SheetView 17, SummaryRow 8, TitleInput 1, AttentionStrip 0.
- Copy locations for rows, buttons and frames are in G23 and Numbers; the full list is in the F-UI working notes.
- Date wrappers: homeModel.ts:66,70; teamModel.ts:144,152; ui/londonDate.ts:19; eventModel.ts:73; draftModel.ts:371.

**Area 6. Error / empty / loading.**
- Counts: SkeletonRows 47 in 30 files; ErrorState 34 in 27 (role=status, not alert); NoAccess 21; EmptyState 16; `role="alert"` 56.
- Hand-rolled `<p>` states exist, e.g. flows/newpage/NewPageFlow.tsx:178-181.

**Area 7. Accessibility.**
- Ember: mut 6.74/5.84/5.06; gold-fg 6.40/5.55/4.81; danger 6.26/5.43/4.70; line-strong 4.11/3.57/3.09.
- SheetView: focus trap and return (:83-85,123-129), Escape (:130-135), nesting guard (:68-72). FieldSheet re-implements the trap (:102-118).
- 3 icon-only controls, all labelled.

**Area 8. Performance.**
- The area is lazy (MAIN:src/components/AnimatedRoutes.tsx:47), with 23 lazy screens (MAIN:OrganiserRoutes.tsx:19-41).
- Home waterfall: home prefetch (RB:OrganiserRoutes.tsx:61-68) in parallel with the gate (src/lib/accountGate.ts:54), then the home chunk, then access requests (home/useHomeData.ts:23-29). That is about 3 hops.
- MAIN event: home and ws in parallel (MAIN:events/OneEvent.tsx:207-208), then profile progress (:213).
- The venue list falls back silently to the public one (shared/publicVenues.ts:26-31). Sheet height is `min(85dvh, cap)` (SheetView.tsx:98,103).

**Area 9. Observability.**
- The reporter sends `report_client_error_v1` (clientErrorReporter.ts:219) and is installed on idle (MAIN:app/root.tsx:204-206).
- Mutations are reported as `save_failed` (MAIN:App.tsx:40-45). The stale Sentry comment is at MAIN:src/App.tsx:25-27.
- Rows go to `client_error_log`/`client_error_reports` (MAIN:src/integrations/supabase/types.ts:705). docs/account-system/GAPS.md:27 records 0 relevant rows in 30 days.

**Area 10. Tests.**
- Gate specs (package.json:70 MAIN / :72 RB; e2e-smoke.yml:84): onboarding, home, events, date, team, profile, legacy-redirects, layout, loop, tap-targets. Outside the gate: organiser-real-rpc, the 2 real-supabase specs, organiser-launch-walk, 5 e2e-phone specs.
- Vacuous examples:
  - ownershipApi.contact.test.ts:33-36
  - goLiveSession.matrix.test.ts:93-95
  - fixSw1.matrix.test.tsx:85-87,162-164
  - s5.scan.test.ts:41-47
  - ProfileWizard.test.tsx:184-191

**Area 11. Launch scope.**
- Stats:
  - Recorder: src/modules/event-page/useRecordEventView.ts:30, behind `flags.enableEventTracking` (:14).
  - `event_views` can be read anonymously (sections/MoreEventsSection.tsx:108-111,185).
  - Attendance counts: MAIN:src/components/EventAttendanceButtons.tsx:30.
- Line-up: real-profile search (selfServeApi.ts:350-361; peoplePicker.ts:42-56). SessionCard.tsx:83,232,240 refuses free text. `emitProfileView` is correctly only on the public chips.
- MAIN co-organisers are owner-only (MAIN:org/events/organisersModel.ts:13,20).
- Publish:
  - `A1_APPLIED = true` (a1Gate.ts:3), and `liveCommands` (flows/new/model.ts:55).
  - pending_review is never sent (seriesCommands.ts:252).
  - `submitOrganiserProfile` (selfServeApi.ts:222) has no caller.
- London:
  - Hard-coded at ui/londonDate.ts:4, draftModel.ts:373, teamModel.ts:144, utils/raffleCountdown.ts:108.
  - UK postcode lookup only (venue/addVenue.ts:1).
  - Counts in org/**: `Europe/London` 4/4, `londonDate` 27/28 (MAIN/RB).
- Invite journey:
  - Redeem goes to welcome or home (MAIN:src/modules/admin-organisers/InviteRedeemPage.tsx:223,306).
  - Matching is automatic at page level (`admin_issue_organiser_invite_v1` -> seat -> `organiser_home_v1`).
  - Pilot coupling: in the 5 live two-page series, the co-organiser sees whatever the owner page (`organiser_ids[0]`) gets.
