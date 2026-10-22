# ER-FIX-W2: one fix (or rebuild) worker per slice, from the 8 audits

DRAFT by the orchestrator 2026-10-22. NOT dispatched. Nothing is dispatched until every audit has a verdict (public audit dt_98c62003061c was still running when this was written) and the owner has approved the order below.

Each worker owns ONE slice and ONE branch, reads ONLY its own section plus its own audit file, plus ER-COMMON.md and ER-INTERFACE.md (AS BUILT wins) on `arc/briefs-organiser-r1`. Audit files live on the audit branches: `git fetch origin claude/audit-er-<family>` then `git show FETCH_HEAD:docs/organiser-rebuild/er/audit/ER-AUDIT-<family>.md`.

## Owner decisions (binding, all slices)
1. Festival create is ON: `ownerCreateFormats` = one_off, recurring, festival in BOTH copies of `event-rules.json` (the Website copy is owned by S1; the admin copy is carried by ER-C13). Course stays OFF ("Not available yet"). New event reads `ownerCanCreate(format)`, never its own list.
2. The rebuild switch is PER EVENT: an event's organisers all get the new screens when its owner page is on the allowlist (keeps co-organiser full control). New event has NO gate (everyone, once ready); so New event merges LAST, and only after AD2 is applied on prod.
3. Untimed sessions are VALID on live series (223 untimed items in prod). Block only a half-filled time or an end before the start (next-day pairs are fine).
4. Everyone on an event has FULL control (no owner-only gating on screens).
5. Retried invite or cancel counts as SUCCESS (`already invited/linked`, `this invite is no longer open`): show success and refetch.
6. The festival artist list is read-only after the event ends, and the screen says so.
7. The public festival line-up does NOT read the new festival-artists storage.
8. Server truth is ER-INTERFACE.md AS BUILT plus `ER-AD2.md` on admin `claude/er-ad2-admin` (AD2 is not applied on prod yet: write the screens against it, say "needs AD2" where a control depends on it).

## Rules for every worker
- Merge `origin/main` FIRST (every ER branch is about 18 commits behind; Ember UI files conflict). Then merge the finished heads this slice depends on (see ORDER).
- Fix each finding with a test that is RED on the unfixed code first; say so in the handover. A finding you disagree with gets a one-line reason in the handover, never a silent skip. Tests that pin a SUPERSEDED rule are rewritten, not deleted.
- Table-driven tests over the real shapes in the audit's "shapes" section. No fixture-only claims: list in the handover which shapes were checked and which were not.
- ADD to public exports, never rename (other slices import them). Do not edit `event-rules.json` outside S1.
- Calendar and its listed density-exempt files: content only, ask before touching.
- Entities (`&mdash;`) not raw Unicode punctuation. Explicit px for tap targets (44px).
- ONE push at the end, preferably with `[skip preview]` on all but the final push. Run every CI job step in the sandbox (read `.github/workflows`), per-job table in the handover. No labels, no PR by hand (bot PR), never merge, no prod writes (SELECT only).
- Handover `docs/organiser-rebuild/er/handover/ER-FIX2-<slice>.md`: per finding fixed / disagreed / parked, red-first proof, Verified / Not verified. Last commit subject ends `[worker-done <ticket>]`.

## ORDER (a slice starts only when what it depends on has pushed)
1. In parallel (independent): S1 rules-shell, S2 C4 sessions, S3 C5 venue.
2. Then S4 C11 co-organisers, S6 C9 dates (both merge S1+S2+S3 heads first).
3. Then S5 C8 event page (mounts the FINISHED S4 organisers screen; merges S1-S4, S6).
4. S7 public (C6) any time after S1 (needs the shared rule), no screen dependency.
5. S8 New event + festival REBUILD last (needs S1-S6; merges after AD2 is applied).
Cap: at most 2 workers per orchestrator session; cards.mjs cap 3 in flight.

## S1 rules-shell (branch claude/er-s1-rules; audit ER-AUDIT-rules-shell.md)
Findings: labels and not-found wording vs prototype v7; 5 AD1 server codes unlabelled in `shared/goLiveCheck.ts`; `ownerCreateFormats` festival ON (decision 1); ticket link chosen with no URL must NOT read ready; untimed first-date session must not read "Session times invalid" (decision 3: fix `eventRules.ts` sessionTimes/validSessionPair, table-tested incl. the untimed shape); switch is per event (decision 2: co-organiser of an allowlisted owner page gets the new screens) and no flash while the home read loads; the mirror check stays KEEP (do not wire it). Also export `ownerCanCreate`, `maxSessionMinutes` if not already.

