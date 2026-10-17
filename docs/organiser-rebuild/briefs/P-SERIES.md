# Brief P-SERIES -- parity fix pass, everything about the EVENT as a whole (Website)

Repo `123constante/bachata-website`. Branch `claude/org-r1-parity-series`, cut from `claude/org-r1-integrate` (head e04dea0 or newer). Push ONLY that branch, ONCE at the end (plus one PARTIAL push if you hit the context limit; a continuation worker per slice is normal). Plain git only (never `gh api`), commands without variables/loops/`$(...)`, never `--no-verify`.

READ FIRST: `git show origin/claude/org-r1-parity:docs/organiser-rebuild/PARITY-GAP.md` (rows C06, C09b, C14, C16, C28a, C28b, C30b, C38, C40, C69 and the "(b) smallest change" table), `docs/organiser-rebuild/briefs/00-COMMON.md`, appendix `parity/commands-roles.md`. Another worker (P-DATES) runs in parallel on `claude/org-r1-parity-dates`; do NOT touch its files (below).

## Owner mandate (2026-10-17)
"Be complete with all the features that the admin editor has" for everything an organiser is ALLOWED to do on prod (owner/manager). Admin-only stays out. The owner will judge on a phone, so build every row below.

## Build (all, with audit row ids)
1. **Go live on a draft (C28a, C28b).** New `events/LifecycleActions.tsx` mounted by ONE line in `events/OneEvent.tsx`: for `lifecycle_status='draft'` a "Go live" action (`set_lifecycle live`), DISABLED with the missing item named (use readiness: `event_publish_readiness_v1`; if it lacks cover/session rules, compute the checklist client-side from the event and say what is missing). Also the wizard's last step (`flows/new/model.ts:48`). Owner draft->live is refused on prod until admin A1, so BOTH are behind `A1_APPLIED` (below): when false the button is disabled with the reason "Needs the next platform update" (plain words, no jargon) and the wizard saves as draft and says so. Home `stale_draft` (jobs/homeJobs.ts:84) must lead somewhere that can act.
2. **Discard a draft (C30b)**: in LifecycleActions, `set_lifecycle archived` for drafts, with a confirm step inside the page (no browser confirm).
3. **"See it live" link (C38)**: on `flows/Done.tsx` and LifecycleActions, a link to the public event page (live events only; disabled with reason for a draft).
4. **Remove "Show your WhatsApp" (C69)**: delete the `show_whatsapp` step in `jobs/homeJobs.ts:94-96` and anything pointing at it (the field never exists); test that no Home job names a missing control.
5. **Gallery + videos (C06)**: `events/Details.tsx:106,138` open the existing sheets in `events/EditorSheet.tsx:105,138`; implement `onUploadGallery`; `series.upsert default_gallery / default_video_urls`. Respect `check:images`.
6. **Stop repeating with "until" (C16)** in `flows/event/EventStep.tsx` (`set_recurrence` until / `stop_repeating` keep-list) and **Make it weekly (C40)** for `recurring` series with no rule (`series.set_recurrence`), 9 such live series.
7. **Usual end / length (C14)**: optional end on the Details "Time" row -> `default_duration_minutes`; first VERIFY on prod what it does to sessions (the audit asks you to); show the consequence in copy ("Every coming date keeps this length. Dates you changed by hand are left alone.").
8. **Price list (C09b)**: "Prices" row in Details -> `default_passes` (name, price, how many); owner chose completeness, so build it. Empty state says what the person can do. Verify the pass shape against the admin editor (`P/FestivalPassesEditor.tsx:118`) and prod.
9. **Parity matrix test (AFTER the above, last)**: `src/modules/organiser/__tests__/parity-matrix.test.ts` as specified in PARITY-GAP.md section (c): one `PARITY` table of ALL rows (this slice's AND P-DATES' rows; mark P-DATES rows with `owner: 'P-DATES'` and `it.todo` until integration fills them), every MATCH/PARTIAL row names its screen + command + payload keys + a reachability path; fails when a row lists a screen that no route reaches. Prove it can fail (mutate one row, paste the red output).

## Pinned interface with P-DATES
- `src/modules/organiser/shared/a1Gate.ts`, BYTE-IDENTICAL in both branches. If absent on your base, create exactly:
```ts
// Flip to true in the merge train once admin A1 (migration 20261126190000) is applied on prod.
export const A1_APPLIED = false;
```
- You own: `events/Details.tsx`, `events/EditorSheet.tsx`, `flows/event/**`, `flows/new/**`, `flows/Done.tsx`, `jobs/homeJobs.ts`, NEW `events/LifecycleActions.tsx`, the parity test. P-DATES owns `flows/change/**`, `flows/cancel/**`, `dates/**`, `events/EditorRows.tsx` and the dates part of `events/OneEvent.tsx`. You add ONE mounting line in OneEvent.tsx; nothing else there. `shared/seriesCommands.ts`, `shell/paths.ts`: additive hunks only.

## Rules that bind
Same as P-DATES.md "Rules that bind": red-first with pasted failing output; consistency matrix across screens x shapes (draft/live/paused/archived x one date/weekly/recurring-no-rule x 0/1/many coming dates x with/without cover, gallery, passes); prod-shaped survey (read-only, counts: 6 drafts of which 4 older than 7 days, 15 series with gallery, 14 with videos, 3 with passes, 44 weekly, 9 recurring without a rule); run EVERY CI job step yourself and give the per-job table (GitHub may refuse jobs for billing, that is not a code failure); PRODUCTION build; 44px px-sized tap targets; `&mdash;` entities; prod SELECT-only counts only; context under 30%, PARTIAL at the limit.
Handover `docs/organiser-rebuild/handovers/P-SERIES.md`: done / left / CI table / red-first evidence / Verified-Not verified / decisions with reasons.
