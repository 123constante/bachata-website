# People arc S7 -- roles in the /dancers/:id loader (kill the DJ-holder page shift)

Orchestrator 2026-10-24. Branch `claude/people-dancer-roles-in-loader` (new, from origin/main; S6 #1008 is merged). Lane: normal (no SQL, migration or RPC change; the RPC already exists and is already called by /people/:id). If you find you need SQL, STOP and say so in the handover.
Worlds sit behind `flags.personWorlds` (OFF on prod). Flag OFF = the old dancer page and the server HTML for it must stay byte-for-byte identical.

## Why (measured, S6 critique `docs/design/people-s6-critique.md`, finding 1)
On /dancers/:id with the flag ON, the role tabs (52px) and the 64px "dates loading" reserve appear ~1.7s after load because `usePersonSnapshot` reads `get_public_person_roles_v1` client-side after mount. Layout shift (CLS) is 0.13-0.16 on the 40 of 174 dancers who also DJ (0.05 on main for undated DJs), above Google's 0.1 line; dancer-only pages are 0. The DJ page is 0.056, the teacher world 0.005 (it holds the tabs row).
Owner choice 2026-10-24: fix it in a follow-up (this PR).

## Build
1. In `app/routes/dancers.tsx` loader, ONLY when `flags.personWorlds` is on: read `get_public_person_roles_v1` for `ref.id` (the same read `src/modules/person-page/reads.ts` makes, same query key as `usePersonSnapshot` and the `/people/:id` loader) and put it in the dehydrated state, so the served HTML already contains the tabs and the reserve row for a person who holds teacher/DJ. Copy how `/people/:id`'s loader does it. Reuse the existing read function, do not write a second one.
2. It must NEVER reject and never block the page: its own short deadline (copy `loadPublicPageV2`'s pattern and `withSsrLoaderTimeout`, #425); a failed or late read = today's behaviour (tabs arrive client-side). It must not change `entityName`, meta, OG, cache headers or edge-TTL tags. Check `docs/ci-guard-notes.md` and the perf notes (useIsMobile getServerSnapshot trap; the edge-TTL serial pass is load-bearing) before touching the loader; run the new read beside the existing reads, not after them.
3. The client hook must use the dehydrated answer on first render (no flash from "no tabs" to "tabs"), hydrate identically (no hydration-mismatch warning in the console), and still refetch normally after staleTime.
4. Teacher pages are closed on prod: the closed-page filter must apply to the served roles exactly as it does client-side (a closed teacher role must not render a tab or a preview link to a 404).

## Prod shapes (read-only survey first, counts only, prod `stsdtacfauprzrdebmzg`)
dancer-only (36) / DJ holder (14 + 26) / teacher holder with teacher pages closed / holds both x dated / past / none x photo / no photo x city / no city. Walk one of each at 390x844 and 360x800 with the flag ON.

## Tests (red first)
Table-driven shape x served-HTML matrix: tabs present in the server HTML for holders, absent for dancer-only; reserve row present only for teacher/DJ holders; flag OFF unchanged; read failure and read timeout = no tabs in the HTML, page still 200 with the same meta; no hydration mismatch. Run the new tests against the unfixed code first. Measure CLS before/after for `brito` (DJ undated), `bobby-blanco` (DJ dated), `b` (teacher+DJ), `ben` (dancer-only) at 390 and 360; the target is < 0.1 on all and ~0 for the tabs; put the numbers in the design record.

## Design Gate, checks, handover
No visible change except less movement: record `docs/design/people-s7-roles-in-loader.md` (before/after CLS table). Run every CI job step in your sandbox; per-job table in the handover. The bot opens the PR with a placeholder body, so put ready-to-paste PR body text in `docs/people-arc/s7/HANDOVER.md`: sections `## Verified on real data` (heading EXACTLY that, lines starting `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: `) and `## Phone QA` (`- Sizes checked: `, `- Walked: `, `- Not verified: `). Handover also has: head sha, PR, shape table, how the orchestrator turns the flag on (`preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true`, plus `VITE_ENABLE_TEACHER_DETAIL=true`), Not verified. NOTE: `laptop-walk.mjs` URL mode cannot open Vercel previews (SSO); walk on a local build. HTML entities, not raw Unicode punctuation, in JSX; source files over 2 KB through scripts/safe-edit.py / safe-write.py. Context under 50%.
