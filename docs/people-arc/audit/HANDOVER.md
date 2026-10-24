# People arc P0 audit -- handover

- Branch `claude/people-arc-audit` (from main `fe77e93`). Docs only, everything under `docs/people-arc/audit/`.
- Report: `docs/people-arc/audit/REPORT.md`. Shapes: `shapes.md`. Gallery: `gallery.html` (198 screenshots in `shots/`).
- Re-run: build main and #963 with prod Supabase reads (`react-router build`, flags as in REPORT header), serve each
  with `node scripts/_serve-build.mjs --port 5201|5202`, then `node docs/people-arc/audit/capture.mjs`,
  `node docs/people-arc/audit/journeys.mjs`, `node docs/people-arc/audit/gallery.mjs`.
  Do NOT run two `react-router dev` servers off one node_modules: they share the Vite deps cache and render
  "Invalid hook call" errors that look like product bugs.

## Shapes covered
20 shapes (19 live + archived): each single role, each pair, all three; photo / none; gig / none / 2+ / 4;
claimed; long names (17-21 chars); empty bio/languages/nationality (nearly everyone); no public role; archived.

## Not covered (why)
- dancer+dj+teacher without a photo, claimed dancer-only / teacher-only: zero on prod.
- a person with a bio (9 on prod): not picked; bio paths traced in code only.
- real photos: image hosts unreachable from the sandbox, so failure paths were captured.
- live prod site and Vercel flag values: egress blocked (needs owner: Vercel token / network allow-list).
- wall completeness against the 100-row cap.

## Two findings that need action before anything else
1. #963: wall -> hub -> role page crashes ("Something went wrong", React removeChild NotFoundError). Blocks #963 merge.
2. Teacher pages 404 for teacher-only people (63 of 170 live people) once the teacher pages open. Present on main.

## Process note
One stray statement ran on the prod connector: `create temp table if not exists _x as select 1` (session-local temp
table, no persistent write). Every other query was SELECT-only.
