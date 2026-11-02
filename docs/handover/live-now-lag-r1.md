# Handover: live-now-lag-r1

**Done (r1):** `docs/design/live-now-lag/INVENTORY.md`,
`docs/design/live-now-lag/PLAN.md` (measurement, root cause, options A/B/C,
Live-now check, recommendation C + check, acceptance matrix). Docs only.

**Done (fix round, 2026-11-02, review `docs/review/live-now-lag-r1.md` BLOCK):**
- F1: the Live-now check no longer reads a `version` that does not exist. PLAN
  now states it needs (1) an admin migration adding `version`/`updated_at` to
  `event_view_p5`'s public payload + contract check, (2) a loader change in
  `app/routes/event.tsx`, (3) slug + saved version plumbed into `DoneState`;
  counted in option C's cost. Comparing content fields is rejected
  (cancel-then-restore false positive).
- F2: option C hard-deletes ONLY `event-<id>`; `city-<slug>`, `seo-landing`
  (and `home-feed`) stay on the soft `invalidateByTag` + CF 300 s TTL.
  Cost restated as one cold SSR of one event page; the full-list cost (up to
  11 cold renders incl. the busiest route) stated as the reason. Existing
  hidden-event path left unchanged.
- F3: inventory rows #17-#22 added (`/tonight`, search, parties, classes,
  venues list, organisers list); count restated (22 public + 9 organiser =
  31 rows; 28 public if each route path counted); "none silently omitted"
  withdrawn.
- F4: `/event/:id` ended/on-now marked NOT covered (no TTL bound), new gap G7,
  optional C step 4 (bound like `home.tsx`).
- F5: poll ships only after the narrowed hard delete; no cache-busting query.
- F6: "10-20 s" restated as settle 10 s + render (estimate); pg_net retention
  numbers from both runs.
- F7: option A diffs against `occurrenceEffective`, one status mapping.
- Matrix: added OG head tags, SEO landing, `/tonight`, ICS/embed, open tab;
  states venue moved, cancel-then-restore, slug change; which tags go to
  which call.

**Verified:** every newly cited file:line read on `main` (`b012205`):
`api.revalidate.tsx:142`, `cacheTags.ts:174-181`, `edgeCacheControl.ts:120`
(busy-route comment), `api.revalidate.test.ts:136`, `doneState.ts:4-12`,
`cloudflarePurge.ts:285,412-416`, `AnimatedRoutes.tsx:141-142,182-192,302-303`,
`Tonight.tsx:138`, `Venues.tsx:496`, `Organisers.tsx:268-324`,
`react-router.config.ts:28-42`, `Parties.tsx:54`, `Classes.tsx:55`.

**Not verified:** prod was NOT re-queried this round (the `event_view_p5`
no-`version` finding is the reviewer's prod read); live response headers
(proxy still blocks prod); search page hook staleTime; React Router 7 `.data`
single-route URL shape; what an old slug URL serves after a slug change;
whether `/venue-entity/:id` SSR embeds its event list. No CI run locally
(docs-only change).

**Note for owner:** PR #1260 still carries the `automerge-ok` label from r1; the
brief says not to add it and this worker did not touch labels &mdash; remove it
if it should wait for a re-review.

**Next steps:** (1) re-review of PLAN.md (F1/F2/F3 edits); (2) 30 s header
probe from an allowed network against a TEST event; (3) admin repo:
`stateChange` in the emit payload, venue + organiser emits, public `version`
on `event_view_p5`; (4) this repo: narrowed hard delete, warm `.data`, then
loader + `DoneState` plumbing + Live-now poll.
