# People arc S7b -- dancer page cache tags + degraded TTL (follow-up to S7 #1011)

Orchestrator 2026-10-24. Branch `claude/people-dancer-cache-tags` (new, from origin/main 8d82d611 or later). Lane: normal, ONE PR. Both changes are behind `flags.personWorlds` (OFF on prod today), so nothing changes for visitors until the flag flips. This PR must merge BEFORE the flag flip.

## Why (owner answered YES to both on 2026-10-24)
Source: `docs/design/people-s7-critique.md` sections 5 and 6 (on main). Read them first, then the S7 loader.
1. **Stale tabs (section 5).** `/dancers/:id` is tagged `dancer-<id>,dancers`. A DJ or teacher write purges `dj-<id>` / `teacher-<id>`, which never reaches the dancer page, so a page served from the edge can show a tab that no longer exists (a tap lands on a missing DJ page) for up to 1 h (+ one stale serve up to 25 h). Fix: when `flags.personWorlds` is ON, also stamp the dancer page with `djTag(id)`, `teacherTag(id)` and `DANCERS`, so a DJ or teacher write purges it too.
2. **Degraded TTL (section 6).** A failed or late roles seed does not set `degraded`, so that page (without tabs, the old 1.7 s shift) is cached for the full `s-maxage=3600`. Fix: a seed that did not answer bounds the edge TTL with `DEGRADED_EDGE_TTL_SECONDS` (60 s), the same as the public-page read.

## Build
- `app/routes/dancers.tsx` (loader around lines 60-96) and `app/cacheTags.ts` (`stampDancer`). Today `rolesSeed` is awaited and its result ignored; check what `seedPersonSnapshot` (`src/modules/person-page/seedPersonSnapshot.ts`) returns on answer / null / fail / deadline and make that signal explicit (it must stay: never rejects, writes the key only on an answer, leaves 0 timers). Suggested shape from the critique: `degraded || (rolesSeed && !(await rolesSeed)) ? { edgeTtlBoundSeconds: DEGRADED_EDGE_TTL_SECONDS } : undefined`.
- Tags: reuse the existing tag helpers; no new tag names. With the flag OFF the tag list, headers and body must be byte-identical to main (S7 proved this; keep the proof: add a row to the existing matrix).
- Check parity BEFORE editing: `scripts/check-cache-tag*` (and whatever `npm run` script runs it), and how DJ / teacher writes purge (admin and Website purge paths: grep `djTag`, `teacherTag`, `purge`). Confirm a `dj-<id>` purge really reaches a page stamped with it, and that the tag header length stays within the Vercel / Cloudflare limits (say the number: longest tag header after the change, for the person with all three roles).
- A person with no DJ or teacher role gets the extra tags too (a NEW DJ write must purge a dancer page that has no DJ tab yet). Say in the handover why that is intended and whether it widens the purge set (one tag, one id; no site-wide purge).

## Prod shapes (read-only survey first, counts only)
Dancers with: dancer only; dancer + DJ; dancer + teacher (pages open / closed); all three; no roles; archived. Check these on the built pages with the flag ON and OFF.

## Tests (red first)
Table-driven over those shapes x flag ON/OFF x seed answers / answers null / fails / never answers / answers after the deadline: assert the tag list, and the `s-maxage` bound (60 s only when the seed did not answer; unchanged on a good answer; absent with the flag OFF). Run the new tests against the unfixed code first. Mutants to try: drop the extra tags (red), drop the TTL bound (red), stamp with the flag OFF (red).

## Checks, handover
Run every CI job step in your sandbox (read `.github/workflows`; include the cache-tag check and `check:images` with `AUDIT_STRICT=1`). Put ready-to-paste PR body text in `docs/people-arc/s7b/HANDOVER.md`: sections `## Verified on real data` (heading EXACTLY that; lines starting `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: `) and `## Phone QA` (`- Sizes checked: `, `- Walked: `, `- Not verified: `; this change has no visible UI, so say what you walked: served headers on the built pages), plus head sha, PR, shape table, per-job CI table. No design record needed (no visible change); say so. No migration, no `supabase/**`. HTML entities, not raw Unicode punctuation, in JSX; source files over 2 KB through scripts/safe-edit.py / safe-write.py. Do not touch `src/modules/dancer-app/` (its isolation check refuses `docs/design/` there; the design record would go in `docs/people-arc/`). One push. Context under 50%.