## S2 C4 sessions (branch claude/er-c4-sessions; audit ER-AUDIT-editor-cards.md, C4 part)
F-C4-1/2 untimed shown as an error and no way back to "No set time" (decision 3); F-C4-3 start-set/end-null shows a false 20:15; F-C4-4 failed line-up search says "No one called X" (needs "Search failed" + Retry); F-C4-5..10 (re-sort on change, cap and last-remove hidden without a reason, room Remove clears ALL rooms, eslint no-control-regex at SessionSheetFix.test.tsx:111, legacy kind `show`, unsaved-changes confirm). Two tests pin the wrong untimed behaviour: rewrite them. Keep `fromStored`/`toStored` exports (festival and dates use them).

## S3 C5 venue (branch claude/er-c5-venue; audit ER-AUDIT-editor-cards.md, C5 part)
F-C5-1 (major): "Add a new venue" is 4 steps, prototype v7 wants ONE sheet. Keep the error mapping from ER-FIX-W1 (rate limit `54000` / `rate_limited`). The venue-options read returning other people's drafts is parked (AD question), do not fix.

## S4 C11 co-organisers (branch claude/er-c11-organisers; audit ER-AUDIT-co-organisers.md)
F1-F12 plus decisions 4 and 5. F1: keep main's SW1 organisers screen and choose the new one by `useRebuildSwitch`; show "unavailable", not a generic error. F2/F3: retries are success. F4: dead invite on Home refreshes on settle and reads "withdrawn". F5: the no-organiser event (571) must not tell the event's own team they are not on it. F6: owner-only table and copy become full control. F7: rewrite tests pinning the old rules. Withdraw the C11 handover line telling C12 to hide End/Stop/Delete/Cancel from co-organisers. Prod "0 links across 120 series" is likely RLS-limited: do not trust it.

## S6 C9 dates (branch claude/er-c9-dates; audit ER-AUDIT-dates.md)
F-C9-1..14. Blocker F-C9-1: "Copy changes from another date" cannot save a date holding an untimed or untitled session (prod 223 untimed, 239 untitled): the copy must carry them (decision 3). F-C9-2 copy must not delete all series sessions on the target. F-C9-3 "Take this date off" becomes remove (rule 9). F-C9-4 can add an untimed session. F-C9-5 read the rebuild switch (per event). F-C9-8 one-off move reuses `flows/change/Day.tsx` moveDays. F-C9-9: verify in admin `organiser_set_occurrence_programme_v1` whether a time shift moves the occurrence's own start; else send `occurrence.set_time`. Duplicates (two copy, move day, change time, take off) become one each. OPEN QUESTION F-C9-6 (one-off "Cancel the event" sends occurrence.cancel but v7 means event END, which leaves a live series with no coming date): read the AD2 handover for the server command that ends an event; if none exists, PARK it, do not guess.

## S5 C8 event page (branch claude/er-c8-eventpage; audit ER-AUDIT-event-page.md)
EP-1 `pageActions` gated on `owner`: full control (flip er-c8.model.test and er-c8.page.test:230, which pin the wrong gate). EP-2 key EventPage on series.id not series.version (a half-failed save must keep the draft and error). EP-3 "Ticket link" chip needs a URL field. EP-4 mount the FINISHED S4 organisers screen. EP-5 leave prompt via `useBlocker`. EP-6 add payment_methods to OWNER_UPSERT_KEYS. EP-7 Pause/End/Resume go to the new sheets; one-off says "Cancel the event". EP-8..14 minor. Re-count the shapes (C8 handover live 67 / ended 21 / archived 653 disagrees with ER-COMMON).

