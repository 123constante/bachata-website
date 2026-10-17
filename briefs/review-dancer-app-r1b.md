# REVIEW of B1b (Website) — read-only independent review. Branch for your output: claude/review-dancer-app-r1b (from claude/dancer-app-r1b). Model: Opus.
Read dancer-rebuild-COMMON.md and dancer-rebuild-b1b-COMMON.md first (briefs branch arc/briefs-dancer-rebuild, `git fetch origin arc/briefs-dancer-rebuild`, `git show FETCH_HEAD:briefs/<file>`).

## What you review
`origin/claude/dancer-app-r1b` (head d9828bda) = main c36fbafd + three slices merged: S1 Going lock (`gate/useGoingLock.ts`, RsvpBlock,
RsvpBlockPlaceholder, FestivalHub), S2 public dancer page v2 (`public-page/`, `app/routes/dancers.tsx`, `src/pages/DancerProfile.tsx`),
S3 app screens (Home stats/views/partner tiles, `/app/page`, in-app feedback, api/*). The authors' handovers are in
`docs/handover/dancer-rebuild-b1b-{lock,public,app}.md`. They are CLAIMS. Check each against the code and against prod (read-only).

## Questions to answer with evidence (file:line, command, quote)
1. **Public page v2 goes live to EVERYONE on merge** (prod flag `dancer_area_open` = true). Compare old vs new page for every shape
   (photoless, hidden surname, nameless, paused/hidden/archived => same not-found, admin-made unclaimed, long names): does any section,
   link, `<head>` tag, JSON-LD field, og tag, canonical or noindex rule differ? Pick 5 REAL live dancer slugs from prod (read-only, no
   personal data in the doc) and render old (`origin/main`) vs new with the built app; diff the server HTML head.
2. **Going lock**: can a person who SHOULD be able to say Going be blocked (loading, error, organiser, complete profile, linked-profile
   shapes)? Can an old RSVP be removed while locked? Does the event-route first-load grow by <= 0.5 KB gz (run the bundle check on main vs branch)?
3. **S3**: do the RPC wrappers match the REAL function signatures and return shapes on prod (`pg_proc`, a read-only SELECT of the function
   source)? Are error codes mapped (area_closed, rate_limited, no_profile, not_signed_in)? Does the feedback form send nothing on empty
   input, double-tap, or offline? Does Home read the SAME numbers as `/app/page` through one mapping?
4. **Isolation**: S1 needs `src/pages/FestivalHub.tsx` to import `gate/useGoingLock` and be a seam; `scripts/dancer-area-isolation-allowlist.json`
   does not list it, so `npm run check:dancer-area-isolation` fails (a) and (c). Decide the exact allowlist edit and whether any OTHER
   non-seam file was touched (list them). Do not edit it yourself.
5. **Privacy**: any new path that exposes a hidden surname, WhatsApp number when not allowed, email, or a paused profile? Any new request made
   by a signed-out visitor on `/dancers/*` or the event page that did not exist before?
6. Anything the owner would see on a phone that is wrong, confusing or jargon (read the user-visible strings), and any control that cannot
   work without a visible reason.

## Output
`docs/review-pack/review-dancer-app-r1b/REVIEW.md` on your branch: a table of findings (ID, severity BLOCKER/MAJOR/MINOR, file:line, what,
how to fix in one sentence), then "Checked and fine" (what you proved), then "Not checked". Use plain words; the reader is a beginner.
You change NO product code. One push, last commit subject ends `[worker-done <ticket>]`. Do not open a PR. Stop after the push.
