# B1b COMMON (Website, release 1b of the dancer app). Read after dancer-rebuild-COMMON.md; this adds, never relaxes.

B1a (closed `/app` area) is MERGED on main. B1b adds three independent slices, each on its OWN branch cut from
`origin/main` (c36fbafd):
- S1 Going lock   -> `claude/dancer-app-r1b-lock`   (brief dancer-rebuild-b1b-s1-lock.md, Opus)
- S2 Public page  -> `claude/dancer-app-r1b-public` (brief dancer-rebuild-b1b-s2-public.md, Opus)
- S3 App screens  -> `claude/dancer-app-r1b-app`    (brief dancer-rebuild-b1b-s3-app.md, Sonnet)
The orchestrator merges the three into `claude/dancer-app-r1b` (never you). NO PR from a slice worker.
Slices share NO file. If you need a file another slice owns, STOP and write it in your handover.

## What already exists on prod (A2 is merged AND applied)
Read exact return shapes from `src/integrations/supabase/types.ts` and from `pg_proc` via the read-only Supabase connector
(prod id stsdtacfauprzrdebmzg). Functions:
`submit_feedback_v1(p_body, p_kind='general', p_page=null)` (area_closed; rate_limited at 5 a day),
`register_feature_interest_v1(p_feature)` + `my_feature_interest_v1()` (feature key `partner_search`),
`my_profile_views_v1()`, `my_dancer_stats_v1()`, `accept_terms_v1(p_kind,p_version)`,
`get_public_dancer_extras_v1(p_profile_id)`, `record_profile_view_v1` (already used by `src/lib/profileViewEmit.ts`:
REUSE it, never add a second recorder). Gate = `useDancerArea()` (`open`, `allowed`).
The flag `dancer_area_open` is TRUE on prod (owner confirmed it is intended), so anything "only when open" goes LIVE for
every visitor the moment it is merged. Write every shape you rely on into your handover (the reviewer checks it against prod).

## Rules for all three (owner, 2026-10-17)
- The owner is a beginner: every user-visible sentence is plain words; every empty state says what the person CAN do;
  a control that cannot work is disabled WITH a visible reason; no text points at a control that is not on screen.
- ONE push at the end (plus one PARTIAL push if you hit 30% context). No WIP pushes (Vercel 100 deploys/day cap; `claude/*`
  sub-branches build nothing, but still push once). Last commit subject ends `[worker-done <ticket>]`.
- Handover file `docs/handover/dancer-rebuild-b1b-<slice>.md` on your branch (sections per dancer-rebuild-COMMON.md).
  A continuation worker is normal: write "what is left" so a fresh worker can finish.
- Survey prod read-only first (counts only) for the shapes your slice meets; list them under "Shapes surveyed".
  Known 2026-10-17: dancer profiles with/without photo, hidden surname, paused, nameless, admin-made unclaimed;
  `dancer_area_access` has 1 row; flag open = true.
- Tests: table-driven, shape x screen; red-first proof for each bug-shaped test (show it FAILING on the unfixed code).
  Run EVERY job step in `.github/workflows` and `npm run build`; per-job table in the handover. A GitHub payments
  annotation is not a code failure. Plain `git`, never `gh api`; commands without variables/loops/`$(...)`.
- Screenshots at 390x844 of every changed screen on realistic data into `docs/review-pack/r1b-<slice>/` (committed, small PNGs,
  <= 150 KB each) with `captions.md` (one line each: what to look at). Real browser against the built app (`npm run build` + preview).