## S7 public (REBUILD, new branch claude/er-c6-rebuild from main + S1; audit ER-AUDIT-public.md, head 956a74f6 on claude/audit-er-public)
Verdict REBUILD: of the eight facts C6 owns only the payment line is wired and it never prints (P1); festivals render `FestivalDetail.tsx`, which C6 never touched (P2); byline wrong (P3); workshop count reads a field no public event has (P4); calendar row unwired (P5); perf chunk ratchet red on `/event/:id` (P6); tests vacuous (P9, mutation survived). KEEP the file `publicFacts.ts` (single mapping) but fix it: take `string | string[]`, delete `cancelledLine` (use `src/lib/cancelLabel.ts`), move `timetableSoon` onto the real programme/session source.

ORCHESTRATOR FINDINGS AFTER THE AUDIT (admin repo read, these override the audit where they differ):
- SERVER GAP 1 (payment): the event page reads `event_view_p5(snapshot_compat)`, whose latest body (admin 20261112020000) HARDCODES `'payment_methods','[]'`. No public read returns the stored `event_series_p5.payment_methods` text (comma list of codes) that AD1/AD2 now let organisers save. So P1 is NOT only a client parse bug: no client change can print a pay line until a server read serves it. Rule-guard words (payment, rpc): the worker must NOT guess; it builds the client against a pinned shape (text comma list of codes, same as `series.series.payment_methods`) and says "server not landed".
- SERVER GAP 2 (byline): AD2 item 4 (admin `20261203050000_er_ad2_co_organiser_public_byline_v1.sql`) adds `organiser_byline` + `byline_organisers` (owner first, accepted co-organisers, live pages only) to `get_public_event_detail_v2` and `get_calendar_events_v2`, but NOT to `event_view_p5`, which the event page uses; `event_view_p5` orders organisers by NAME (so "first organiser" is alphabetical, not the owner). So: the calendar row can read `organiser_byline` once AD2 is applied (P5 byline, no client derivation); the event page and `FestivalDetail` need the same keys in the read they use. Never derive the byline client-side from snapshot order.
- Level and pay on the calendar row also need server fields: ask, do not guess.
- Until an owner decision on AD3 (the server read for event_view_p5 payment + byline), S7 may ship only the parts that need no server change: cancelled reason everywhere (P7, P8, `DayDetailModal`), `FestivalDetail` "Timetable coming soon" from the real programme (P2/P4), perf chunk fix (P6), render tests (P9), calendar byline from `organiser_byline`.
Tests: render tests of `DescriptionBlock`, `FestivalDetail`, `DatesBlock`, the calendar list row and `DayDetailModal` over the real payload shapes (payment text AND array, 1 and 2 organisers, cancelled with reason / with "Other" / without, festival with parties and no workshops), fixed expected strings, RED on the unwired code first; `node scripts/check-bundle-budget.mjs` green before the push. Calendar files are density-exempt: content only, ask Ricky before touching.

## S8 New event + festival REBUILD (new branch claude/er-c7-rebuild, based on current main; audits ER-AUDIT-new-event.md and ER-AUDIT-festival.md)
Fresh worker, NOT a fix of claude/er-c7-new or claude/er-c10-festival. Keep the pure helpers the audits name (dateCommands, venueCommands, togglePayment, ticketLinkProblem, "untouched sends nothing"; festival: FestivalNights, FestivalArtists + festivalApi.ts, nightInstant/startsAt/endsAt + the BST table, each with the audit's FIX). Requirements: a new directory with a switch-gated route (old flow stays); WhichPage step and profile bridge; shared `eventRules`, `useNewSend` with `withSeriesName`, shared `goLiveCheck` in its real shape (`{ready, event_missing:[{code,section}], recommended, profile_rule_applies, profile_missing}`); the 9 prototype v7 steps; festival is a FORMAT of this flow (days or nights step, festival pay step, ownerCreateFormats read from the rule); ONE programme wire mapping via S2's fixed `fromStored`/`toStored` (room, times, untimed); read back stored payment and stored sessions on revisit; every festival day carries the right `day_index` and `date_offset_days` (F1: a new day lands on day 1 today); untimed items are never rewritten to 12:00-13:00 (F2); removing a non-last day keeps the ids/room/theme/style/track of moved sessions (F3); ended festival is read-only with a line (decision 6); error mapping and EventConflict; no festival create reachable from anywhere else. Table tests over lifecycle x day count x timetable x BST, run against real-shape fixtures FIRST. Open question from the audit: a draft's first date may have no occurrence row until the server materialises it (AD2 `...03030000` fixes it once applied): do not work around it client-side.
